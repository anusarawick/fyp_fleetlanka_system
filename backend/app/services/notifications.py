from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable, Optional


MANAGER_ROLES = {"owner", "manager"}
SERVICE_DUE_SOON_KM = 1000
DOCUMENT_DUE_SOON_DAYS = 14
GENERATED_PREFIXES = (
    "generated:document:",
    "generated:maintenance:",
    "generated:approval:",
    "generated:ml:",
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _date_only(value: Any) -> Optional[str]:
    if not value:
        return None
    return str(value)[:10]


def _parse_date(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value)[:10])
        return parsed.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _days_until(value: Any) -> Optional[int]:
    parsed = _parse_date(value)
    if not parsed:
        return None
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return (parsed - today).days


def _safe_metadata(value: Optional[dict[str, Any]]) -> dict[str, Any]:
    return value or {}


def list_profiles_by_roles(admin_client: Any, org_id: str, roles: Iterable[str]) -> list[dict]:
    response = (
        admin_client.table("profiles")
        .select("id, role, full_name, status")
        .eq("org_id", org_id)
        .in_("role", list(roles))
        .execute()
    )
    return response.data or []


def manager_profiles(admin_client: Any, org_id: str) -> list[dict]:
    return list_profiles_by_roles(admin_client, org_id, MANAGER_ROLES)


def service_profile_for_center(admin_client: Any, center_id: Optional[str], org_id: str) -> Optional[dict]:
    if not center_id:
        return None
    center_resp = (
        admin_client.table("service_centers")
        .select("profile_id")
        .eq("id", center_id)
        .eq("org_id", org_id)
        .single()
        .execute()
    )
    profile_id = (center_resp.data or {}).get("profile_id")
    if not profile_id:
        return None
    profile_resp = (
        admin_client.table("profiles")
        .select("id, role, full_name, status")
        .eq("id", profile_id)
        .eq("org_id", org_id)
        .single()
        .execute()
    )
    return profile_resp.data


def upsert_notification(
    admin_client: Any,
    *,
    org_id: str,
    recipient_profile_id: str,
    source_key: str,
    alert_type: str,
    title: str,
    message: str,
    severity: str = "info",
    category: str = "general",
    action_url: Optional[str] = None,
    related_entity: Optional[str] = None,
    related_id: Optional[str] = None,
    source_table: Optional[str] = None,
    source_id: Optional[str] = None,
    due_date: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> Optional[dict]:
    payload = {
        "org_id": org_id,
        "recipient_profile_id": recipient_profile_id,
        "alert_type": alert_type,
        "title": title,
        "message": message,
        "severity": severity,
        "category": category,
        "action_url": action_url,
        "related_entity": related_entity,
        "related_id": related_id,
        "source_table": source_table,
        "source_id": source_id,
        "source_key": source_key,
        "due_date": due_date,
        "status": "open",
        "metadata": _safe_metadata(metadata),
        "resolved_at": None,
        "updated_at": _now(),
    }
    response = (
        admin_client.table("alerts")
        .upsert(payload, on_conflict="recipient_profile_id,source_key")
        .execute()
    )
    return (response.data or [None])[0]


def notify_profiles(
    admin_client: Any,
    profiles: Iterable[dict],
    *,
    org_id: str,
    source_key: str,
    alert_type: str,
    title: str,
    message: str,
    severity: str = "info",
    category: str = "general",
    action_url: Optional[str] = None,
    related_entity: Optional[str] = None,
    related_id: Optional[str] = None,
    source_table: Optional[str] = None,
    source_id: Optional[str] = None,
    due_date: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    for profile in profiles:
        profile_id = profile.get("id")
        if not profile_id:
            continue
        upsert_notification(
            admin_client,
            org_id=org_id,
            recipient_profile_id=profile_id,
            source_key=f"{source_key}:recipient:{profile_id}",
            alert_type=alert_type,
            title=title,
            message=message,
            severity=severity,
            category=category,
            action_url=action_url,
            related_entity=related_entity,
            related_id=related_id,
            source_table=source_table,
            source_id=source_id,
            due_date=due_date,
            metadata=metadata,
        )


def sync_generated_notifications(admin_client: Any, profile: dict) -> None:
    if profile.get("role") not in MANAGER_ROLES:
        return

    org_id = profile["org_id"]
    recipient_id = profile["id"]
    active_keys: set[str] = set()

    documents = (
        admin_client.table("documents")
        .select("id, doc_type, expiry_date, vehicle_id, driver_id")
        .eq("org_id", org_id)
        .execute()
        .data
        or []
    )
    vehicles = (
        admin_client.table("vehicles")
        .select("id, plate_no, odometer_km, mileage, next_service_due_km")
        .eq("org_id", org_id)
        .execute()
        .data
        or []
    )
    bookings = (
        admin_client.table("service_bookings")
        .select("id, vehicle_id, requested_date, status, completion_review_status")
        .eq("org_id", org_id)
        .execute()
        .data
        or []
    )
    predictions = (
        admin_client.table("maintenance_predictions")
        .select("id, vehicle_id, probability, risk_level, predicted_at")
        .eq("org_id", org_id)
        .execute()
        .data
        or []
    )
    vehicle_by_id = {row["id"]: row for row in vehicles if row.get("id")}

    for doc in documents:
        days = _days_until(doc.get("expiry_date"))
        if days is None or days > DOCUMENT_DUE_SOON_DAYS:
            continue
        expired = days < 0
        source_key = f"generated:document:{doc['id']}"
        active_keys.add(source_key)
        upsert_notification(
            admin_client,
            org_id=org_id,
            recipient_profile_id=recipient_id,
            source_key=source_key,
            alert_type="document_expired" if expired else "document_expiring",
            title=f"{doc.get('doc_type') or 'Document'} {'expired' if expired else 'expiring soon'}",
            message=f"{doc.get('doc_type') or 'Document'} {'expired' if expired else 'expires'} on {_date_only(doc.get('expiry_date'))}.",
            severity="danger" if expired else "warning",
            category="documents",
            action_url="/documents",
            related_entity="documents",
            related_id=doc.get("id"),
            source_table="documents",
            source_id=doc.get("id"),
            due_date=_date_only(doc.get("expiry_date")),
            metadata={"vehicle_id": doc.get("vehicle_id"), "driver_id": doc.get("driver_id")},
        )

    for vehicle in vehicles:
        due = vehicle.get("next_service_due_km")
        current = vehicle.get("odometer_km")
        if current is None:
            current = vehicle.get("mileage")
        if not isinstance(due, (int, float)) or not isinstance(current, (int, float)):
            continue
        remaining = float(due) - float(current)
        if remaining > SERVICE_DUE_SOON_KM:
            continue
        overdue = remaining <= 0
        source_key = f"generated:maintenance:{vehicle['id']}"
        active_keys.add(source_key)
        upsert_notification(
            admin_client,
            org_id=org_id,
            recipient_profile_id=recipient_id,
            source_key=source_key,
            alert_type="maintenance_overdue" if overdue else "maintenance_due",
            title=f"Service {'overdue' if overdue else 'due soon'}: {vehicle.get('plate_no') or 'Vehicle'}",
            message=(
                f"{vehicle.get('plate_no') or 'Vehicle'} is {abs(round(remaining)):,} km overdue."
                if overdue
                else f"{vehicle.get('plate_no') or 'Vehicle'} is due in {round(remaining):,} km."
            ),
            severity="danger" if overdue else "warning",
            category="maintenance",
            action_url="/maintenance",
            related_entity="vehicles",
            related_id=vehicle.get("id"),
            source_table="vehicles",
            source_id=vehicle.get("id"),
            metadata={"remaining_km": remaining, "next_service_due_km": due},
        )

    for booking in bookings:
        if (booking.get("status") or "pending").lower() != "completed":
            continue
        if (booking.get("completion_review_status") or "pending").lower() == "approved":
            continue
        vehicle = vehicle_by_id.get(booking.get("vehicle_id") or "", {})
        source_key = f"generated:approval:{booking['id']}"
        active_keys.add(source_key)
        upsert_notification(
            admin_client,
            org_id=org_id,
            recipient_profile_id=recipient_id,
            source_key=source_key,
            alert_type="service_completion_review",
            title="Service completion needs review",
            message=f"Completed booking for {vehicle.get('plate_no') or 'a vehicle'} is waiting for manager approval.",
            severity="danger",
            category="approvals",
            action_url="/maintenance",
            related_entity="service_bookings",
            related_id=booking.get("id"),
            source_table="service_bookings",
            source_id=booking.get("id"),
            due_date=_date_only(booking.get("requested_date")),
            metadata={"vehicle_id": booking.get("vehicle_id")},
        )

    latest_prediction_by_vehicle: dict[str, dict] = {}
    for prediction in predictions:
        if prediction.get("risk_level") != "high":
            continue
        vehicle_id = prediction.get("vehicle_id")
        if not vehicle_id:
            continue
        current = latest_prediction_by_vehicle.get(vehicle_id)
        if not current or str(prediction.get("predicted_at") or "") > str(current.get("predicted_at") or ""):
            latest_prediction_by_vehicle[vehicle_id] = prediction

    for vehicle_id, prediction in latest_prediction_by_vehicle.items():
        vehicle = vehicle_by_id.get(vehicle_id, {})
        probability = float(prediction.get("probability") or 0)
        source_key = f"generated:ml:{vehicle_id}"
        active_keys.add(source_key)
        upsert_notification(
            admin_client,
            org_id=org_id,
            recipient_profile_id=recipient_id,
            source_key=source_key,
            alert_type="maintenance_high_risk",
            title=f"High maintenance risk: {vehicle.get('plate_no') or 'Vehicle'}",
            message=f"{vehicle.get('plate_no') or 'Vehicle'} has a high maintenance risk score of {probability * 100:.1f}%.",
            severity="danger",
            category="ml",
            action_url="/ml",
            related_entity="maintenance_predictions",
            related_id=prediction.get("id"),
            source_table="maintenance_predictions",
            source_id=prediction.get("id"),
            metadata={"vehicle_id": vehicle_id, "probability": probability},
        )

    existing = (
        admin_client.table("alerts")
        .select("id, source_key")
        .eq("org_id", org_id)
        .eq("recipient_profile_id", recipient_id)
        .is_("resolved_at", "null")
        .execute()
        .data
        or []
    )
    stale_ids = [
        row["id"]
        for row in existing
        if any(str(row.get("source_key") or "").startswith(prefix) for prefix in GENERATED_PREFIXES)
        and row.get("source_key") not in active_keys
    ]
    if stale_ids:
        admin_client.table("alerts").update({"status": "resolved", "resolved_at": _now(), "updated_at": _now()}).in_("id", stale_ids).execute()
