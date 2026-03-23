from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class TripCreate(BaseModel):
    vehicle_id: str
    driver_id: Optional[str] = None
    start_time: str
    start_lat: Optional[float] = None
    start_lon: Optional[float] = None


class TripUpdate(BaseModel):
    end_time: Optional[str] = None
    end_lat: Optional[float] = None
    end_lon: Optional[float] = None
    distance_km: Optional[float] = None
    duration_min: Optional[float] = None
    avg_speed_kmh: Optional[float] = None
    idle_min: Optional[float] = None


class TripOut(BaseModel):
    id: str
    org_id: str
    vehicle_id: str
    driver_id: Optional[str] = None
    start_time: str
    end_time: Optional[str] = None
    start_lat: Optional[float] = None
    start_lon: Optional[float] = None
    end_lat: Optional[float] = None
    end_lon: Optional[float] = None
    distance_km: Optional[float] = None
    duration_min: Optional[float] = None
    avg_speed_kmh: Optional[float] = None
    idle_min: Optional[float] = None


class LiveTripOut(BaseModel):
    trip_id: str
    vehicle_id: str
    vehicle_plate_no: Optional[str] = None
    vehicle_label: Optional[str] = None
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    lat: float
    lon: float
    recorded_at: str
    speed_kmh: Optional[float] = None
    start_time: str
    stale: bool
