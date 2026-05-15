from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, model_validator


class DocumentCreate(BaseModel):
    vehicle_id: Optional[str] = None
    driver_id: Optional[str] = None
    doc_type: str
    doc_number: Optional[str] = None
    expiry_date: Optional[str] = None
    file_url: Optional[str] = None

    @model_validator(mode="after")
    def validate_owner(self) -> "DocumentCreate":
        if bool(self.vehicle_id) == bool(self.driver_id):
            raise ValueError("Exactly one of vehicle_id or driver_id must be provided")
        return self


class DocumentOut(BaseModel):
    id: str
    org_id: str
    vehicle_id: Optional[str] = None
    driver_id: Optional[str] = None
    doc_type: str
    doc_number: Optional[str] = None
    expiry_date: Optional[str] = None
    file_url: Optional[str] = None


class DocumentUpdate(BaseModel):
    vehicle_id: Optional[str] = None
    driver_id: Optional[str] = None
    doc_type: Optional[str] = None
    doc_number: Optional[str] = None
    expiry_date: Optional[str] = None
    file_url: Optional[str] = None
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    file_mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None

    @model_validator(mode="after")
    def validate_owner(self) -> "DocumentUpdate":
        if self.vehicle_id and self.driver_id:
            raise ValueError("Only one of vehicle_id or driver_id can be provided")
        return self


class DocumentFileUrlOut(BaseModel):
    url: str
