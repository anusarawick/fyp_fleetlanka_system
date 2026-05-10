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
from app.services.maintenance_sync import remove_maintenance_for_booking
from app.services.payment_sync import reconcile_service_booking_payments
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


def _attach_latest_payment_summaries(bookings: list[dict], admin_client, org_id: str, center_id: str) -> list[dict]:
    booking_ids = [booking["id"] for booking in bookings if booking.get("id")]
    if not booking_ids:
        return bookings

    payments_resp = (
        admin_client.table("service_booking_payments")
        .select(
            "id, booking_id, status, amount_lkr, currency, stripe_checkout_session_id, "
            "stripe_payment_intent_id, stripe_transfer_destination, paid_at, created_at"
        )
        .eq("org_id", org_id)
        .eq("service_center_id", center_id)
        .in_("booking_id", booking_ids)
        .order("created_at", desc=True)
        .execute()
    )
    latest_by_booking: dict[str, dict] = {}
    for payment in payments_resp.data or []:
        booking_id = payment.get("booking_id")
        if booking_id and booking_id not in latest_by_booking:
            payment_summary = dict(payment)
            payment_summary.pop("booking_id", None)
            latest_by_booking[booking_id] = payment_summary

    for booking in bookings:
        booking["payment"] = latest_by_booking.get(booking.get("id"))
    return bookings


def _set_vehicle_status(admin_client, vehicle_id: str, status: str) -> None:
    admin_client.table("vehicles").update({"status": status}).eq("id", vehicle_id).execute()


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
    reconcile_service_booking_payments(admin_client, center["org_id"])
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
    bookings = _attach_latest_payment_summaries(bookings, admin_client, center["org_id"], center["id"])
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
    if (
        current_status == "completed"
        and existing.get("completion_review_status") == "approved"
        and next_status == "completed"
    ):
        raise HTTPException(status_code=403, detail="Approved completion details are locked. Reopen the booking first to make changes.")
    if current_status == "confirmed" and next_status == "pending" and not (payload.service_notes or "").strip():
        raise HTTPException(status_code=400, detail="A service note is required when moving a confirmed booking back to pending")
    if current_status == "completed" and next_status == "confirmed" and not (payload.service_notes or "").strip():
        raise HTTPException(status_code=400, detail="A service note is required when reopening a completed booking")
    if next_status == "completed" and not (payload.work_type or existing.get("work_type") or "").strip():
        raise HTTPException(status_code=400, detail="Work type is required when completing a booking")
    if next_status == "completed" and payload.completed_odometer_km is None and existing.get("completed_odometer_km") is None:
        raise HTTPException(status_code=400, detail="Completed odometer is required when completing a booking")

    update_data = payload.model_dump(exclude_none=True)
    if next_status == "completed" and current_status != "completed":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        update_data["completion_review_status"] = "pending"
        update_data["completion_review_notes"] = None
        update_data["completion_reviewed_at"] = None
        update_data["completion_reviewed_by"] = None
    elif "status" in update_data and next_status != "completed":
        update_data["completed_at"] = None
        update_data["completion_review_status"] = None
        update_data["completion_review_notes"] = None
        update_data["completion_reviewed_at"] = None
        update_data["completion_reviewed_by"] = None
        if current_status == "completed" and next_status == "confirmed":
            update_data["final_cost_lkr"] = None
            update_data["next_service_due_km"] = None
            update_data["completed_odometer_km"] = None
            update_data["proposed_tire_condition"] = None
            update_data["proposed_brake_condition"] = None
            update_data["proposed_battery_status"] = None

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
    if current_status == "pending" and next_status == "confirmed":
        _set_vehicle_status(admin_client, row["vehicle_id"], "maintenance")
    elif current_status == "pending" and next_status == "cancelled":
        _set_vehicle_status(admin_client, row["vehicle_id"], "active")
    elif current_status == "confirmed" and next_status == "pending":
        _set_vehicle_status(admin_client, row["vehicle_id"], "active")
    elif current_status == "completed" and next_status == "confirmed":
        _set_vehicle_status(admin_client, row["vehicle_id"], "maintenance")

    try:
        if current_status == "completed" and next_status != "completed":
            remove_maintenance_for_booking(admin_client, row["id"])
    except Exception as exc:
        message = str(exc)
        if "service_booking_id" in message or "service_center_id" in message or "event_type" in message:
            raise HTTPException(
                status_code=500,
                detail="Maintenance sync failed. Run migrations 20260321_service_booking_maintenance_sync.sql and 20260502_maintenance_v3_live_support.sql, then restart backend.",
            ) from exc
        raise HTTPException(status_code=500, detail=f"Maintenance sync failed: {message}") from exc

    vehicle_resp = (
        admin_client.table("vehicles")
        .select("id, plate_no, make, model")
        .eq("id", row["vehicle_id"])
        .single()
        .execute()
    )
    vehicle_map = {vehicle_resp.data["id"]: vehicle_resp.data} if vehicle_resp.data else {}
    return _booking_with_vehicle(row, vehicle_map)
