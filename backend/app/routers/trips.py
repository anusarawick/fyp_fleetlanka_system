from typing import List, Optional
from datetime import datetime, timezone
import math

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import (
    get_bearer_token,
    require_manager_or_driver_profile,
)
from app.schemas.gps_points import GPSPointCreate
from app.schemas.trips import TripCreate, TripOut, TripUpdate
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/trips", tags=["trips"])


def _parse_iso_datetime(value: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(a))


def _to_float(value: object) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _compute_trip_metrics(supabase, trip_id: str, trip: dict) -> dict:
    points_response = (
        supabase.table("gps_points")
        .select("recorded_at,lat,lon,speed_kmh")
        .eq("trip_id", trip_id)
        .order("recorded_at")
        .execute()
    )
    points = points_response.data or []

    start_time = _parse_iso_datetime(trip.get("start_time", ""))
    end_time = _parse_iso_datetime(trip.get("end_time", ""))

    duration_min: Optional[float] = None
    if start_time and end_time:
        duration_min = max(0.0, (end_time - start_time).total_seconds() / 60.0)

    distance_km = 0.0
    idle_seconds = 0.0
    start_lat = trip.get("start_lat")
    start_lon = trip.get("start_lon")
    end_lat = trip.get("end_lat")
    end_lon = trip.get("end_lon")

    if points:
        first_point = points[0]
        last_point = points[-1]
        start_lat = start_lat if start_lat is not None else first_point.get("lat")
        start_lon = start_lon if start_lon is not None else first_point.get("lon")
        end_lat = end_lat if end_lat is not None else last_point.get("lat")
        end_lon = end_lon if end_lon is not None else last_point.get("lon")

    for idx in range(len(points) - 1):
        current = points[idx]
        nxt = points[idx + 1]

        lat1 = _to_float(current.get("lat"))
        lon1 = _to_float(current.get("lon"))
        lat2 = _to_float(nxt.get("lat"))
        lon2 = _to_float(nxt.get("lon"))
        if None not in (lat1, lon1, lat2, lon2):
            distance_km += _haversine_km(lat1, lon1, lat2, lon2)

        current_time = _parse_iso_datetime(str(current.get("recorded_at", "")))
        next_time = _parse_iso_datetime(str(nxt.get("recorded_at", "")))
        speed = _to_float(current.get("speed_kmh"))
        if current_time and next_time and speed is not None and speed <= 5:
            delta_sec = max(0.0, (next_time - current_time).total_seconds())
            idle_seconds += min(delta_sec, 300.0)

    avg_speed_kmh: Optional[float] = None
    if duration_min and duration_min > 0:
        avg_speed_kmh = distance_km / (duration_min / 60.0)

    return {
        "distance_km": round(distance_km, 3),
        "duration_min": round(duration_min, 2) if duration_min is not None else None,
        "avg_speed_kmh": round(avg_speed_kmh, 2) if avg_speed_kmh is not None else None,
        "idle_min": round(idle_seconds / 60.0, 2),
        "start_lat": _to_float(start_lat),
        "start_lon": _to_float(start_lon),
        "end_lat": _to_float(end_lat),
        "end_lon": _to_float(end_lon),
    }


def _require_token(token: Optional[str]) -> str:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return token


@router.get("", response_model=List[TripOut])
def list_trips(
    profile: dict = Depends(require_manager_or_driver_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> List[TripOut]:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    response = supabase.table("trips").select("*").order("start_time", desc=True).execute()
    return response.data or []


@router.post("", response_model=TripOut)
def create_trip(
    payload: TripCreate, 
    profile: dict = Depends(require_manager_or_driver_profile),
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
    trip_id: str,
    payload: TripUpdate,
    profile: dict = Depends(require_manager_or_driver_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> TripOut:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    data = payload.model_dump(exclude_none=True)
    response = (
        supabase.table("trips").update(data).eq("id", trip_id).execute()
    )
    if not response.data:
        raise HTTPException(status_code=400, detail="Update failed")
    updated_trip = response.data[0]

    should_finalize = "end_time" in data
    metrics_fields = {"distance_km", "duration_min", "avg_speed_kmh", "idle_min"}
    location_fields = {"start_lat", "start_lon", "end_lat", "end_lon"}
    if should_finalize:
        computed = _compute_trip_metrics(supabase, trip_id, updated_trip)
        finalize_payload = {}
        for key in metrics_fields.union(location_fields):
            if key not in data and computed.get(key) is not None:
                finalize_payload[key] = computed[key]
        if finalize_payload:
            finalized = (
                supabase.table("trips")
                .update(finalize_payload)
                .eq("id", trip_id)
                .execute()
            )
            if finalized.data:
                updated_trip = finalized.data[0]

    return updated_trip


@router.post("/{trip_id}/points")
def add_gps_point(
    trip_id: str,
    payload: GPSPointCreate,
    profile: dict = Depends(require_manager_or_driver_profile),
    token: Optional[str] = Depends(get_bearer_token),
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
def delete_trip(
    trip_id: str,
    profile: dict = Depends(require_manager_or_driver_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> dict:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    response = supabase.table("trips").delete().eq("id", trip_id).execute()
    if response.data is None:
        raise HTTPException(status_code=400, detail="Delete failed")
    return {"status": "ok"}
