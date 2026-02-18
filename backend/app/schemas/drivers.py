from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, EmailStr


class DriverCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    phone: Optional[str] = None


class DriverOut(BaseModel):
    id: str
    org_id: str
    role: str
    full_name: Optional[str] = None
    phone: Optional[str] = None


class DriverUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
