from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_bearer_token, require_manager_profile
from app.schemas.maintenance import MaintenanceCreate, MaintenanceOut, MaintenanceUpdate
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


def _require_token(token: Optional[str]) -> str:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return token


def _maintenance_kind(row: dict) -> str:
    raw = (row.get("event_type") or row.get("service_type") or "").lower().replace(" ", "_").replace("-", "_")
    if "oil" in raw:
        return "oil"
    if "tyre" in raw or "tire" in raw:
        return "tyre"
    if "brake" in raw:
        return "brake"
    if "fuel" in raw and "filter" in raw:
        return "fuel_filter"
    if "service" in raw:
        return "service"
    return raw


def _sync_component_state_from_maintenance(supabase, org_id: str, record: dict) -> None:
    odometer = record.get("odometer_km")
    if not record.get("vehicle_id") or odometer is None:
        return
    updates = {
        "org_id": org_id,
        "vehicle_id": record["vehicle_id"],
    }
    kind = _maintenance_kind(record)
    if kind in {"service", "regular_service"}:
        updates["last_service_odometer_km"] = odometer
    elif kind == "oil":
        updates["last_oil_change_odometer_km"] = odometer
    elif kind == "tyre":
        updates["last_tyre_change_odometer_km"] = odometer
    elif kind == "brake":
        updates["last_brake_service_odometer_km"] = odometer
    elif kind == "fuel_filter":
        updates["last_fuel_filter_change_odometer_km"] = odometer
    if len(updates) > 2:
        try:
            supabase.table("vehicle_component_state").upsert(updates, on_conflict="vehicle_id").execute()
        except Exception:
            return


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
    response = supabase.table("maintenance").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Insert failed")
    _sync_component_state_from_maintenance(supabase, org_id, response.data[0])
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
    response = (
        supabase.table("maintenance")
        .update(payload.model_dump(exclude_none=True))
        .eq("id", maintenance_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=400, detail="Update failed")
    _sync_component_state_from_maintenance(supabase, profile["org_id"], response.data[0])
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
