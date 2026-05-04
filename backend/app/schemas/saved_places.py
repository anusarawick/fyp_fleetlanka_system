from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, field_validator


def _normalize_optional_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _validate_lat(value: float) -> float:
    if value < -90 or value > 90:
        raise ValueError("Latitude must be between -90 and 90")
    return value


def _validate_lon(value: float) -> float:
    if value < -180 or value > 180:
        raise ValueError("Longitude must be between -180 and 180")
    return value


class SavedPlaceCreate(BaseModel):
    name: str
    label: str
    lat: float
    lon: float
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("name", "label")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field is required")
        return cleaned

    @field_validator("contact_name", "contact_phone", "notes")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_optional_text(value)

    @field_validator("lat")
    @classmethod
    def validate_lat(cls, value: float) -> float:
        return _validate_lat(value)

    @field_validator("lon")
    @classmethod
    def validate_lon(cls, value: float) -> float:
        return _validate_lon(value)


class SavedPlaceUpdate(BaseModel):
    name: str
    label: str
    lat: float
    lon: float
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("name", "label")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field is required")
        return cleaned

    @field_validator("contact_name", "contact_phone", "notes")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_optional_text(value)

    @field_validator("lat")
    @classmethod
    def validate_lat(cls, value: float) -> float:
        return _validate_lat(value)

    @field_validator("lon")
    @classmethod
    def validate_lon(cls, value: float) -> float:
        return _validate_lon(value)


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
