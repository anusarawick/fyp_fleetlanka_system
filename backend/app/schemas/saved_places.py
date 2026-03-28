from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class SavedPlaceCreate(BaseModel):
    name: str
    label: str
    lat: float
    lon: float
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None


class SavedPlaceOut(BaseModel):
    id: str
    org_id: str
    name: str
    label: str
    lat: float
    lon: float
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
