from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ServiceCenterCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None


class ServiceCenterOut(BaseModel):
    id: str
    org_id: str
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None


class ServiceCenterUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
