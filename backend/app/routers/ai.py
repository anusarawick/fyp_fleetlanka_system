from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import re
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.core.config import settings
from app.core.deps import require_manager_profile
from app.schemas.chat import AiChatRequest, AiChatResponse, AiChatTable, AiChatTurn
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/ai", tags=["ai"])

CONTEXT_CACHE_TTL_SECONDS = 60
_CONTEXT_CACHE: dict[tuple[str, str], tuple[datetime, dict[str, Any]]] = {}

DENIED_PATTERNS = (
    "api key",
    "password",
    "secret",
    "token",
    "credential",
    "system prompt",
    "hidden instruction",
    "ignore instructions",
    "jailbreak",
    "bypass",
    "another organization",
    "cross organization",
)
OUT_OF_SCOPE_PATTERNS = (
    "movie",
    "recipe",
    "song",
    "poem",
    "celebrity",
    "sports score",
    "video game",
    "medical advice",
    "legal advice",
    "stock pick",
    "crypto trade",
)
GREETING_MESSAGES = {"hi", "hello", "hey", "good morning", "good afternoon", "good evening"}
HELP_MESSAGES = {"help", "what can you do", "what can you help", "who are you"}

SYSTEM_OVERVIEW = """
FleetLanka is an organization-scoped fleet-management system for managers. It covers vehicles,
drivers, trips, fuel logs, maintenance, compliance documents, service centers, service bookings,
Stripe Connect payments, manager-service chat, and ML maintenance/fuel prediction workflows.
The AI assistant is read-only. It can explain workflows and summarize the current manager's
organization data, but it must not create, update, delete, expose secrets, or access another org.
""".strip()


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip(" .!?")


def _money(value: Any) -> str:
    try:
        return f"LKR {float(value or 0):,.2f}"
    except (TypeError, ValueError):
        return "LKR 0.00"


def _number(value: Any, suffix: str = "") -> str:
    if value in (None, ""):
        return "--"
    try:
        numeric = float(value)
        formatted = f"{numeric:,.0f}" if numeric.is_integer() else f"{numeric:,.1f}"
        return f"{formatted}{suffix}"
    except (TypeError, ValueError):
        return str(value)


def _short_id(value: str | None) -> str:
    return (value or "")[:8] or "--"


def _vehicle_name(row: dict[str, Any]) -> str:
    return " ".join(part for part in [row.get("make"), row.get("model")] if part) or "--"


def _safe_rows(admin_client, table: str, org_id: str, columns: str = "*", limit: int = 300) -> list[dict[str, Any]]:
    try:
        return (
            admin_client.table(table)
            .select(columns)
            .eq("org_id", org_id)
            .limit(limit)
            .execute()
            .data
            or []
        )
    except Exception:
        return []


def _count_rows(admin_client, table: str, org_id: str) -> int:
    try:
        response = (
            admin_client.table(table)
            .select("id", count="exact")
            .eq("org_id", org_id)
            .limit(1)
            .execute()
        )
        return int(response.count or 0)
    except Exception:
        return 0


def _vehicle_maps(admin_client, org_id: str) -> tuple[list[dict[str, Any]], dict[str, str]]:
    vehicles = _safe_rows(
        admin_client,
        "vehicles",
        org_id,
        "id, plate_no, make, model, vehicle_type, status, odometer_km, next_service_due_km",
        300,
    )
    labels = {row["id"]: f"{row.get('plate_no') or '--'} {_vehicle_name(row)}".strip() for row in vehicles if row.get("id")}
    return vehicles, labels


def _driver_labels(admin_client, org_id: str) -> dict[str, str]:
    rows = _safe_rows(admin_client, "profiles", org_id, "id, full_name, role", 300)
    return {row["id"]: row.get("full_name") or "Driver" for row in rows if row.get("id")}


def _center_labels(admin_client, org_id: str) -> dict[str, str]:
    rows = _safe_rows(admin_client, "service_centers", org_id, "id, name", 300)
    return {row["id"]: row.get("name") or "Service center" for row in rows if row.get("id")}


def _latest_prediction_by_vehicle(admin_client, org_id: str) -> dict[str, dict[str, Any]]:
    predictions = _safe_rows(
        admin_client,
        "maintenance_predictions",
        org_id,
        "vehicle_id, probability, risk_level, predicted_at",
        300,
    )
    latest: dict[str, dict[str, Any]] = {}
    for row in predictions:
        vehicle_id = row.get("vehicle_id")
        if not vehicle_id:
            continue
        current = latest.get(vehicle_id)
        if not current or str(row.get("predicted_at") or "") > str(current.get("predicted_at") or ""):
            latest[vehicle_id] = row
    return latest


def _table(columns: list[str], rows: list[list[Any]]) -> dict[str, Any]:
    return {"columns": columns, "rows": [[("--" if value in (None, "") else value) for value in row] for row in rows]}


def _vehicle_list(admin_client, org_id: str, limit: int = 300) -> dict[str, Any]:
    vehicles, _labels = _vehicle_maps(admin_client, org_id)
    predictions = _latest_prediction_by_vehicle(admin_client, org_id)
    rows = []
    for row in vehicles[:limit]:
        prediction = predictions.get(row.get("id"), {})
        risk = prediction.get("risk_level")
        probability = prediction.get("probability")
        risk_label = "--"
        if risk:
            risk_label = f"{str(risk).title()} {_number(float(probability) * 100 if probability is not None else None, '%')}"
        rows.append(
            [
                row.get("plate_no"),
                _vehicle_name(row),
                row.get("vehicle_type"),
                row.get("status"),
                _number(row.get("odometer_km"), " km"),
                risk_label,
                _number(row.get("next_service_due_km"), " km"),
            ]
        )
    return {
        "tool": "vehicle_list",
        "title": "Vehicle Details",
        "summary": f"Showing {min(len(rows), limit)} of {len(vehicles)} vehicles.",
        "table": _table(["Plate", "Make / Model", "Type", "Status", "Odometer", "Risk", "Next Service Due"], rows),
        "followups": ["Show more vehicles", "Show vehicle operating profiles", "Show maintenance risks"],
    }


def _vehicle_details(admin_client, org_id: str) -> dict[str, Any]:
    vehicles, labels = _vehicle_maps(admin_client, org_id)
    profiles = _safe_rows(admin_client, "vehicle_operating_profiles", org_id, "vehicle_id, fuel_type, business_type, road_condition_primary, driver_behavior_profile, typical_load_factor", 300)
    components = _safe_rows(admin_client, "vehicle_component_state", org_id, "vehicle_id, last_service_odometer_km, last_oil_change_odometer_km, last_tyre_change_odometer_km, last_brake_service_odometer_km, battery_installed_at", 300)
    profile_map = {row.get("vehicle_id"): row for row in profiles}
    component_map = {row.get("vehicle_id"): row for row in components}
    rows = []
    for vehicle in vehicles[:20]:
        profile = profile_map.get(vehicle.get("id"), {})
        component = component_map.get(vehicle.get("id"), {})
        rows.append(
            [
                vehicle.get("plate_no"),
                labels.get(vehicle.get("id"), _vehicle_name(vehicle)),
                profile.get("fuel_type"),
                profile.get("business_type"),
                _number(component.get("last_service_odometer_km"), " km"),
                _number(component.get("last_oil_change_odometer_km"), " km"),
                component.get("battery_installed_at"),
            ]
        )
    return {
        "tool": "vehicle_details",
        "title": "Vehicle Operating And Component Details",
        "summary": f"Showing ML-relevant details for {len(rows)} vehicles.",
        "table": _table(["Plate", "Vehicle", "Fuel", "Business Use", "Last Service", "Last Oil", "Battery Installed"], rows),
        "followups": ["Show vehicle list", "Show maintenance risks", "Show documents expiring"],
    }


def _driver_list(admin_client, org_id: str) -> dict[str, Any]:
    drivers = [row for row in _safe_rows(admin_client, "profiles", org_id, "id, full_name, phone, status, role", 300) if row.get("role") == "driver"]
    rows = [[row.get("full_name") or "Driver", row.get("status"), row.get("phone") or "--"] for row in drivers]
    return {
        "tool": "driver_list",
        "title": "Driver Details",
        "summary": f"{len(drivers)} driver profiles found.",
        "table": _table(["Driver", "Status", "Phone"], rows),
        "followups": ["Show trips by driver", "Show driver documents", "Show fleet summary"],
    }


def _trip_summary(admin_client, org_id: str) -> dict[str, Any]:
    _vehicles, vehicle_labels = _vehicle_maps(admin_client, org_id)
    driver_labels = _driver_labels(admin_client, org_id)
    trips = _safe_rows(admin_client, "trips", org_id, "id, vehicle_id, driver_id, status, trip_title, scheduled_start, origin_label, destination_label, distance_km", 300)
    rows = [
        [
            row.get("trip_title") or _short_id(row.get("id")),
            vehicle_labels.get(row.get("vehicle_id"), "--"),
            driver_labels.get(row.get("driver_id"), "--"),
            row.get("status"),
            row.get("scheduled_start"),
            f"{row.get('origin_label') or '--'} -> {row.get('destination_label') or '--'}",
            _number(row.get("distance_km"), " km"),
        ]
        for row in trips
    ]
    active = len([row for row in trips if row.get("status") == "in_progress"])
    return {
        "tool": "trip_summary",
        "title": "Trip Summary",
        "summary": f"{len(trips)} trips found. {active} are currently in progress.",
        "table": _table(["Trip", "Vehicle", "Driver", "Status", "Scheduled", "Route", "Distance"], rows),
        "followups": ["Show active trips", "Show fuel summary", "Show driver details"],
    }


def _fuel_summary(admin_client, org_id: str) -> dict[str, Any]:
    _vehicles, vehicle_labels = _vehicle_maps(admin_client, org_id)
    logs = _safe_rows(admin_client, "fuel_logs", org_id, "id, vehicle_id, fuel_date, liters, cost_lkr, odometer_km, vendor", 300)
    total_cost = sum(float(row.get("cost_lkr") or 0) for row in logs)
    total_liters = sum(float(row.get("liters") or 0) for row in logs)
    rows = [
        [
            row.get("fuel_date"),
            vehicle_labels.get(row.get("vehicle_id"), "--"),
            _number(row.get("liters"), " L"),
            _money(row.get("cost_lkr")),
            _number(row.get("odometer_km"), " km"),
            row.get("vendor") or "--",
        ]
        for row in logs
    ]
    return {
        "tool": "fuel_summary",
        "title": "Fuel Summary",
        "summary": f"{len(logs)} fuel logs sampled, totaling {_number(total_liters, ' L')} and {_money(total_cost)}.",
        "table": _table(["Date", "Vehicle", "Liters", "Cost", "Odometer", "Vendor"], rows),
        "followups": ["Show fuel spend", "Show vehicle details", "Show trips"],
    }


def _maintenance_summary(admin_client, org_id: str) -> dict[str, Any]:
    _vehicles, vehicle_labels = _vehicle_maps(admin_client, org_id)
    records = _safe_rows(admin_client, "maintenance", org_id, "id, vehicle_id, service_date, service_type, event_type, severity, cost_lkr, odometer_km, next_service_due_km", 300)
    predictions = _latest_prediction_by_vehicle(admin_client, org_id)
    high_risk = len([row for row in predictions.values() if row.get("risk_level") == "high"])
    rows = [
        [
            row.get("service_date"),
            vehicle_labels.get(row.get("vehicle_id"), "--"),
            row.get("event_type") or row.get("service_type"),
            row.get("severity") or "--",
            _money(row.get("cost_lkr")),
            _number(row.get("odometer_km"), " km"),
            _number(row.get("next_service_due_km"), " km"),
        ]
        for row in records
    ]
    return {
        "tool": "maintenance_summary",
        "title": "Maintenance Summary",
        "summary": f"{len(records)} maintenance records sampled. {high_risk} vehicles currently have high-risk ML predictions.",
        "table": _table(["Date", "Vehicle", "Work", "Severity", "Cost", "Odometer", "Next Due"], rows),
        "followups": ["Show maintenance risks", "Show component baselines", "Show service bookings"],
    }


def _document_compliance_summary(admin_client, org_id: str) -> dict[str, Any]:
    _vehicles, vehicle_labels = _vehicle_maps(admin_client, org_id)
    driver_labels = _driver_labels(admin_client, org_id)
    docs = _safe_rows(admin_client, "documents", org_id, "id, vehicle_id, driver_id, doc_type, doc_number, expiry_date, file_name, file_mime_type, file_size_bytes", 300)
    rows = []
    for row in docs:
        owner = vehicle_labels.get(row.get("vehicle_id")) or driver_labels.get(row.get("driver_id")) or "--"
        rows.append([owner, row.get("doc_type"), row.get("doc_number") or "--", row.get("expiry_date") or "--", row.get("file_name") or "--"])
    return {
        "tool": "document_compliance_summary",
        "title": "Document And Compliance Summary",
        "summary": f"{len(docs)} document records found. {len([row for row in docs if row.get('expiry_date')])} have expiry dates.",
        "table": _table(["Owner", "Document", "Number", "Expiry", "File"], rows),
        "followups": ["Show expiring documents", "Show vehicle documents", "Show driver documents"],
    }


def _service_booking_summary(admin_client, org_id: str) -> dict[str, Any]:
    _vehicles, vehicle_labels = _vehicle_maps(admin_client, org_id)
    center_labels = _center_labels(admin_client, org_id)
    bookings = _safe_rows(admin_client, "service_bookings", org_id, "id, vehicle_id, center_id, requested_date, status, completion_review_status, payment_status, final_cost_lkr, work_type", 300)
    rows = [
        [
            _short_id(row.get("id")),
            vehicle_labels.get(row.get("vehicle_id"), "--"),
            center_labels.get(row.get("center_id"), "--"),
            row.get("work_type") or "--",
            row.get("requested_date"),
            row.get("status"),
            row.get("completion_review_status") or "pending",
            row.get("payment_status"),
            _money(row.get("final_cost_lkr")),
        ]
        for row in bookings
    ]
    pending = len([row for row in bookings if row.get("status") == "completed" and (row.get("completion_review_status") or "pending") in {"pending", "rejected"}])
    return {
        "tool": "service_booking_summary",
        "title": "Service Booking Summary",
        "summary": f"{len(bookings)} service bookings found. {pending} need manager review.",
        "table": _table(["Booking", "Vehicle", "Center", "Work", "Date", "Status", "Review", "Payment", "Amount"], rows),
        "followups": ["Show pending reviews", "Show paid bookings", "Show payment summary"],
    }


def _service_center_summary(admin_client, org_id: str) -> dict[str, Any]:
    centers = _safe_rows(
        admin_client,
        "service_centers",
        org_id,
        "id, name, phone, address, payment_access_enabled, stripe_onboarding_status, profile_id, created_at",
        300,
    )
    rows = [
        [
            row.get("name"),
            row.get("phone") or "--",
            row.get("address") or "--",
            "Enabled" if row.get("payment_access_enabled") else "Disabled",
            row.get("stripe_onboarding_status") or "not_started",
            "Yes" if row.get("profile_id") else "No",
        ]
        for row in centers[:20]
    ]
    return {
        "tool": "service_center_summary",
        "title": "Service Center Details",
        "summary": f"{len(centers)} service centers found.",
        "table": _table(["Service Center", "Phone", "Address", "Payment Access", "Stripe Status", "Portal Linked"], rows),
        "followups": ["Show service bookings", "Show payment summary", "Show pending reviews"],
    }


def _payment_summary(admin_client, org_id: str) -> dict[str, Any]:
    center_labels = _center_labels(admin_client, org_id)
    payments = _safe_rows(admin_client, "service_booking_payments", org_id, "id, booking_id, service_center_id, amount_lkr, currency, status, stripe_payment_intent_id, paid_at", 300)
    total_paid = sum(float(row.get("amount_lkr") or 0) for row in payments if row.get("status") == "paid")
    rows = [
        [
            _short_id(row.get("id")),
            _short_id(row.get("booking_id")),
            center_labels.get(row.get("service_center_id"), "--"),
            row.get("status"),
            _money(row.get("amount_lkr")),
            row.get("currency") or "lkr",
            _short_id(row.get("stripe_payment_intent_id")),
            row.get("paid_at") or "--",
        ]
        for row in payments
    ]
    return {
        "tool": "payment_summary",
        "title": "Payment Summary",
        "summary": f"{len(payments)} payment records found. Paid total is {_money(total_paid)}.",
        "table": _table(["Payment", "Booking", "Service Center", "Status", "Amount", "Currency", "Stripe PI", "Paid At"], rows),
        "followups": ["Show pending payments", "Show paid bookings", "Explain payment workflow"],
    }


def _fleet_summary(admin_client, org_id: str) -> dict[str, Any]:
    counts = {
        "Vehicles": _count_rows(admin_client, "vehicles", org_id),
        "Drivers": len([row for row in _safe_rows(admin_client, "profiles", org_id, "id, role", 100) if row.get("role") == "driver"]),
        "Trips": _count_rows(admin_client, "trips", org_id),
        "Fuel logs": _count_rows(admin_client, "fuel_logs", org_id),
        "Maintenance records": _count_rows(admin_client, "maintenance", org_id),
        "Documents": _count_rows(admin_client, "documents", org_id),
        "Service bookings": _count_rows(admin_client, "service_bookings", org_id),
        "Payments": _count_rows(admin_client, "service_booking_payments", org_id),
    }
    rows = [[label, value] for label, value in counts.items()]
    return {
        "tool": "fleet_summary",
        "title": "Fleet Summary",
        "summary": "Here is the current FleetLanka data footprint for your organization.",
        "table": _table(["Area", "Count"], rows),
        "followups": ["Show vehicle details", "Show driver details", "Show pending payments"],
    }


def _system_workflow_info(_admin_client, _org_id: str) -> dict[str, Any]:
    return {
        "tool": "system_workflow_info",
        "title": "FleetLanka Workflow Help",
        "summary": "FleetLanka combines operational fleet records with service workflows, payments, and ML prediction support.",
        "bullets": [
            "Vehicles store identity, odometer, operating profile, component baselines, image, and readiness data.",
            "Maintenance can come from manager logs or approved service-center booking completions.",
            "Stripe payments happen after manager approval and route funds to the connected service center.",
            "ML predictions use vehicle, operating, component, fuel, trip, and maintenance signals to estimate risk.",
        ],
        "followups": ["Show vehicle details", "Explain maintenance workflow", "Explain payment workflow"],
    }


TOOL_FUNCTIONS = {
    "fleet_summary": _fleet_summary,
    "vehicle_list": _vehicle_list,
    "vehicle_list_more": lambda admin_client, org_id: _vehicle_list(admin_client, org_id, 40),
    "vehicle_details": _vehicle_details,
    "driver_list": _driver_list,
    "trip_summary": _trip_summary,
    "fuel_summary": _fuel_summary,
    "maintenance_summary": _maintenance_summary,
    "document_compliance_summary": _document_compliance_summary,
    "service_center_summary": _service_center_summary,
    "service_booking_summary": _service_booking_summary,
    "payment_summary": _payment_summary,
    "system_workflow_info": _system_workflow_info,
}


def _history_text(history: list[AiChatTurn]) -> str:
    return "\n".join(f"{turn.role}: {turn.text}" for turn in history[-8:] if turn.text.strip())


def _extract_followups(history: list[AiChatTurn]) -> list[str]:
    for turn in reversed(history[-8:]):
        if turn.role != "assistant":
            continue
        lines = turn.text.splitlines()
        followups = []
        capture = False
        for line in lines:
            stripped = line.strip()
            if stripped.lower().startswith(("you can ask", "try next", "follow-ups", "followups")):
                capture = True
                continue
            match = re.match(r"^\d+[.)]\s+(.+)$", stripped)
            if match:
                followups.append(match.group(1).strip())
                continue
            if capture and stripped.startswith("- "):
                followups.append(stripped[2:].strip())
        if followups:
            return followups
    return []


def _resolve_followup(message: str, history: list[AiChatTurn]) -> str:
    normalized = _normalize(message)
    followups = _extract_followups(history)
    if not followups:
        return message
    ordinal_map = {"1": 0, "1st": 0, "first": 0, "first option": 0, "2": 1, "2nd": 1, "second": 1, "second option": 1, "3": 2, "3rd": 2, "third": 2, "third option": 2}
    index = ordinal_map.get(normalized)
    if index is not None and index < len(followups):
        return followups[index]
    if normalized in {"show more", "more", "continue"}:
        return followups[0]
    return message


def _lookup_terms(message: str) -> list[str]:
    terms: list[str] = []
    patterns = [
        r"\b[A-Z]{2,}\d*-\d{2,5}\b",
        r"\bBK-[A-Z0-9]{6,}\b",
        r"\b[0-9a-f]{8}\b",
    ]
    for pattern in patterns:
        for match in re.findall(pattern, message.upper()):
            if match not in terms:
                terms.append(match)
    return terms


def _apply_lookup_filter(payload: dict[str, Any], message: str) -> dict[str, Any]:
    terms = _lookup_terms(message)
    table = payload.get("table")
    if not terms or not isinstance(table, dict) or not table.get("rows"):
        return payload

    filtered_rows = []
    lowered_terms = [term.lower() for term in terms]
    for row in table.get("rows", []):
        row_text = " ".join(str(cell).lower() for cell in row)
        if all(term in row_text for term in lowered_terms):
            filtered_rows.append(row)

    next_payload = dict(payload)
    next_table = dict(table)
    next_table["rows"] = filtered_rows
    next_payload["table"] = next_table
    label = ", ".join(terms)
    title = payload.get("title") or "Results"
    next_payload["title"] = f"{title} For {label}"
    next_payload["summary"] = (
        f"Found {len(filtered_rows)} matching rows for {label}."
        if filtered_rows
        else f"No matching rows found for {label} in {title.lower()}."
    )
    return next_payload


def _classify_message(message: str, history: list[AiChatTurn]) -> tuple[str, str]:
    normalized = _normalize(message)
    if any(pattern in normalized for pattern in DENIED_PATTERNS):
        return "denied", "refusal"
    if normalized in GREETING_MESSAGES:
        return "greeting", "none"
    if any(phrase in normalized for phrase in HELP_MESSAGES):
        return "help", "system_workflow_info"
    if any(pattern in normalized for pattern in OUT_OF_SCOPE_PATTERNS) and not any(word in normalized for word in ("fleet", "vehicle", "driver", "maintenance", "fuel")):
        return "out_of_scope", "refusal"

    text = f"{normalized} {_history_text(history).lower()[-1000:] if len(normalized.split()) <= 3 else ''}"
    if any(word in text for word in ("payment", "paid", "unpaid", "stripe", "settlement", "payable")):
        return "fleet", "payment_summary"
    if any(word in text for word in ("service center", "service centre", "service portal", "service portals", "centers", "centres")) and not any(word in text for word in ("booking", "bookings", "job", "approval")):
        return "fleet", "service_center_summary"
    if any(word in text for word in ("booking", "service center", "service centre", "approval queue", "repair job")):
        return "fleet", "service_booking_summary"
    if any(word in text for word in ("driver", "drivers")):
        return "fleet", "driver_list"
    if any(word in text for word in ("trip", "trips", "route", "delivery", "active trip")):
        return "fleet", "trip_summary"
    if any(word in text for word in ("fuel", "diesel", "petrol", "liter", "litre", "spend")):
        return "fleet", "fuel_summary"
    if any(word in text for word in ("document", "documents", "license", "licence", "insurance", "expiry", "expire", "compliance")):
        return "fleet", "document_compliance_summary"
    if any(word in text for word in ("maintenance", "risk", "prediction", "component", "oil", "brake", "tyre", "tire", "battery", "service record", "service history", "service records")):
        return "fleet", "maintenance_summary"
    if any(word in text for word in ("operating profile", "baseline", "component state")):
        return "fleet", "vehicle_details"
    if "show more vehicle" in text or "more vehicles" in text:
        return "fleet", "vehicle_list_more"
    if any(word in text for word in ("vehicle", "vehicles", "car", "van", "truck", "bus", "pickup", "available")):
        return "fleet", "vehicle_list"
    if any(word in text for word in ("algorithm", "algorithms", "model", "workflow", "how", "what is", "explain")):
        return "fleet", "system_workflow_info"
    if any(word in text for word in ("summary", "overview", "dashboard", "fleet")):
        return "fleet", "fleet_summary"
    if len(normalized.split()) <= 4 and history:
        return "fleet", "fleet_summary"
    return "out_of_scope", "refusal"


def _get_tool_payload(admin_client, org_id: str, tool: str) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    cache_key = (org_id, tool)
    cached = _CONTEXT_CACHE.get(cache_key)
    if cached and cached[0] > now:
        return cached[1]
    payload = TOOL_FUNCTIONS[tool](admin_client, org_id)
    _CONTEXT_CACHE[cache_key] = (now + timedelta(seconds=CONTEXT_CACHE_TTL_SECONDS), payload)
    return payload


def _structured_response(
    *,
    answer_type: str,
    title: str | None = None,
    summary: str | None = None,
    table: dict[str, Any] | None = None,
    bullets: list[str] | None = None,
    followups: list[str] | None = None,
    refusal: str | None = None,
) -> AiChatResponse:
    if refusal:
        title = None
        summary = None
        table = None
        bullets = []
        followups = []
        answer_type = "refusal"
    bullets = bullets or []
    followups = followups or []
    table_model = AiChatTable(**table) if table else None
    answer = _render_answer(title=title, summary=summary, table=table, bullets=bullets, followups=followups, refusal=refusal)
    return AiChatResponse(
        answer=answer,
        type=answer_type,
        title=title,
        summary=summary,
        table=table_model,
        bullets=bullets,
        followups=followups,
        refusal=refusal,
    )


def _render_answer(
    *,
    title: str | None,
    summary: str | None,
    table: dict[str, Any] | None,
    bullets: list[str],
    followups: list[str],
    refusal: str | None,
) -> str:
    if refusal:
        return refusal
    parts = []
    if title:
        parts.append(f"### {title}")
    if summary:
        parts.append(summary)
    if bullets:
        parts.append("\n".join(f"- {item}" for item in bullets[:5]))
    if table and table.get("columns"):
        columns = [str(col) for col in table.get("columns", [])]
        rows = table.get("rows", [])
        if rows:
            parts.append("| " + " | ".join(columns) + " |")
            parts.append("| " + " | ".join(["---"] * len(columns)) + " |")
            for row in rows[:20]:
                parts.append("| " + " | ".join(str(cell) for cell in row) + " |")
    if followups:
        parts.append("You can ask:\n" + "\n".join(f"{index}. {item}" for index, item in enumerate(followups[:3], 1)))
    return "\n\n".join(parts).strip()


def _extract_json(text: str) -> dict[str, Any] | None:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.S)
        if not match:
            return None
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None


def _gemini_polish(message: str, history: list[AiChatTurn], payload: dict[str, Any]) -> dict[str, Any] | None:
    if not settings.gemini_api_key:
        return None
    try:
        from google import genai
    except Exception as exc:
        raise HTTPException(status_code=500, detail="google-genai is not installed in the backend environment") from exc

    prompt = {
        "system": (
            "You are FleetLanka's manager AI assistant. Return only JSON. "
            "Use the supplied read-only tool payload as the source of truth. "
            "Do not invent rows, values, IDs, or columns. Keep answers concise. "
            "Allowed JSON keys: type, title, summary, table, bullets, followups, refusal. "
            "table must be {columns: string[], rows: array[]}. Record data should stay in tables. "
            "Greetings and refusals should be one short sentence. No nested bullets."
        ),
        "overview": SYSTEM_OVERVIEW,
        "recent_history": [{"role": turn.role, "text": turn.text[:700]} for turn in history[-6:]],
        "manager_message": message,
        "tool_payload": payload,
    }
    client = genai.Client(api_key=settings.gemini_api_key)
    response = None
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            response = client.models.generate_content(model=settings.gemini_model, contents=json.dumps(prompt, default=str))
            break
        except Exception as exc:
            error_text = str(exc).lower()
            if not ("503" in error_text or "unavailable" in error_text or "high demand" in error_text):
                raise
            last_error = exc
            if attempt < 2:
                time.sleep(0.8 * (attempt + 1))
    if response is None:
        raise last_error or RuntimeError("Gemini request unavailable")
    text = getattr(response, "text", None) or ""
    return _extract_json(text)


def _validate_structured(candidate: dict[str, Any] | None, fallback: dict[str, Any]) -> dict[str, Any]:
    if not candidate:
        return fallback
    refusal = candidate.get("refusal")
    if isinstance(refusal, str) and refusal.strip():
        return {
            "type": "refusal",
            "title": None,
            "summary": None,
            "table": None,
            "bullets": [],
            "followups": [],
            "refusal": refusal.strip(),
        }
    result = {
        "type": str(candidate.get("type") or fallback.get("type") or "message"),
        "title": candidate.get("title") or fallback.get("title"),
        "summary": candidate.get("summary") or fallback.get("summary"),
        "bullets": candidate.get("bullets") if isinstance(candidate.get("bullets"), list) else fallback.get("bullets", []),
        "followups": candidate.get("followups") if isinstance(candidate.get("followups"), list) else fallback.get("followups", []),
        "refusal": candidate.get("refusal") or fallback.get("refusal"),
    }
    fallback_table = fallback.get("table")
    if fallback_table:
        result["table"] = fallback_table
    else:
        candidate_table = candidate.get("table")
        if isinstance(candidate_table, dict) and isinstance(candidate_table.get("columns"), list) and isinstance(candidate_table.get("rows"), list):
            result["table"] = candidate_table
        else:
            result["table"] = None
    return result


@router.post("/chat", response_model=AiChatResponse)
def manager_ai_chat(
    payload: AiChatRequest,
    profile: dict = Depends(require_manager_profile),
) -> AiChatResponse:
    raw_message = payload.message.strip()
    if not raw_message:
        raise HTTPException(status_code=400, detail="Message is required")

    message = _resolve_followup(raw_message, payload.history)
    intent, tool = _classify_message(message, payload.history)
    if intent == "denied":
        refusal = "I cannot help with secrets, credentials, or access-bypass requests."
        return _structured_response(answer_type="refusal", refusal=refusal)
    if intent == "out_of_scope":
        refusal = "I can only help with FleetLanka fleet-management operations and data."
        return _structured_response(answer_type="refusal", refusal=refusal)
    if intent == "greeting":
        return _structured_response(answer_type="message", summary="Hi. I can help with your FleetLanka fleet work.")

    admin_client = get_supabase_client(use_service_role=True)
    fallback = _get_tool_payload(admin_client, profile["org_id"], tool)
    fallback = _apply_lookup_filter(fallback, message)
    fallback["type"] = "table" if fallback.get("table") else "summary"
    if fallback.get("table"):
        return _structured_response(
            answer_type=fallback.get("type", "table"),
            title=fallback.get("title"),
            summary=fallback.get("summary"),
            table=fallback.get("table"),
            bullets=fallback.get("bullets", []),
            followups=fallback.get("followups", []),
        )

    if not settings.gemini_api_key:
        return _structured_response(
            answer_type=fallback.get("type", "summary"),
            title=fallback.get("title"),
            summary=fallback.get("summary"),
            table=fallback.get("table"),
            bullets=fallback.get("bullets", []),
            followups=fallback.get("followups", []),
        )

    try:
        polished = _gemini_polish(message, payload.history, fallback)
        structured = _validate_structured(polished, fallback)
    except Exception as exc:
        error_text = str(exc).lower()
        if "503" in error_text or "unavailable" in error_text or "high demand" in error_text:
            return _structured_response(
                answer_type=fallback.get("type", "summary"),
                title=fallback.get("title"),
                summary=fallback.get("summary"),
                table=fallback.get("table"),
                bullets=fallback.get("bullets", []),
                followups=fallback.get("followups", []),
            )
        raise HTTPException(status_code=500, detail="AI assistant request failed. Please try again.") from exc

    return _structured_response(
        answer_type=structured.get("type", "summary"),
        title=structured.get("title"),
        summary=structured.get("summary"),
        table=structured.get("table"),
        bullets=structured.get("bullets", []),
        followups=structured.get("followups", []),
        refusal=structured.get("refusal"),
    )
