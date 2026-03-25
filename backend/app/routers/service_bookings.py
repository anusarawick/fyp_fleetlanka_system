from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone

from app.core.deps import get_bearer_token, require_manager_profile
from app.schemas.service_bookings import (
    ServiceBookingCreate,
    ServiceBookingOut,
    ServiceBookingReviewDecision,
    ServiceBookingUpdate,
)
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/service-bookings", tags=["service-bookings"])


def _require_token(token: Optional[str]) -> str:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return token


def _derive_maintenance_history(maintenance_count: int) -> str:
    if maintenance_count >= 3:
        return "Good"
    if maintenance_count >= 1:
        return "Average"
    return "Poor"


def _sync_maintenance_from_booking(supabase, booking: dict, center: dict) -> None:
    vehicle_resp = (
        supabase.table("vehicles")
        .select("odometer_km")
        .eq("id", booking["vehicle_id"])
        .single()
        .execute()
    )
    vehicle = vehicle_resp.data or {}
    service_date = str(booking.get("completed_at") or booking.get("requested_date") or "")[:10]
    manager_notes = (booking.get("notes") or "").strip()
    service_notes = (booking.get("service_notes") or "").strip()
    center_name = (center.get("name") or "").strip()
    note_parts = [part for part in [f"Service Center: {center_name}" if center_name else "", manager_notes, service_notes] if part]
    maintenance_data = {
        "org_id": booking["org_id"],
        "vehicle_id": booking["vehicle_id"],
        "service_center_id": booking.get("center_id"),
        "service_booking_id": booking["id"],
        "service_date": service_date,
        "service_type": (booking.get("work_type") or "").strip() or "Booked Service",
        "cost_lkr": booking.get("final_cost_lkr"),
        "odometer_km": vehicle.get("odometer_km"),
        "notes": " | ".join(note_parts) if note_parts else None,
    }
    existing = (
        supabase.table("maintenance")
        .select("id")
        .eq("service_booking_id", booking["id"])
        .execute()
    )
    existing_rows = existing.data or []
    if existing_rows:
        supabase.table("maintenance").update(maintenance_data).eq("id", existing_rows[0]["id"]).execute()
    else:
        supabase.table("maintenance").insert(maintenance_data).execute()


@router.get("", response_model=List[ServiceBookingOut])
def list_bookings(
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> List[ServiceBookingOut]:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    response = supabase.table("service_bookings").select("*").execute()
    return response.data or []


@router.post("", response_model=ServiceBookingOut)
def create_booking(
    payload: ServiceBookingCreate, 
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token)
) -> ServiceBookingOut:
    token = _require_token(token)
    org_id = profile["org_id"]
    supabase = get_supabase_client(token)
    if payload.status not in (None, "pending"):
        raise HTTPException(status_code=403, detail="Managers can only create pending bookings")
    forbidden_create_fields = [
        payload.service_notes,
        payload.final_cost_lkr,
        payload.completed_at,
        payload.proposed_tire_condition,
        payload.proposed_brake_condition,
        payload.proposed_battery_status,
        payload.completion_review_status,
        payload.completion_review_notes,
        payload.completion_reviewed_at,
        payload.completion_reviewed_by,
    ]
    if any(value is not None for value in forbidden_create_fields):
        raise HTTPException(status_code=403, detail="Managers cannot set service-center completion or review data when creating bookings")
    data = payload.model_dump(
        exclude={
            "service_notes",
            "final_cost_lkr",
            "completed_at",
            "proposed_tire_condition",
            "proposed_brake_condition",
            "proposed_battery_status",
            "completion_review_status",
            "completion_review_notes",
            "completion_reviewed_at",
            "completion_reviewed_by",
        }
    )
    data["status"] = "pending"
    data["org_id"] = org_id
    response = supabase.table("service_bookings").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Insert failed")
    return response.data[0]


@router.patch("/{booking_id}", response_model=ServiceBookingOut)
def update_booking(
    booking_id: str,
    payload: ServiceBookingUpdate,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> ServiceBookingOut:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    existing = (
        supabase.table("service_bookings")
        .select("*")
        .eq("id", booking_id)
        .eq("org_id", profile["org_id"])
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    if (existing.data.get("status") or "pending") != "pending":
        raise HTTPException(status_code=403, detail="Managers can only edit pending bookings")
    updates = payload.model_dump(exclude_none=True)
    forbidden_fields = {
        "status",
        "service_notes",
        "final_cost_lkr",
        "completed_at",
        "proposed_tire_condition",
        "proposed_brake_condition",
        "proposed_battery_status",
        "completion_review_status",
        "completion_review_notes",
        "completion_reviewed_at",
        "completion_reviewed_by",
    }
    attempted_forbidden = forbidden_fields.intersection(updates.keys())
    if attempted_forbidden:
        raise HTTPException(status_code=403, detail="Managers cannot change service-center completion or review fields from the standard booking editor")
    if not updates:
        return existing.data
    response = (
        supabase.table("service_bookings")
        .update(updates)
        .eq("id", booking_id)
        .eq("org_id", profile["org_id"])
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=400, detail="Update failed")
    return response.data[0]


@router.delete("/{booking_id}")
def delete_booking(
    booking_id: str,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token)
) -> dict:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    existing = (
        supabase.table("service_bookings")
        .select("*")
        .eq("id", booking_id)
        .eq("org_id", profile["org_id"])
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    if (existing.data.get("status") or "pending") != "pending":
        raise HTTPException(status_code=403, detail="Managers can only delete pending bookings")
    response = (
        supabase.table("service_bookings")
        .delete()
        .eq("id", booking_id)
        .eq("org_id", profile["org_id"])
        .execute()
    )
    if response.data is None:
        raise HTTPException(status_code=400, detail="Delete failed")
    return {"status": "ok"}


@router.post("/{booking_id}/approve-completion", response_model=ServiceBookingOut)
def approve_completed_booking(
    booking_id: str,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> ServiceBookingOut:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    booking_resp = (
        supabase.table("service_bookings")
        .select("*")
        .eq("id", booking_id)
        .eq("org_id", profile["org_id"])
        .single()
        .execute()
    )
    booking = booking_resp.data
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if (booking.get("status") or "pending") != "completed":
        raise HTTPException(status_code=400, detail="Only completed bookings can be approved")
    if booking.get("completion_review_status") == "approved":
        return booking

    vehicle_resp = (
        supabase.table("vehicles")
        .select("*")
        .eq("id", booking["vehicle_id"])
        .single()
        .execute()
    )
    vehicle = vehicle_resp.data
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    center_resp = (
        supabase.table("service_centers")
        .select("*")
        .eq("id", booking["center_id"])
        .single()
        .execute()
    )
    if center_resp.data:
        try:
            _sync_maintenance_from_booking(supabase, booking, center_resp.data)
        except Exception as exc:
            message = str(exc)
            if "service_booking_id" in message or "service_center_id" in message:
                raise HTTPException(
                    status_code=500,
                    detail="Maintenance approval sync failed. Run migrations 20260321_service_booking_maintenance_sync.sql and 20260321_service_completion_review.sql, then restart backend.",
                ) from exc
            raise HTTPException(status_code=500, detail=f"Maintenance approval sync failed: {message}") from exc

    maintenance_resp = (
        supabase.table("maintenance")
        .select("id")
        .eq("vehicle_id", booking["vehicle_id"])
        .eq("org_id", profile["org_id"])
        .execute()
    )
    maintenance_count = len(maintenance_resp.data or [])
    vehicle_updates = {
        "status": "active",
        "maintenance_history": _derive_maintenance_history(maintenance_count),
        "reported_issues_count": int(vehicle.get("reported_issues_count") or 0) + 1,
    }
    if booking.get("proposed_tire_condition"):
        vehicle_updates["tire_condition"] = booking["proposed_tire_condition"]
    if booking.get("proposed_brake_condition"):
        vehicle_updates["brake_condition"] = booking["proposed_brake_condition"]
    if booking.get("proposed_battery_status"):
        vehicle_updates["battery_status"] = booking["proposed_battery_status"]

    supabase.table("vehicles").update(vehicle_updates).eq("id", booking["vehicle_id"]).execute()

    review_updates = {
        "completion_review_status": "approved",
        "completion_reviewed_at": datetime.now(timezone.utc).isoformat(),
        "completion_reviewed_by": profile["id"],
    }
    response = (
        supabase.table("service_bookings")
        .update(review_updates)
        .eq("id", booking_id)
        .eq("org_id", profile["org_id"])
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=400, detail="Approval update failed")
    return response.data[0]


@router.post("/{booking_id}/reject-completion", response_model=ServiceBookingOut)
def reject_completed_booking(
    booking_id: str,
    payload: ServiceBookingReviewDecision,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> ServiceBookingOut:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    booking_resp = (
        supabase.table("service_bookings")
        .select("*")
        .eq("id", booking_id)
        .eq("org_id", profile["org_id"])
        .single()
        .execute()
    )
    booking = booking_resp.data
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if (booking.get("status") or "pending") != "completed":
        raise HTTPException(status_code=400, detail="Only completed bookings can be rejected")
    if booking.get("completion_review_status") == "approved":
        raise HTTPException(status_code=400, detail="Approved bookings cannot be rejected")

    note = (payload.note or "").strip()
    if not note:
        raise HTTPException(status_code=400, detail="A rejection reason is required")

    review_updates = {
        "completion_review_status": "rejected",
        "completion_review_notes": note,
        "completion_reviewed_at": datetime.now(timezone.utc).isoformat(),
        "completion_reviewed_by": profile["id"],
    }
    response = (
        supabase.table("service_bookings")
        .update(review_updates)
        .eq("id", booking_id)
        .eq("org_id", profile["org_id"])
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=400, detail="Rejection update failed")
    return response.data[0]
