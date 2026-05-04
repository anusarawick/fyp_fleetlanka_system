from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class TripCreate(BaseModel):
    vehicle_id: str
    driver_id: Optional[str] = None
    status: Optional[str] = "assigned"
    trip_title: Optional[str] = None
    scheduled_start: Optional[str] = None
    origin_label: Optional[str] = None
    destination_label: Optional[str] = None
    origin_lat: Optional[float] = None
    origin_lon: Optional[float] = None
    destination_lat: Optional[float] = None
    destination_lon: Optional[float] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    priority: Optional[str] = None
    notes: Optional[str] = None
    start_time: Optional[str] = None
    start_lat: Optional[float] = None
    start_lon: Optional[float] = None


class TripUpdate(BaseModel):
    vehicle_id: Optional[str] = None
    driver_id: Optional[str] = None
    status: Optional[str] = None
    trip_title: Optional[str] = None
    scheduled_start: Optional[str] = None
    origin_label: Optional[str] = None
    destination_label: Optional[str] = None
    origin_lat: Optional[float] = None
    origin_lon: Optional[float] = None
    destination_lat: Optional[float] = None
    destination_lon: Optional[float] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    priority: Optional[str] = None
    notes: Optional[str] = None
    start_time: Optional[str] = None
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
    status: Optional[str] = None
    trip_title: Optional[str] = None
    scheduled_start: Optional[str] = None
    origin_label: Optional[str] = None
    destination_label: Optional[str] = None
    origin_lat: Optional[float] = None
    origin_lon: Optional[float] = None
    destination_lat: Optional[float] = None
    destination_lon: Optional[float] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    priority: Optional[str] = None
    notes: Optional[str] = None
    start_time: Optional[str] = None
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
