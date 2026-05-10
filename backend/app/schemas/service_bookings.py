from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ServiceBookingCreate(BaseModel):
    vehicle_id: str
    center_id: str
    requested_date: str
    status: Optional[str] = "pending"
    notes: Optional[str] = None
    work_type: Optional[str] = None
    service_notes: Optional[str] = None
    proposed_tire_condition: Optional[str] = None
    proposed_brake_condition: Optional[str] = None
    proposed_battery_status: Optional[str] = None
    completion_review_status: Optional[str] = None
    completion_review_notes: Optional[str] = None
    completion_reviewed_at: Optional[str] = None
    completion_reviewed_by: Optional[str] = None
    completed_at: Optional[str] = None
    final_cost_lkr: Optional[float] = None
    next_service_due_km: Optional[float] = None
    payment_status: Optional[str] = None


class ServiceBookingOut(BaseModel):
    id: str
    org_id: str
    vehicle_id: str
    center_id: str
    requested_date: str
    status: Optional[str] = None
    notes: Optional[str] = None
    work_type: Optional[str] = None
    service_notes: Optional[str] = None
    proposed_tire_condition: Optional[str] = None
    proposed_brake_condition: Optional[str] = None
    proposed_battery_status: Optional[str] = None
    completion_review_status: Optional[str] = None
    completion_review_notes: Optional[str] = None
    completion_reviewed_at: Optional[str] = None
    completion_reviewed_by: Optional[str] = None
    completed_at: Optional[str] = None
    final_cost_lkr: Optional[float] = None
    next_service_due_km: Optional[float] = None
    payment_status: Optional[str] = "unpaid"


class ServiceBookingUpdate(BaseModel):
    requested_date: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    work_type: Optional[str] = None
    service_notes: Optional[str] = None
    proposed_tire_condition: Optional[str] = None
    proposed_brake_condition: Optional[str] = None
    proposed_battery_status: Optional[str] = None
    completion_review_status: Optional[str] = None
    completion_review_notes: Optional[str] = None
    completion_reviewed_at: Optional[str] = None
    completion_reviewed_by: Optional[str] = None
    completed_at: Optional[str] = None
    final_cost_lkr: Optional[float] = None
    next_service_due_km: Optional[float] = None
    payment_status: Optional[str] = None


class ServiceBookingReviewDecision(BaseModel):
    note: str
