from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ServicePortalCenterOut(BaseModel):
    id: str
    org_id: str
    profile_id: Optional[str] = None
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None


class ServicePortalSummaryOut(BaseModel):
    pending_count: int
    confirmed_count: int
    completed_today_count: int
    total_completed_count: int


class ServicePortalMeOut(BaseModel):
    center: ServicePortalCenterOut
    summary: ServicePortalSummaryOut


class ServicePortalBookingOut(BaseModel):
    id: str
    org_id: str
    vehicle_id: str
    center_id: str
    vehicle_plate_no: Optional[str] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    requested_date: str
    status: Optional[str] = None
    notes: Optional[str] = None
    service_notes: Optional[str] = None
    completed_at: Optional[str] = None
    final_cost_lkr: Optional[float] = None


class ServicePortalBookingUpdate(BaseModel):
    status: Optional[str] = None
    service_notes: Optional[str] = None
    final_cost_lkr: Optional[float] = None
