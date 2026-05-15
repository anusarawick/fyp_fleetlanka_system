from __future__ import annotations

from typing import Any

from app.services.vehicle_feature_sync import sync_service_maintenance_vehicle_features


COMPONENT_RESET_KINDS = {"service", "oil", "tyre", "brake", "battery", "fuel_filter"}


def normalize_maintenance_kind(value: Any) -> str:
    raw = str(value or "").strip().lower().replace(" ", "_").replace("-", "_")
    if not raw:
        return "service"
    if "oil" in raw:
        return "oil"
    if "tyre" in raw or "tire" in raw:
        return "tyre"
    if "brake" in raw:
        return "brake"
    if "battery" in raw:
        return "battery"
    if "fuel" in raw and ("filter" in raw or "system" in raw):
        return "fuel_filter"
    if "repair" in raw:
        return "repair"
    if "inspect" in raw or "check" in raw:
        return "inspection"
    if "service" in raw:
        return "service"
    return raw


def maintenance_kind(record: dict[str, Any]) -> str:
    return normalize_maintenance_kind(record.get("event_type") or record.get("service_type") or record.get("work_type"))


def default_event_category(kind: str) -> str:
    if kind == "repair":
        return "repair"
    if kind == "inspection":
        return "inspection"
    if kind == "service":
        return "scheduled"
    return "component"


def default_severity(kind: str) -> str:
    return "minor" if kind == "repair" else "routine"


def requires_component_odometer(record: dict[str, Any]) -> bool:
    return maintenance_kind(record) in COMPONENT_RESET_KINDS


def sync_component_state_from_maintenance(supabase: Any, org_id: str, record: dict[str, Any]) -> None:
    odometer = record.get("odometer_km")
    vehicle_id = record.get("vehicle_id")
    if not vehicle_id or odometer is None:
        return

    kind = maintenance_kind(record)
    updates: dict[str, Any] = {
        "org_id": org_id,
        "vehicle_id": vehicle_id,
    }
    if kind == "service":
        updates["last_service_odometer_km"] = odometer
        updates["last_oil_change_odometer_km"] = odometer
    elif kind == "oil":
        updates["last_oil_change_odometer_km"] = odometer
    elif kind == "tyre":
        updates["last_tyre_change_odometer_km"] = odometer
    elif kind == "brake":
        updates["last_brake_service_odometer_km"] = odometer
    elif kind == "battery":
        updates["battery_installed_at"] = record.get("service_date")
    elif kind == "fuel_filter":
        updates["last_fuel_filter_change_odometer_km"] = odometer

    if len(updates) > 2:
        supabase.table("vehicle_component_state").upsert(updates, on_conflict="vehicle_id").execute()


def sync_vehicle_cached_maintenance_fields(supabase: Any, record: dict[str, Any]) -> None:
    vehicle_id = record.get("vehicle_id")
    if not vehicle_id:
        return
    sync_service_maintenance_vehicle_features(
        supabase,
        vehicle_id,
        last_service_cost_lkr=record.get("cost_lkr"),
        next_service_due_km=record.get("next_service_due_km"),
    )


def sync_manual_maintenance_effects(supabase: Any, org_id: str, record: dict[str, Any]) -> None:
    sync_component_state_from_maintenance(supabase, org_id, record)
    sync_vehicle_cached_maintenance_fields(supabase, record)


def build_maintenance_from_booking(booking: dict[str, Any], center: dict[str, Any]) -> dict[str, Any]:
    service_date = str(booking.get("completed_at") or booking.get("requested_date") or "")[:10]
    work_type = (booking.get("work_type") or "").strip() or "Regular Service"
    kind = maintenance_kind({"event_type": work_type})
    manager_notes = (booking.get("notes") or "").strip()
    service_notes = (booking.get("service_notes") or "").strip()
    center_name = (center.get("name") or "").strip()
    note_parts = [part for part in [f"Service Center: {center_name}" if center_name else "", manager_notes, service_notes] if part]
    return {
        "org_id": booking["org_id"],
        "vehicle_id": booking["vehicle_id"],
        "service_center_id": booking.get("center_id"),
        "service_booking_id": booking["id"],
        "service_date": service_date,
        "service_type": work_type,
        "event_type": work_type,
        "event_category": default_event_category(kind),
        "severity": default_severity(kind),
        "cost_lkr": booking.get("final_cost_lkr"),
        "odometer_km": booking.get("completed_odometer_km"),
        "next_service_due_km": booking.get("next_service_due_km"),
        "notes": " | ".join(note_parts) if note_parts else None,
    }


def upsert_maintenance_from_booking(supabase: Any, booking: dict[str, Any], center: dict[str, Any]) -> dict[str, Any] | None:
    data = build_maintenance_from_booking(booking, center)
    existing = (
        supabase.table("maintenance")
        .select("id")
        .eq("service_booking_id", booking["id"])
        .execute()
    )
    existing_rows = existing.data or []
    if existing_rows:
        response = supabase.table("maintenance").update(data).eq("id", existing_rows[0]["id"]).execute()
    else:
        response = supabase.table("maintenance").insert(data).execute()
    record = (response.data or [None])[0]
    if record:
        sync_manual_maintenance_effects(supabase, booking["org_id"], record)
    return record


def remove_maintenance_for_booking(supabase: Any, booking_id: str) -> None:
    supabase.table("maintenance").delete().eq("service_booking_id", booking_id).execute()
