from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_bearer_token, require_manager_profile
from app.schemas.maintenance import MaintenanceCreate, MaintenanceOut, MaintenanceUpdate
from app.services.maintenance_sync import requires_component_odometer, sync_manual_maintenance_effects
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


def _require_token(token: Optional[str]) -> str:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return token


@router.get("", response_model=List[MaintenanceOut])
def list_maintenance(
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> List[MaintenanceOut]:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    response = (
        supabase.table("maintenance").select("*").order("service_date", desc=True).execute()
    )
    return response.data or []


@router.post("", response_model=MaintenanceOut)
def create_maintenance(
    payload: MaintenanceCreate, 
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token)
) -> MaintenanceOut:
    token = _require_token(token)
    org_id = profile["org_id"]
    supabase = get_supabase_client(token)
    data = payload.model_dump()
    data["org_id"] = org_id
    if requires_component_odometer(data) and data.get("odometer_km") is None:
        raise HTTPException(status_code=400, detail="Odometer is required for component maintenance events")
    response = supabase.table("maintenance").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Insert failed")
    sync_manual_maintenance_effects(supabase, org_id, response.data[0])
    return response.data[0]


@router.patch("/{maintenance_id}", response_model=MaintenanceOut)
def update_maintenance(
    maintenance_id: str,
    payload: MaintenanceUpdate,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> MaintenanceOut:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    existing = (
        supabase.table("maintenance")
        .select("*")
        .eq("id", maintenance_id)
        .eq("org_id", profile["org_id"])
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    updates = payload.model_dump(exclude_none=True)
    merged = {**existing.data, **updates}
    if requires_component_odometer(merged) and merged.get("odometer_km") is None:
        raise HTTPException(status_code=400, detail="Odometer is required for component maintenance events")
    response = (
        supabase.table("maintenance")
        .update(updates)
        .eq("id", maintenance_id)
        .eq("org_id", profile["org_id"])
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=400, detail="Update failed")
    sync_manual_maintenance_effects(supabase, profile["org_id"], response.data[0])
    return response.data[0]


@router.delete("/{maintenance_id}")
def delete_maintenance(
    maintenance_id: str,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token)
) -> dict:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    response = supabase.table("maintenance").delete().eq("id", maintenance_id).execute()
    if response.data is None:
        raise HTTPException(status_code=400, detail="Delete failed")
    return {"status": "ok"}
