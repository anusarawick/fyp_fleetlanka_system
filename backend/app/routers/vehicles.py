from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_bearer_token, require_manager_profile
from app.schemas.vehicles import VehicleCreate, VehicleOut, VehicleUpdate
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@router.get("", response_model=List[VehicleOut])
def list_vehicles(token: Optional[str] = Depends(get_bearer_token)) -> List[VehicleOut]:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    supabase = get_supabase_client(token)
    response = supabase.table("vehicles").select("*").execute()
    return response.data or []


@router.post("", response_model=VehicleOut)
def create_vehicle(
    payload: VehicleCreate, 
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token)
) -> VehicleOut:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    
    supabase = get_supabase_client(token)
    data = payload.model_dump()
    data["org_id"] = profile["org_id"]
    response = supabase.table("vehicles").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Insert failed")
    return response.data[0]


@router.patch("/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(
    vehicle_id: str,
    payload: VehicleUpdate,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> VehicleOut:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    supabase = get_supabase_client(token)
    response = (
        supabase.table("vehicles")
        .update(payload.model_dump(exclude_none=True))
        .eq("id", vehicle_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=400, detail="Update failed")
    return response.data[0]


@router.delete("/{vehicle_id}")
def delete_vehicle(
    vehicle_id: str,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token)
) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    supabase = get_supabase_client(token)
    response = supabase.table("vehicles").delete().eq("id", vehicle_id).execute()
    if response.data is None:
        raise HTTPException(status_code=400, detail="Delete failed")
    return {"status": "ok"}
