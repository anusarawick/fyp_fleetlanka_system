from __future__ import annotations

from typing import Optional

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
    status: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None


class DriverUpdate(BaseModel):
    status: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
