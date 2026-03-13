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
    data = payload.model_dump()
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
    response = (
        supabase.table("service_bookings")
        .update(payload.model_dump(exclude_none=True))
        .eq("id", booking_id)
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
    response = supabase.table("service_bookings").delete().eq("id", booking_id).execute()
    if response.data is None:
        raise HTTPException(status_code=400, detail="Delete failed")
    return {"status": "ok"}
