from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_bearer_token, get_current_profile
from app.schemas.gps_points import GPSPointCreate
from app.schemas.trips import TripCreate, TripOut, TripUpdate
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/trips", tags=["trips"])


def _require_token(token: Optional[str]) -> str:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return token


@router.get("", response_model=List[TripOut])
def list_trips(token: Optional[str] = Depends(get_bearer_token)) -> List[TripOut]:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    response = supabase.table("trips").select("*").order("start_time", desc=True).execute()
    return response.data or []


@router.post("", response_model=TripOut)
def create_trip(
    payload: TripCreate, 
    profile: dict = Depends(get_current_profile),
    token: Optional[str] = Depends(get_bearer_token)
) -> TripOut:
    token = _require_token(token)
    org_id = profile["org_id"]
    supabase = get_supabase_client(token)
    data = payload.model_dump()
    data["org_id"] = org_id
    response = supabase.table("trips").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Insert failed")
    return response.data[0]


@router.patch("/{trip_id}", response_model=TripOut)
def update_trip(
    trip_id: str, payload: TripUpdate, token: Optional[str] = Depends(get_bearer_token)
) -> TripOut:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    response = (
        supabase.table("trips").update(payload.model_dump(exclude_none=True)).eq("id", trip_id).execute()
    )
    if not response.data:
        raise HTTPException(status_code=400, detail="Update failed")
    return response.data[0]


@router.post("/{trip_id}/points")
def add_gps_point(
    trip_id: str, payload: GPSPointCreate, token: Optional[str] = Depends(get_bearer_token)
) -> dict:
    token = _require_token(token)
    if payload.trip_id != trip_id:
        raise HTTPException(status_code=400, detail="trip_id mismatch")
    supabase = get_supabase_client(token)
    response = supabase.table("gps_points").insert(payload.model_dump()).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Insert failed")
    return {"status": "ok"}


@router.delete("/{trip_id}")
def delete_trip(trip_id: str, token: Optional[str] = Depends(get_bearer_token)) -> dict:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    response = supabase.table("trips").delete().eq("id", trip_id).execute()
    if response.data is None:
        raise HTTPException(status_code=400, detail="Delete failed")
    return {"status": "ok"}
