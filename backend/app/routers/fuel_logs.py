from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import DRIVER_ROLES, get_bearer_token, get_current_profile
from app.schemas.fuel_logs import FuelLogCreate, FuelLogOut, FuelLogUpdate
from app.services.notifications import manager_profiles, notify_profiles
from app.services.supabase_client import get_supabase_client
from app.services.vehicle_feature_sync import sync_fuel_vehicle_features

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
    if response.data[0].get("vehicle_id"):
        sync_fuel_vehicle_features(supabase, response.data[0]["vehicle_id"])
    fuel_log = response.data[0]
    if profile.get("role") in DRIVER_ROLES:
        notify_profiles(
            supabase,
            manager_profiles(supabase, org_id),
            org_id=org_id,
            source_key=f"event:fuel_log:{fuel_log['id']}:created",
            alert_type="driver_fuel_logged",
            title="Driver fuel log submitted",
            message=f"A driver submitted {fuel_log.get('liters')} L fuel log.",
            severity="info",
            category="fuel",
            action_url="/fuel",
            related_entity="fuel_logs",
            related_id=fuel_log["id"],
            source_table="fuel_logs",
            source_id=fuel_log["id"],
            due_date=fuel_log.get("fuel_date"),
            metadata={"driver_id": profile.get("id"), "vehicle_id": fuel_log.get("vehicle_id")},
        )
    return fuel_log


@router.patch("/{fuel_id}", response_model=FuelLogOut)
def update_fuel_log(
    fuel_id: str,
    payload: FuelLogUpdate,
    token: Optional[str] = Depends(get_bearer_token),
) -> FuelLogOut:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    sync_client = get_supabase_client(use_service_role=True)
    response = (
        supabase.table("fuel_logs")
        .update(payload.model_dump(exclude_none=True))
        .eq("id", fuel_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=400, detail="Update failed")
    if response.data[0].get("vehicle_id"):
        sync_fuel_vehicle_features(sync_client, response.data[0]["vehicle_id"])
    return response.data[0]


@router.delete("/{fuel_id}")
def delete_fuel_log(
    fuel_id: str, token: Optional[str] = Depends(get_bearer_token)
) -> dict:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    sync_client = get_supabase_client(use_service_role=True)
    existing = supabase.table("fuel_logs").select("vehicle_id").eq("id", fuel_id).single().execute()
    vehicle_id = existing.data.get("vehicle_id") if existing.data else None
    response = supabase.table("fuel_logs").delete().eq("id", fuel_id).execute()
    if response.data is None:
        raise HTTPException(status_code=400, detail="Delete failed")
    if vehicle_id:
        sync_fuel_vehicle_features(sync_client, vehicle_id)
    return {"status": "ok"}
