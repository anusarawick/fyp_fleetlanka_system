from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class NotificationOut(BaseModel):
    id: str
    org_id: str
    recipient_profile_id: Optional[str] = None
    alert_type: str
    title: str
    message: str
    severity: str = "info"
    category: str = "general"
    action_url: Optional[str] = None
    related_entity: Optional[str] = None
    related_id: Optional[str] = None
    source_table: Optional[str] = None
    source_id: Optional[str] = None
    source_key: str
    due_date: Optional[str] = None
    status: Optional[str] = "open"
    metadata: dict[str, Any] = Field(default_factory=dict)
    read_at: Optional[str] = None
    dismissed_at: Optional[str] = None
    resolved_at: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None


class NotificationCountOut(BaseModel):
    unread_count: int
