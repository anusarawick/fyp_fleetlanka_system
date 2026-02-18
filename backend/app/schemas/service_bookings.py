from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ServiceBookingCreate(BaseModel):
    vehicle_id: str
    center_id: str
    requested_date: str
    status: Optional[str] = "pending"
    notes: Optional[str] = None


class ServiceBookingOut(BaseModel):
    id: str
    org_id: str
    vehicle_id: str
    center_id: str
    requested_date: str
    status: Optional[str] = None
    notes: Optional[str] = None


class ServiceBookingUpdate(BaseModel):
    requested_date: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
