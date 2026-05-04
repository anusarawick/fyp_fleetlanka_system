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


class ServiceCenterOut(BaseModel):
    id: str
    org_id: str
    profile_id: Optional[str] = None
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None


class ServiceCenterUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    portal_email: Optional[EmailStr] = None
    portal_password: Optional[str] = None
    portal_contact_name: Optional[str] = None
