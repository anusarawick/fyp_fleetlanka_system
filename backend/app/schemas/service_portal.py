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
    payment_access_enabled: bool = False
    stripe_account_id: Optional[str] = None
    stripe_onboarding_status: Optional[str] = "not_started"


class ServicePortalSummaryOut(BaseModel):
    pending_count: int
    confirmed_count: int
    completed_today_count: int
    total_completed_count: int


class ServicePortalMeOut(BaseModel):
    center: ServicePortalCenterOut
    summary: ServicePortalSummaryOut


class ServicePortalBookingPaymentSummary(BaseModel):
    id: str
    status: Optional[str] = None
    amount_lkr: Optional[float] = None
    currency: Optional[str] = None
    stripe_checkout_session_id: Optional[str] = None
    stripe_payment_intent_id: Optional[str] = None
    stripe_transfer_destination: Optional[str] = None
    paid_at: Optional[str] = None
    created_at: Optional[str] = None


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
    completed_odometer_km: Optional[float] = None
    final_cost_lkr: Optional[float] = None
    next_service_due_km: Optional[float] = None
    payment_status: Optional[str] = "unpaid"
    payment: Optional[ServicePortalBookingPaymentSummary] = None


class ServicePortalBookingUpdate(BaseModel):
    status: Optional[str] = None
    work_type: Optional[str] = None
    service_notes: Optional[str] = None
    completed_odometer_km: Optional[float] = None
    proposed_tire_condition: Optional[str] = None
    proposed_brake_condition: Optional[str] = None
    proposed_battery_status: Optional[str] = None
    final_cost_lkr: Optional[float] = None
    next_service_due_km: Optional[float] = None
