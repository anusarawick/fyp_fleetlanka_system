from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ProfileOut(BaseModel):
    id: str
    org_id: str
    role: str
    status: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str
