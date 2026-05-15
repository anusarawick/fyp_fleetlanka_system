from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, EmailStr


class ServiceCenterCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    portal_email: Optional[EmailStr] = None
    portal_password: Optional[str] = None
    portal_contact_name: Optional[str] = None
    payment_access_enabled: Optional[bool] = False


class ServiceCenterOut(BaseModel):
    id: str
    org_id: str
    profile_id: Optional[str] = None
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    payment_access_enabled: bool = False
    stripe_account_id: Optional[str] = None
    stripe_onboarding_status: Optional[str] = "not_started"


class ServiceCenterUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    portal_email: Optional[EmailStr] = None
    portal_password: Optional[str] = None
    portal_contact_name: Optional[str] = None
    payment_access_enabled: Optional[bool] = None
