from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class ChatConversationCreate(BaseModel):
    service_center_id: Optional[str] = None
    service_booking_id: Optional[str] = None


class ChatMessageCreate(BaseModel):
    message_text: str


class ChatConversationOut(BaseModel):
    id: str
    org_id: str
    service_center_id: str
    service_booking_id: Optional[str] = None
    conversation_type: str
    service_center_name: Optional[str] = None
    booking_vehicle_plate: Optional[str] = None
    booking_reference: Optional[str] = None
    last_message_text: Optional[str] = None
    last_message_at: Optional[str] = None
    unread_count: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ChatServiceCenterOut(BaseModel):
    id: str
    name: str
    profile_id: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class ChatMessageOut(BaseModel):
    id: str
    conversation_id: str
    org_id: str
    sender_profile_id: str
    sender_role: str
    sender_name: Optional[str] = None
    message_text: str
    created_at: str
    read_by_recipient: bool = False
    read_at: Optional[str] = None


class AiChatTurn(BaseModel):
    role: str
    text: str


class AiChatRequest(BaseModel):
    message: str
    history: list[AiChatTurn] = []


class AiChatTable(BaseModel):
    columns: list[str] = []
    rows: list[list[Any]] = []


class AiChatResponse(BaseModel):
    answer: str
    type: str = "message"
    title: Optional[str] = None
    summary: Optional[str] = None
    table: Optional[AiChatTable] = None
    bullets: list[str] = []
    followups: list[str] = []
    refusal: Optional[str] = None
