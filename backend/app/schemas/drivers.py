from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, EmailStr


class DriverCreate(BaseModel):
    email: EmailStr
    password: str
    status: Optional[str] = "active"
    full_name: Optional[str] = None
    phone: Optional[str] = None


class DriverOut(BaseModel):
    id: str
    org_id: str
    role: str
    email: Optional[EmailStr] = None
    status: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None


class DriverUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    status: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None


class DriverInsightBucket(BaseModel):
    count: int
    driver_ids: List[str]
    preview: List[str]


class DriverAttentionInsights(BaseModel):
    missing_phone: DriverInsightBucket
    missing_email: DriverInsightBucket
    inactive_access: DriverInsightBucket


class DriverDispatchCoverage(BaseModel):
    available_drivers: int
    assigned_now: int
    contact_ready: int
    active_total: int


class DriverCleanupInsights(BaseModel):
    incomplete_profiles: int
    missing_names: int
    disabled_accounts: int


class DriverInsightsOut(BaseModel):
    attention: DriverAttentionInsights
    dispatch_coverage: DriverDispatchCoverage
    cleanup: DriverCleanupInsights
