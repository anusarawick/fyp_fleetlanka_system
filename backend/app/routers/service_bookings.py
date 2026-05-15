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
from app.services.maintenance_sync import upsert_maintenance_from_booking
from app.services.notifications import service_profile_for_center, upsert_notification
from app.services.payment_sync import reconcile_service_booking_payments
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


def _attach_latest_payment_summaries(bookings: list[dict], admin_client, org_id: str) -> list[dict]:
    booking_ids = [booking["id"] for booking in bookings if booking.get("id")]
    if not booking_ids:
        return bookings

    payments_response = (
        admin_client.table("service_booking_payments")
        .select(
            "id, booking_id, status, amount_lkr, currency, stripe_checkout_session_id, "
            "stripe_payment_intent_id, stripe_transfer_destination, paid_at, created_at"
        )
        .eq("org_id", org_id)
        .in_("booking_id", booking_ids)
        .order("created_at", desc=True)
        .execute()
    )
    latest_by_booking: dict[str, dict] = {}
    for payment in payments_response.data or []:
        booking_id = payment.get("booking_id")
        if booking_id and booking_id not in latest_by_booking:
            payment_summary = dict(payment)
            payment_summary.pop("booking_id", None)
            latest_by_booking[booking_id] = payment_summary

    for booking in bookings:
        booking["payment"] = latest_by_booking.get(booking.get("id"))
    return bookings


@router.get("", response_model=List[ServiceBookingOut])
def list_bookings(
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> List[ServiceBookingOut]:
    token = _require_token(token)
    admin_client = get_supabase_client(use_service_role=True)
    reconcile_service_booking_payments(admin_client, profile["org_id"])
    supabase = get_supabase_client(token)
    response = supabase.table("service_bookings").select("*").eq("org_id", profile["org_id"]).execute()
    return _attach_latest_payment_summaries(response.data or [], admin_client, profile["org_id"])


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
        payload.next_service_due_km,
        payload.completed_at,
        payload.completed_odometer_km,
        payload.proposed_tire_condition,
        payload.proposed_brake_condition,
        payload.proposed_battery_status,
        payload.completion_review_status,
        payload.completion_review_notes,
        payload.completion_reviewed_at,
        payload.completion_reviewed_by,
        payload.payment_status,
    ]
    if any(value is not None for value in forbidden_create_fields):
        raise HTTPException(status_code=403, detail="Managers cannot set service-center completion or review data when creating bookings")
    data = payload.model_dump(
        exclude={
            "service_notes",
            "final_cost_lkr",
            "next_service_due_km",
            "completed_at",
            "completed_odometer_km",
            "proposed_tire_condition",
            "proposed_brake_condition",
            "proposed_battery_status",
            "completion_review_status",
            "completion_review_notes",
            "completion_reviewed_at",
            "completion_reviewed_by",
            "payment_status",
        }
    )
    data["status"] = "pending"
    data["org_id"] = org_id
    response = supabase.table("service_bookings").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Insert failed")
    booking = response.data[0]
    admin_client = get_supabase_client(use_service_role=True)
    service_profile = service_profile_for_center(admin_client, booking.get("center_id"), org_id)
    if service_profile:
        upsert_notification(
            admin_client,
            org_id=org_id,
            recipient_profile_id=service_profile["id"],
            source_key=f"event:service_booking:{booking['id']}:created",
            alert_type="service_booking_created",
            title="New service booking",
            message="A manager assigned a new service booking to your center.",
            severity="info",
            category="bookings",
            action_url="/service/bookings",
            related_entity="service_bookings",
            related_id=booking["id"],
            source_table="service_bookings",
            source_id=booking["id"],
            due_date=booking.get("requested_date"),
            metadata={"vehicle_id": booking.get("vehicle_id")},
        )
    return booking


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
        "next_service_due_km",
        "completed_at",
        "completed_odometer_km",
        "proposed_tire_condition",
        "proposed_brake_condition",
        "proposed_battery_status",
        "completion_review_status",
        "completion_review_notes",
        "completion_reviewed_at",
        "completion_reviewed_by",
        "payment_status",
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
    booking = response.data[0]
    admin_client = get_supabase_client(use_service_role=True)
    service_profile = service_profile_for_center(admin_client, booking.get("center_id"), profile["org_id"])
    if service_profile:
        upsert_notification(
            admin_client,
            org_id=profile["org_id"],
            recipient_profile_id=service_profile["id"],
            source_key=f"event:service_booking:{booking['id']}:manager_updated",
            alert_type="service_booking_updated",
            title="Service booking updated",
            message="A manager updated a service booking assigned to your center.",
            severity="info",
            category="bookings",
            action_url="/service/bookings",
            related_entity="service_bookings",
            related_id=booking["id"],
            source_table="service_bookings",
            source_id=booking["id"],
            due_date=booking.get("requested_date"),
            metadata={"vehicle_id": booking.get("vehicle_id")},
        )
    return booking


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
    admin_client = get_supabase_client(use_service_role=True)
    service_profile = service_profile_for_center(admin_client, existing.data.get("center_id"), profile["org_id"])
    if service_profile:
        upsert_notification(
            admin_client,
            org_id=profile["org_id"],
            recipient_profile_id=service_profile["id"],
            source_key=f"event:service_booking:{booking_id}:deleted",
            alert_type="service_booking_cancelled",
            title="Service booking removed",
            message="A manager removed a pending service booking.",
            severity="warning",
            category="bookings",
            action_url="/service/bookings",
            related_entity="service_bookings",
            related_id=booking_id,
            source_table="service_bookings",
            source_id=booking_id,
            due_date=existing.data.get("requested_date"),
            metadata={"vehicle_id": existing.data.get("vehicle_id")},
        )
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
    if booking.get("completed_odometer_km") is None:
        raise HTTPException(status_code=400, detail="Completed odometer is required before approval")
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
            upsert_maintenance_from_booking(supabase, booking, center_resp.data)
        except Exception as exc:
            message = str(exc)
            if "service_booking_id" in message or "service_center_id" in message or "event_type" in message:
                raise HTTPException(
                    status_code=500,
                    detail="Maintenance approval sync failed. Run migrations 20260321_service_booking_maintenance_sync.sql, 20260321_service_completion_review.sql, and 20260502_maintenance_v3_live_support.sql, then restart backend.",
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
    updated = response.data[0]
    admin_client = get_supabase_client(use_service_role=True)
    service_profile = service_profile_for_center(admin_client, updated.get("center_id"), profile["org_id"])
    if service_profile:
        upsert_notification(
            admin_client,
            org_id=profile["org_id"],
            recipient_profile_id=service_profile["id"],
            source_key=f"event:service_booking:{booking_id}:approved",
            alert_type="service_completion_approved",
            title="Service completion approved",
            message="The manager approved your completed service booking.",
            severity="success",
            category="approvals",
            action_url="/service/bookings",
            related_entity="service_bookings",
            related_id=booking_id,
            source_table="service_bookings",
            source_id=booking_id,
            due_date=updated.get("requested_date"),
            metadata={"vehicle_id": updated.get("vehicle_id")},
        )
    return updated


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
    updated = response.data[0]
    admin_client = get_supabase_client(use_service_role=True)
    service_profile = service_profile_for_center(admin_client, updated.get("center_id"), profile["org_id"])
    if service_profile:
        upsert_notification(
            admin_client,
            org_id=profile["org_id"],
            recipient_profile_id=service_profile["id"],
            source_key=f"event:service_booking:{booking_id}:rejected",
            alert_type="service_completion_rejected",
            title="Service completion rejected",
            message=f"Manager rejected the completion review: {note}",
            severity="danger",
            category="approvals",
            action_url="/service/bookings",
            related_entity="service_bookings",
            related_id=booking_id,
            source_table="service_bookings",
            source_id=booking_id,
            due_date=updated.get("requested_date"),
            metadata={"vehicle_id": updated.get("vehicle_id")},
        )
    return updated
