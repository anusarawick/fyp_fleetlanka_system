from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class DriverScoreCreate(BaseModel):
    overall_score: int
    speed_score: Optional[float] = None
    idle_score: Optional[float] = None
    distance_score: Optional[float] = None
    consistency_score: Optional[float] = None


class DriverScoreOut(BaseModel):
    id: str
    org_id: str
    driver_id: str
    driver_name: Optional[str] = None
    overall_score: int
    speed_score: Optional[float] = None
    idle_score: Optional[float] = None
    distance_score: Optional[float] = None
    consistency_score: Optional[float] = None
    computed_at: str
