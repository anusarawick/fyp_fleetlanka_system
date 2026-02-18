from __future__ import annotations

from pydantic import BaseModel


class GPSPointCreate(BaseModel):
    trip_id: str
    recorded_at: str
    lat: float
    lon: float
    speed_kmh: float | None = None
