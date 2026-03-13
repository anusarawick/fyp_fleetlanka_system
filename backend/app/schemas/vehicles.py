from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class VehicleCreate(BaseModel):
    plate_no: str
    make: Optional[str] = None
    model: Optional[str] = None
    vehicle_type: Optional[str] = None
    year: Optional[int] = None
    status: Optional[str] = "active"
    odometer_km: Optional[float] = None


class VehicleUpdate(BaseModel):
    plate_no: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    vehicle_type: Optional[str] = None
    year: Optional[int] = None
    status: Optional[str] = None
    odometer_km: Optional[float] = None


class VehicleOut(BaseModel):
    id: str
    org_id: str
    plate_no: str
    make: Optional[str] = None
    model: Optional[str] = None
    vehicle_type: Optional[str] = None
    year: Optional[int] = None
    status: Optional[str] = None
    odometer_km: Optional[float] = None


class VehicleOutMinimal(BaseModel):
    id: str
    plate_no: str
