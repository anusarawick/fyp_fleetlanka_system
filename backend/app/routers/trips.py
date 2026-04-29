from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import math

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import (
    get_bearer_token,
    require_manager_profile,
    require_manager_or_driver_profile,
)
from app.schemas.gps_points import GPSPointCreate
from app.schemas.trips import LiveTripOut, TripCreate, TripOut, TripUpdate
from app.services.supabase_client import get_supabase_client
from app.services.vehicle_feature_sync import sync_trip_vehicle_features

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


def _is_driver(profile: Dict[str, Any]) -> bool:
    return profile.get("role") == "driver"


def _derive_trip_status(trip: dict) -> str:
    status = trip.get("status")
    if isinstance(status, str) and status.strip():
        return status
    if trip.get("end_time"):
        return "completed"
    if trip.get("start_time"):
        return "in_progress"
    return "assigned"


def _get_trip_for_profile(supabase, profile: dict, trip_id: str) -> dict:
    query = supabase.table("trips").select("*").eq("id", trip_id).eq("org_id", profile["org_id"])
    if _is_driver(profile):
        query = query.eq("driver_id", profile["id"])
    response = query.limit(1).execute()
    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Trip not found")
    return rows[0]


@router.get("", response_model=List[TripOut])
def list_trips(
    profile: dict = Depends(require_manager_or_driver_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> List[TripOut]:
    token = _require_token(token)
    supabase = get_supabase_client(use_service_role=True)
    query = (
        supabase.table("trips")
        .select("*")
        .eq("org_id", profile["org_id"])
        .order("created_at", desc=True)
    )
    if _is_driver(profile):
        query = query.eq("driver_id", profile["id"])
    response = query.execute()
    return response.data or []


@router.get("/live", response_model=List[LiveTripOut])
def list_live_trips(
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> List[LiveTripOut]:
    token = _require_token(token)
    supabase = get_supabase_client(use_service_role=True)

    trips_response = (
        supabase.table("trips")
        .select("id,vehicle_id,driver_id,start_time,status")
        .eq("org_id", profile["org_id"])
        .eq("status", "in_progress")
        .is_("end_time", "null")
        .order("start_time", desc=True)
        .execute()
    )
    active_trips = trips_response.data or []
    if not active_trips:
        return []

    vehicle_ids = sorted({trip["vehicle_id"] for trip in active_trips if trip.get("vehicle_id")})
    driver_ids = sorted({trip["driver_id"] for trip in active_trips if trip.get("driver_id")})

    vehicles_by_id: Dict[str, dict] = {}
    if vehicle_ids:
        vehicles_response = (
            supabase.table("vehicles")
            .select("id,plate_no,make,model")
            .in_("id", vehicle_ids)
            .execute()
        )
        vehicles_by_id = {row["id"]: row for row in (vehicles_response.data or [])}

    drivers_by_id: Dict[str, dict] = {}
    if driver_ids:
        drivers_response = (
            supabase.table("profiles")
            .select("id,full_name")
            .in_("id", driver_ids)
            .execute()
        )
        drivers_by_id = {row["id"]: row for row in (drivers_response.data or [])}

    now = datetime.now(timezone.utc)
    stale_threshold = now - timedelta(minutes=2)
    live_rows: List[LiveTripOut] = []

    for trip in active_trips:
        point_response = (
            supabase.table("gps_points")
            .select("lat,lon,recorded_at,speed_kmh")
            .eq("trip_id", trip["id"])
            .order("recorded_at", desc=True)
            .limit(1)
            .execute()
        )
        points = point_response.data or []
        if not points:
            continue
        latest_point = points[0]
        recorded_at = str(latest_point["recorded_at"])
        recorded_dt = _parse_iso_datetime(recorded_at)
        stale = recorded_dt is None or recorded_dt < stale_threshold

        vehicle = vehicles_by_id.get(trip["vehicle_id"], {})
        vehicle_make = vehicle.get("make") or ""
        vehicle_model = vehicle.get("model") or ""
        vehicle_label = " ".join(part for part in [vehicle_make, vehicle_model] if part).strip()

        driver = drivers_by_id.get(trip.get("driver_id") or "", {})
        live_rows.append(
            LiveTripOut(
                trip_id=trip["id"],
                vehicle_id=trip["vehicle_id"],
                vehicle_plate_no=vehicle.get("plate_no"),
                vehicle_label=vehicle_label or vehicle.get("plate_no"),
                driver_id=trip.get("driver_id"),
                driver_name=driver.get("full_name"),
                lat=float(latest_point["lat"]),
                lon=float(latest_point["lon"]),
                recorded_at=recorded_at,
                speed_kmh=_to_float(latest_point.get("speed_kmh")),
                start_time=str(trip["start_time"]),
                stale=stale,
            )
        )

    return live_rows


@router.post("", response_model=TripOut)
def create_trip(
    payload: TripCreate, 
    profile: dict = Depends(require_manager_or_driver_profile),
    token: Optional[str] = Depends(get_bearer_token)
) -> TripOut:
    token = _require_token(token)
    org_id = profile["org_id"]
    supabase = get_supabase_client(use_service_role=True)
    data = payload.model_dump()
    data["org_id"] = org_id
    if _is_driver(profile):
        raise HTTPException(status_code=403, detail="Drivers must start manager-assigned trips")
    if not data.get("driver_id"):
        raise HTTPException(status_code=400, detail="Driver assignment is required")
    if data.get("status") not in (None, "assigned", "cancelled"):
        raise HTTPException(status_code=400, detail="Managers can only create assigned or cancelled trips")
    data["status"] = data.get("status") or "assigned"
    if data["status"] == "assigned":
        data["start_time"] = None
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
    supabase = get_supabase_client(use_service_role=True)
    existing_trip = _get_trip_for_profile(supabase, profile, trip_id)
    data = payload.model_dump(exclude_none=True)
    current_status = _derive_trip_status(existing_trip)
    next_status = data.get("status", current_status)

    if _is_driver(profile):
        if any(
            field in data
            for field in (
                "vehicle_id",
                "driver_id",
                "trip_title",
                "scheduled_start",
                "origin_label",
                "destination_label",
                "origin_lat",
                "origin_lon",
                "destination_lat",
                "destination_lon",
                "contact_name",
                "contact_phone",
                "priority",
                "notes",
            )
        ):
            raise HTTPException(status_code=403, detail="Drivers cannot change trip assignment details")
        if current_status == "assigned":
            if next_status != "in_progress":
                raise HTTPException(status_code=403, detail="Assigned trips can only be started by the assigned driver")
            if not data.get("start_time"):
                raise HTTPException(status_code=400, detail="Start time is required when starting an assigned trip")
        elif current_status == "in_progress":
            if next_status != "completed":
                raise HTTPException(status_code=403, detail="In-progress trips can only be completed by the driver")
            if not data.get("end_time"):
                raise HTTPException(status_code=400, detail="End time is required when completing a trip")
        else:
            raise HTTPException(status_code=403, detail="Completed or cancelled trips cannot be edited by the driver")
    else:
        if current_status not in {"assigned", "cancelled"}:
            raise HTTPException(status_code=403, detail="Managers can only edit assigned or cancelled trips")
        if next_status not in {"assigned", "cancelled"}:
            raise HTTPException(status_code=403, detail="Managers can only keep trips assigned or cancelled before they start")
        if next_status == "assigned":
            data["start_time"] = None
            data["end_time"] = None

    response = (
        supabase.table("trips").update(data).eq("id", trip_id).eq("org_id", profile["org_id"]).execute()
    )
    if not response.data:
        raise HTTPException(status_code=400, detail="Update failed")
    updated_trip = response.data[0]

    should_finalize = ("end_time" in data) or next_status == "completed"
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
        if updated_trip.get("status") == "completed" and updated_trip.get("vehicle_id"):
            sync_trip_vehicle_features(supabase, updated_trip["vehicle_id"])

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
    supabase = get_supabase_client(use_service_role=True)
    _get_trip_for_profile(supabase, profile, trip_id)
    trip = _get_trip_for_profile(supabase, profile, trip_id)
    if _derive_trip_status(trip) != "in_progress":
        raise HTTPException(status_code=400, detail="GPS points can only be added to in-progress trips")
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
    supabase = get_supabase_client(use_service_role=True)
    trip = _get_trip_for_profile(supabase, profile, trip_id)
    if _is_driver(profile):
        raise HTTPException(status_code=403, detail="Drivers cannot delete trips")
    if _derive_trip_status(trip) not in {"assigned", "cancelled"}:
        raise HTTPException(status_code=403, detail="Only assigned or cancelled trips can be deleted")
    response = (
        supabase.table("trips")
        .delete()
        .eq("id", trip_id)
        .eq("org_id", profile["org_id"])
        .execute()
    )
    if response.data is None:
        raise HTTPException(status_code=400, detail="Delete failed")
    return {"status": "ok"}
