from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class DocumentCreate(BaseModel):
    vehicle_id: Optional[str] = None
    doc_type: str
    doc_number: Optional[str] = None
    expiry_date: Optional[str] = None
    file_url: Optional[str] = None


class DocumentOut(BaseModel):
    id: str
    org_id: str
    vehicle_id: Optional[str] = None
    doc_type: str
    doc_number: Optional[str] = None
    expiry_date: Optional[str] = None
    file_url: Optional[str] = None


class DocumentUpdate(BaseModel):
    doc_type: Optional[str] = None
    doc_number: Optional[str] = None
    expiry_date: Optional[str] = None
    file_url: Optional[str] = None
