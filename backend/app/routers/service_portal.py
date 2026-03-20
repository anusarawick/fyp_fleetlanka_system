from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_current_service_center, require_service_profile
from app.schemas.service_portal import (
    ServicePortalBookingOut,
    ServicePortalBookingUpdate,
    ServicePortalMeOut,
)
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/service-portal", tags=["service-portal"])


def _booking_with_vehicle(row: dict, vehicle_map: dict[str, dict]) -> dict:
    vehicle = vehicle_map.get(row["vehicle_id"], {})
    return {
        **row,
        "vehicle_plate_no": vehicle.get("plate_no"),
        "vehicle_make": vehicle.get("make"),
        "vehicle_model": vehicle.get("model"),
    }


@router.get("/me", response_model=ServicePortalMeOut)
def get_service_portal_me(
    profile: dict = Depends(require_service_profile),
    center: dict = Depends(get_current_service_center),
) -> ServicePortalMeOut:
    admin_client = get_supabase_client(use_service_role=True)
    response = (
        admin_client.table("service_bookings")
        .select("id, status, completed_at")
        .eq("center_id", center["id"])
        .execute()
    )
    bookings = response.data or []
    today = date.today().isoformat()

    summary = {
        "pending_count": sum(1 for row in bookings if row.get("status") == "pending"),
        "confirmed_count": sum(1 for row in bookings if row.get("status") == "confirmed"),
        "completed_today_count": sum(
            1 for row in bookings if row.get("status") == "completed" and str(row.get("completed_at", "")).startswith(today)
        ),
        "total_completed_count": sum(1 for row in bookings if row.get("status") == "completed"),
    }
    return {"center": center, "summary": summary}


@router.get("/bookings", response_model=list[ServicePortalBookingOut])
def list_service_portal_bookings(
    profile: dict = Depends(require_service_profile),
    center: dict = Depends(get_current_service_center),
) -> list[ServicePortalBookingOut]:
    admin_client = get_supabase_client(use_service_role=True)
    bookings_resp = (
        admin_client.table("service_bookings")
        .select("*")
        .eq("center_id", center["id"])
        .order("requested_date")
        .execute()
    )
    bookings = bookings_resp.data or []
    vehicle_ids = [row["vehicle_id"] for row in bookings if row.get("vehicle_id")]
    vehicle_map: dict[str, dict] = {}
    if vehicle_ids:
        vehicles_resp = (
            admin_client.table("vehicles")
            .select("id, plate_no, make, model")
            .in_("id", vehicle_ids)
            .execute()
        )
        vehicle_map = {row["id"]: row for row in (vehicles_resp.data or [])}
    return [_booking_with_vehicle(row, vehicle_map) for row in bookings]


@router.patch("/bookings/{booking_id}", response_model=ServicePortalBookingOut)
def update_service_portal_booking(
    booking_id: str,
    payload: ServicePortalBookingUpdate,
    profile: dict = Depends(require_service_profile),
    center: dict = Depends(get_current_service_center),
) -> ServicePortalBookingOut:
    admin_client = get_supabase_client(use_service_role=True)
    existing_resp = (
        admin_client.table("service_bookings")
        .select("*")
        .eq("id", booking_id)
        .eq("center_id", center["id"])
        .single()
        .execute()
    )
    existing = existing_resp.data
    if not existing:
        raise HTTPException(status_code=404, detail="Booking not found")

    current_status = existing.get("status") or "pending"
    next_status = payload.status or current_status
    allowed_transitions = {
        "pending": {"pending", "confirmed", "cancelled"},
        "confirmed": {"confirmed", "pending", "completed"},
        "cancelled": {"cancelled"},
        "completed": {"completed", "confirmed"},
    }
    if next_status not in allowed_transitions.get(current_status, {current_status}):
        raise HTTPException(status_code=400, detail="Invalid booking status transition")
    if current_status == "confirmed" and next_status == "pending" and not (payload.service_notes or "").strip():
        raise HTTPException(status_code=400, detail="A service note is required when moving a confirmed booking back to pending")
    if current_status == "completed" and next_status == "confirmed" and not (payload.service_notes or "").strip():
        raise HTTPException(status_code=400, detail="A service note is required when reopening a completed booking")

    update_data = payload.model_dump(exclude_none=True)
    if next_status == "completed" and current_status != "completed":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    elif "status" in update_data and next_status != "completed":
        update_data["completed_at"] = None
        if current_status == "completed" and next_status == "confirmed":
            update_data["final_cost_lkr"] = None

    response = (
        admin_client.table("service_bookings")
        .update(update_data)
        .eq("id", booking_id)
        .eq("center_id", center["id"])
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=400, detail="Update failed")

    row = response.data[0]
    vehicle_resp = (
        admin_client.table("vehicles")
        .select("id, plate_no, make, model")
        .eq("id", row["vehicle_id"])
        .single()
        .execute()
    )
    vehicle_map = {vehicle_resp.data["id"]: vehicle_resp.data} if vehicle_resp.data else {}
    return _booking_with_vehicle(row, vehicle_map)
