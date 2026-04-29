from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class MaintenanceCreate(BaseModel):
    vehicle_id: str
    service_center_id: Optional[str] = None
    service_booking_id: Optional[str] = None
    service_date: str
    service_type: Optional[str] = None
    cost_lkr: Optional[float] = None
    odometer_km: Optional[float] = None
    next_service_due_km: Optional[float] = None
    notes: Optional[str] = None


class MaintenanceOut(BaseModel):
    id: str
    org_id: str
    vehicle_id: str
    service_center_id: Optional[str] = None
    service_booking_id: Optional[str] = None
    service_date: str
    service_type: Optional[str] = None
    cost_lkr: Optional[float] = None
    odometer_km: Optional[float] = None
    next_service_due_km: Optional[float] = None
    notes: Optional[str] = None


class MaintenanceUpdate(BaseModel):
    service_center_id: Optional[str] = None
    service_booking_id: Optional[str] = None
    service_date: Optional[str] = None
    service_type: Optional[str] = None
    cost_lkr: Optional[float] = None
    odometer_km: Optional[float] = None
    next_service_due_km: Optional[float] = None
    notes: Optional[str] = None
