from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class FuelLogCreate(BaseModel):
    vehicle_id: str
    driver_id: Optional[str] = None
    fuel_date: str
    liters: float
    cost_lkr: Optional[float] = None
    odometer_km: Optional[float] = None
    vendor: Optional[str] = None


class FuelLogOut(BaseModel):
    id: str
    org_id: str
    vehicle_id: str
    driver_id: Optional[str] = None
    fuel_date: str
    liters: float
    cost_lkr: Optional[float] = None
    odometer_km: Optional[float] = None
    vendor: Optional[str] = None


class FuelLogUpdate(BaseModel):
    fuel_date: Optional[str] = None
    liters: Optional[float] = None
    cost_lkr: Optional[float] = None
    odometer_km: Optional[float] = None
    vendor: Optional[str] = None
