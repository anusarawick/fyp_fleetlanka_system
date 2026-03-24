from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import DRIVER_ROLES, get_bearer_token, get_current_profile
from app.schemas.fuel_logs import FuelLogCreate, FuelLogOut, FuelLogUpdate
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/fuel-logs", tags=["fuel-logs"])


def _require_token(token: Optional[str]) -> str:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return token


@router.get("", response_model=List[FuelLogOut])
def list_fuel_logs(
    profile: dict = Depends(get_current_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> List[FuelLogOut]:
    token = _require_token(token)
    supabase = get_supabase_client(use_service_role=True)
    query = (
        supabase.table("fuel_logs")
        .select("*")
        .eq("org_id", profile["org_id"])
        .order("fuel_date", desc=True)
    )
    if profile.get("role") in DRIVER_ROLES:
        query = query.eq("driver_id", profile["id"])
    response = query.execute()
    return response.data or []


@router.post("", response_model=FuelLogOut)
def create_fuel_log(
    payload: FuelLogCreate, 
    profile: dict = Depends(get_current_profile),
    token: Optional[str] = Depends(get_bearer_token)
) -> FuelLogOut:
    token = _require_token(token)
    org_id = profile["org_id"]
    supabase = get_supabase_client(use_service_role=True)
    data = payload.model_dump()
    data["org_id"] = org_id
    if profile.get("role") in DRIVER_ROLES:
        data["driver_id"] = profile["id"]
    response = supabase.table("fuel_logs").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Insert failed")
    return response.data[0]


@router.patch("/{fuel_id}", response_model=FuelLogOut)
def update_fuel_log(
    fuel_id: str,
    payload: FuelLogUpdate,
    token: Optional[str] = Depends(get_bearer_token),
) -> FuelLogOut:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    response = (
        supabase.table("fuel_logs")
        .update(payload.model_dump(exclude_none=True))
        .eq("id", fuel_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=400, detail="Update failed")
    return response.data[0]


@router.delete("/{fuel_id}")
def delete_fuel_log(
    fuel_id: str, token: Optional[str] = Depends(get_bearer_token)
) -> dict:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    response = supabase.table("fuel_logs").delete().eq("id", fuel_id).execute()
    if response.data is None:
        raise HTTPException(status_code=400, detail="Delete failed")
    return {"status": "ok"}
