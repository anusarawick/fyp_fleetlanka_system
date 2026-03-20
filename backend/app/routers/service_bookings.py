from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_bearer_token, require_manager_profile
from app.schemas.service_bookings import (
    ServiceBookingCreate,
    ServiceBookingOut,
    ServiceBookingUpdate,
)
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/service-bookings", tags=["service-bookings"])


def _require_token(token: Optional[str]) -> str:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return token


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
    if payload.service_notes is not None or payload.final_cost_lkr is not None or payload.completed_at is not None:
        raise HTTPException(status_code=403, detail="Managers cannot set service notes, price, or completion data when creating bookings")
    data = payload.model_dump(exclude={"service_notes", "final_cost_lkr", "completed_at"})
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
    forbidden_fields = {"status", "service_notes", "final_cost_lkr", "completed_at"}
    attempted_forbidden = forbidden_fields.intersection(updates.keys())
    if attempted_forbidden:
        raise HTTPException(status_code=403, detail="Managers cannot change booking status, service notes, price, or completion data")
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
