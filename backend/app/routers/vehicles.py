from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_bearer_token, require_manager_profile
from app.schemas.vehicles import VehicleCreate, VehicleOut, VehicleUpdate
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/vehicles", tags=["vehicles"])

OPERATING_PROFILE_FIELDS = {
    "fuel_type",
    "business_type",
    "road_condition_primary",
    "driver_behavior_profile",
    "expected_kmpl",
    "typical_load_factor",
}
COMPONENT_STATE_FIELDS = {
    "service_interval_km",
    "oil_interval_km",
    "tyre_life_km",
    "brake_life_km",
    "battery_life_months",
    "fuel_filter_interval_km",
    "last_service_odometer_km",
    "last_oil_change_odometer_km",
    "last_tyre_change_odometer_km",
    "last_brake_service_odometer_km",
    "last_fuel_filter_change_odometer_km",
    "battery_installed_at",
}


def _split_vehicle_payload(data: dict) -> tuple[dict, dict, dict]:
    vehicle_data = {k: v for k, v in data.items() if k not in OPERATING_PROFILE_FIELDS | COMPONENT_STATE_FIELDS}
    operating_data = {k: data.get(k) for k in OPERATING_PROFILE_FIELDS if k in data}
    component_data = {k: data.get(k) for k in COMPONENT_STATE_FIELDS if k in data}
    return vehicle_data, operating_data, component_data


def _merge_vehicle_ml_rows(supabase, vehicles: list[dict]) -> list[dict]:
    if not vehicles:
        return []
    vehicle_ids = [row["id"] for row in vehicles if row.get("id")]
    try:
        operating_rows = (
            supabase.table("vehicle_operating_profiles")
            .select("*")
            .in_("vehicle_id", vehicle_ids)
            .execute()
            .data
            or []
        )
        component_rows = (
            supabase.table("vehicle_component_state")
            .select("*")
            .in_("vehicle_id", vehicle_ids)
            .execute()
            .data
            or []
        )
    except Exception:
        return vehicles
    operating_by_vehicle = {row["vehicle_id"]: row for row in operating_rows}
    component_by_vehicle = {row["vehicle_id"]: row for row in component_rows}
    merged = []
    for vehicle in vehicles:
        row = dict(vehicle)
        row.update({k: v for k, v in operating_by_vehicle.get(vehicle["id"], {}).items() if k in OPERATING_PROFILE_FIELDS})
        row.update({k: v for k, v in component_by_vehicle.get(vehicle["id"], {}).items() if k in COMPONENT_STATE_FIELDS})
        merged.append(row)
    return merged


def _upsert_vehicle_ml_rows(supabase, org_id: str, vehicle_id: str, operating_data: dict, component_data: dict) -> None:
    try:
        if operating_data:
            payload = {"org_id": org_id, "vehicle_id": vehicle_id, **operating_data}
            supabase.table("vehicle_operating_profiles").upsert(payload, on_conflict="vehicle_id").execute()
        if component_data:
            payload = {"org_id": org_id, "vehicle_id": vehicle_id, **component_data}
            supabase.table("vehicle_component_state").upsert(payload, on_conflict="vehicle_id").execute()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save vehicle ML profile. Apply migration 20260502_maintenance_v3_live_support.sql. ({exc})",
        ) from exc


@router.get("", response_model=List[VehicleOut])
def list_vehicles(token: Optional[str] = Depends(get_bearer_token)) -> List[VehicleOut]:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    supabase = get_supabase_client(token)
    response = supabase.table("vehicles").select("*").execute()
    return _merge_vehicle_ml_rows(supabase, response.data or [])


@router.post("", response_model=VehicleOut)
def create_vehicle(
    payload: VehicleCreate, 
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token)
) -> VehicleOut:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    
    supabase = get_supabase_client(token)
    data = payload.model_dump(exclude_none=True)
    vehicle_data, operating_data, component_data = _split_vehicle_payload(data)
    if vehicle_data.get("odometer_km") is None and vehicle_data.get("mileage") is not None:
        vehicle_data["odometer_km"] = vehicle_data["mileage"]
    vehicle_data["org_id"] = profile["org_id"]
    response = supabase.table("vehicles").insert(vehicle_data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Insert failed")
    vehicle = response.data[0]
    _upsert_vehicle_ml_rows(supabase, profile["org_id"], vehicle["id"], operating_data, component_data)
    return _merge_vehicle_ml_rows(supabase, [vehicle])[0]


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
    data = payload.model_dump(exclude_none=True)
    vehicle_data, operating_data, component_data = _split_vehicle_payload(data)
    if vehicle_data:
        response = (
            supabase.table("vehicles")
            .update(vehicle_data)
            .eq("id", vehicle_id)
            .eq("org_id", profile["org_id"])
            .execute()
        )
    else:
        response = (
            supabase.table("vehicles")
            .select("*")
            .eq("id", vehicle_id)
            .eq("org_id", profile["org_id"])
            .execute()
        )
    if not response.data:
        raise HTTPException(status_code=400, detail="Update failed")
    _upsert_vehicle_ml_rows(supabase, profile["org_id"], vehicle_id, operating_data, component_data)
    return _merge_vehicle_ml_rows(supabase, [response.data[0]])[0]


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
