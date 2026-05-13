from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_current_service_center, require_manager_profile, require_service_profile
from app.schemas.chat import (
    ChatConversationCreate,
    ChatConversationOut,
    ChatMessageCreate,
    ChatMessageOut,
    ChatServiceCenterOut,
)
from app.services.notifications import manager_profiles, notify_profiles, service_profile_for_center, upsert_notification
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/chat", tags=["chat"])
service_router = APIRouter(prefix="/service-portal/chat", tags=["service-portal-chat"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_center(admin_client, center_id: str, org_id: str) -> dict:
    response = (
        admin_client.table("service_centers")
        .select("*")
        .eq("id", center_id)
        .eq("org_id", org_id)
        .single()
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Service center not found")
    return response.data


def _get_booking(admin_client, booking_id: str, org_id: str, center_id: Optional[str] = None) -> dict:
    query = admin_client.table("service_bookings").select("*").eq("id", booking_id).eq("org_id", org_id)
    if center_id:
        query = query.eq("center_id", center_id)
    response = query.single().execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Service booking not found")
    return response.data


def _get_conversation_for_profile(admin_client, conversation_id: str, profile: dict, center: Optional[dict] = None) -> dict:
    query = (
        admin_client.table("chat_conversations")
        .select("*")
        .eq("id", conversation_id)
        .eq("org_id", profile["org_id"])
    )
    if center:
        query = query.eq("service_center_id", center["id"])
    response = query.single().execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return response.data


def _find_existing_conversation(admin_client, org_id: str, center_id: str, booking_id: Optional[str]) -> Optional[dict]:
    query = (
        admin_client.table("chat_conversations")
        .select("*")
        .eq("org_id", org_id)
        .eq("service_center_id", center_id)
    )
    if booking_id:
        query = query.eq("service_booking_id", booking_id)
    else:
        query = query.is_("service_booking_id", "null")
    response = query.limit(1).execute()
    rows = response.data or []
    return rows[0] if rows else None


def _create_or_get_conversation(admin_client, org_id: str, center_id: str, booking_id: Optional[str]) -> dict:
    existing = _find_existing_conversation(admin_client, org_id, center_id, booking_id)
    if existing:
        return existing
    payload = {
        "org_id": org_id,
        "service_center_id": center_id,
        "service_booking_id": booking_id,
        "conversation_type": "booking" if booking_id else "service_center",
    }
    response = admin_client.table("chat_conversations").insert(payload).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to create conversation")
    return response.data[0]


def _mark_read(admin_client, conversation_id: str, profile_id: str) -> None:
    admin_client.table("chat_read_states").upsert(
        {"conversation_id": conversation_id, "profile_id": profile_id, "last_read_at": _now()},
        on_conflict="conversation_id,profile_id",
    ).execute()


def _message_sender_names(admin_client, messages: list[dict]) -> dict[str, str]:
    profile_ids = list({message.get("sender_profile_id") for message in messages if message.get("sender_profile_id")})
    if not profile_ids:
        return {}
    response = admin_client.table("profiles").select("id, full_name").in_("id", profile_ids).execute()
    return {row["id"]: row.get("full_name") or "User" for row in (response.data or [])}


def _hydrate_messages(admin_client, messages: list[dict]) -> list[dict]:
    names = _message_sender_names(admin_client, messages)
    conversation_ids = list({message.get("conversation_id") for message in messages if message.get("conversation_id")})
    read_rows = []
    if conversation_ids:
        read_rows = (
            admin_client.table("chat_read_states")
            .select("conversation_id, profile_id, last_read_at")
            .in_("conversation_id", conversation_ids)
            .execute()
            .data
            or []
        )
    hydrated = []
    for message in messages:
        message_created_at = str(message.get("created_at") or "")
        recipient_reads = [
            row.get("last_read_at")
            for row in read_rows
            if row.get("conversation_id") == message.get("conversation_id")
            and row.get("profile_id") != message.get("sender_profile_id")
            and row.get("last_read_at")
            and str(row.get("last_read_at")) >= message_created_at
        ]
        read_at = max(recipient_reads) if recipient_reads else None
        hydrated.append(
            {
                **message,
                "sender_name": names.get(message.get("sender_profile_id")),
                "read_by_recipient": bool(read_at),
                "read_at": read_at,
            }
        )
    return hydrated


def _booking_reference(booking_id: Optional[str]) -> Optional[str]:
    if not booking_id:
        return None
    return f"BK-{booking_id.replace('-', '')[:8].upper()}"


def _conversation_metadata(admin_client, conversations: list[dict], profile_id: str) -> list[dict]:
    if not conversations:
        return []
    conversation_ids = [row["id"] for row in conversations]
    center_ids = list({row["service_center_id"] for row in conversations if row.get("service_center_id")})
    booking_ids = list({row["service_booking_id"] for row in conversations if row.get("service_booking_id")})

    centers = {}
    if center_ids:
        center_rows = admin_client.table("service_centers").select("id, name").in_("id", center_ids).execute().data or []
        centers = {row["id"]: row for row in center_rows}

    bookings = {}
    vehicle_ids = []
    if booking_ids:
        booking_rows = (
            admin_client.table("service_bookings")
            .select("id, vehicle_id")
            .in_("id", booking_ids)
            .execute()
            .data
            or []
        )
        bookings = {row["id"]: row for row in booking_rows}
        vehicle_ids = [row["vehicle_id"] for row in booking_rows if row.get("vehicle_id")]
    vehicles = {}
    if vehicle_ids:
        vehicle_rows = admin_client.table("vehicles").select("id, plate_no").in_("id", vehicle_ids).execute().data or []
        vehicles = {row["id"]: row for row in vehicle_rows}

    message_rows = (
        admin_client.table("chat_messages")
        .select("*")
        .in_("conversation_id", conversation_ids)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    last_by_conversation: dict[str, dict] = {}
    for message in message_rows:
        conversation_id = message.get("conversation_id")
        if conversation_id and conversation_id not in last_by_conversation:
            last_by_conversation[conversation_id] = message

    read_rows = (
        admin_client.table("chat_read_states")
        .select("conversation_id, last_read_at")
        .eq("profile_id", profile_id)
        .in_("conversation_id", conversation_ids)
        .execute()
        .data
        or []
    )
    read_by_conversation = {row["conversation_id"]: row.get("last_read_at") for row in read_rows}

    hydrated = []
    for conversation in conversations:
        conversation_id = conversation["id"]
        read_at = read_by_conversation.get(conversation_id)
        unread_count = sum(
            1
            for message in message_rows
            if message.get("conversation_id") == conversation_id
            and message.get("sender_profile_id") != profile_id
            and (not read_at or str(message.get("created_at")) > str(read_at))
        )
        booking = bookings.get(conversation.get("service_booking_id") or "")
        vehicle = vehicles.get((booking or {}).get("vehicle_id") or "")
        last_message = last_by_conversation.get(conversation_id, {})
        hydrated.append(
            {
                **conversation,
                "service_center_name": centers.get(conversation.get("service_center_id"), {}).get("name"),
                "booking_vehicle_plate": vehicle.get("plate_no") if vehicle else None,
                "booking_reference": _booking_reference(conversation.get("service_booking_id")),
                "last_message_text": last_message.get("message_text"),
                "last_message_at": last_message.get("created_at"),
                "unread_count": unread_count,
            }
        )
    return hydrated


def _list_conversations(admin_client, profile: dict, center: Optional[dict] = None) -> list[dict]:
    query = (
        admin_client.table("chat_conversations")
        .select("*")
        .eq("org_id", profile["org_id"])
        .order("updated_at", desc=True)
    )
    if center:
        query = query.eq("service_center_id", center["id"])
    conversations = query.execute().data or []
    return _conversation_metadata(admin_client, conversations, profile["id"])


@router.get("/conversations", response_model=list[ChatConversationOut])
def list_manager_conversations(profile: dict = Depends(require_manager_profile)) -> list[ChatConversationOut]:
    return _list_conversations(get_supabase_client(use_service_role=True), profile)


@router.get("/service-centers", response_model=list[ChatServiceCenterOut])
def list_manager_chat_service_centers(profile: dict = Depends(require_manager_profile)) -> list[ChatServiceCenterOut]:
    admin_client = get_supabase_client(use_service_role=True)
    rows = (
        admin_client.table("service_centers")
        .select("id, name, profile_id, phone, address")
        .eq("org_id", profile["org_id"])
        .order("name")
        .execute()
        .data
        or []
    )
    return [row for row in rows if row.get("profile_id")]


@router.post("/conversations/service-center", response_model=ChatConversationOut)
def open_manager_center_conversation(
    payload: ChatConversationCreate,
    profile: dict = Depends(require_manager_profile),
) -> ChatConversationOut:
    if not payload.service_center_id:
        raise HTTPException(status_code=400, detail="service_center_id is required")
    admin_client = get_supabase_client(use_service_role=True)
    _get_center(admin_client, payload.service_center_id, profile["org_id"])
    conversation = _create_or_get_conversation(admin_client, profile["org_id"], payload.service_center_id, None)
    return _conversation_metadata(admin_client, [conversation], profile["id"])[0]


@router.post("/conversations/booking", response_model=ChatConversationOut)
def open_manager_booking_conversation(
    payload: ChatConversationCreate,
    profile: dict = Depends(require_manager_profile),
) -> ChatConversationOut:
    if not payload.service_booking_id:
        raise HTTPException(status_code=400, detail="service_booking_id is required")
    admin_client = get_supabase_client(use_service_role=True)
    booking = _get_booking(admin_client, payload.service_booking_id, profile["org_id"])
    conversation = _create_or_get_conversation(admin_client, profile["org_id"], booking["center_id"], booking["id"])
    return _conversation_metadata(admin_client, [conversation], profile["id"])[0]


@router.get("/conversations/{conversation_id}/messages", response_model=list[ChatMessageOut])
def list_manager_messages(
    conversation_id: str,
    profile: dict = Depends(require_manager_profile),
) -> list[ChatMessageOut]:
    admin_client = get_supabase_client(use_service_role=True)
    _get_conversation_for_profile(admin_client, conversation_id, profile)
    messages = (
        admin_client.table("chat_messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .execute()
        .data
        or []
    )
    return _hydrate_messages(admin_client, messages)


@router.post("/conversations/{conversation_id}/messages", response_model=ChatMessageOut)
def send_manager_message(
    conversation_id: str,
    payload: ChatMessageCreate,
    profile: dict = Depends(require_manager_profile),
) -> ChatMessageOut:
    text = payload.message_text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    admin_client = get_supabase_client(use_service_role=True)
    conversation = _get_conversation_for_profile(admin_client, conversation_id, profile)
    response = (
        admin_client.table("chat_messages")
        .insert(
            {
                "conversation_id": conversation_id,
                "org_id": profile["org_id"],
                "sender_profile_id": profile["id"],
                "sender_role": profile["role"],
                "message_text": text,
            }
        )
        .execute()
    )
    admin_client.table("chat_conversations").update({"updated_at": _now()}).eq("id", conversation["id"]).execute()
    _mark_read(admin_client, conversation_id, profile["id"])
    message = response.data[0]
    service_profile = service_profile_for_center(admin_client, conversation.get("service_center_id"), profile["org_id"])
    if service_profile and service_profile.get("id") != profile["id"]:
        upsert_notification(
            admin_client,
            org_id=profile["org_id"],
            recipient_profile_id=service_profile["id"],
            source_key=f"event:chat_message:{message['id']}",
            alert_type="chat_message",
            title="New manager message",
            message=text,
            severity="info",
            category="chat",
            action_url="/service/bookings" if conversation.get("service_booking_id") else "/service",
            related_entity="chat_conversations",
            related_id=conversation_id,
            source_table="chat_messages",
            source_id=message["id"],
            metadata={"conversation_id": conversation_id, "service_booking_id": conversation.get("service_booking_id")},
        )
    return _hydrate_messages(admin_client, [message])[0]


@router.post("/conversations/{conversation_id}/read")
def mark_manager_conversation_read(
    conversation_id: str,
    profile: dict = Depends(require_manager_profile),
) -> dict:
    admin_client = get_supabase_client(use_service_role=True)
    _get_conversation_for_profile(admin_client, conversation_id, profile)
    _mark_read(admin_client, conversation_id, profile["id"])
    return {"status": "ok"}


@service_router.get("/conversations", response_model=list[ChatConversationOut])
def list_service_conversations(
    profile: dict = Depends(require_service_profile),
    center: dict = Depends(get_current_service_center),
) -> list[ChatConversationOut]:
    return _list_conversations(get_supabase_client(use_service_role=True), profile, center)


@service_router.post("/conversations/service-center", response_model=ChatConversationOut)
def open_service_center_conversation(
    profile: dict = Depends(require_service_profile),
    center: dict = Depends(get_current_service_center),
) -> ChatConversationOut:
    admin_client = get_supabase_client(use_service_role=True)
    conversation = _create_or_get_conversation(admin_client, center["org_id"], center["id"], None)
    return _conversation_metadata(admin_client, [conversation], profile["id"])[0]


@service_router.post("/conversations/booking", response_model=ChatConversationOut)
def open_service_booking_conversation(
    payload: ChatConversationCreate,
    profile: dict = Depends(require_service_profile),
    center: dict = Depends(get_current_service_center),
) -> ChatConversationOut:
    if not payload.service_booking_id:
        raise HTTPException(status_code=400, detail="service_booking_id is required")
    admin_client = get_supabase_client(use_service_role=True)
    booking = _get_booking(admin_client, payload.service_booking_id, center["org_id"], center["id"])
    conversation = _create_or_get_conversation(admin_client, center["org_id"], center["id"], booking["id"])
    return _conversation_metadata(admin_client, [conversation], profile["id"])[0]


@service_router.get("/conversations/{conversation_id}/messages", response_model=list[ChatMessageOut])
def list_service_messages(
    conversation_id: str,
    profile: dict = Depends(require_service_profile),
    center: dict = Depends(get_current_service_center),
) -> list[ChatMessageOut]:
    admin_client = get_supabase_client(use_service_role=True)
    _get_conversation_for_profile(admin_client, conversation_id, profile, center)
    messages = (
        admin_client.table("chat_messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .execute()
        .data
        or []
    )
    return _hydrate_messages(admin_client, messages)


@service_router.post("/conversations/{conversation_id}/messages", response_model=ChatMessageOut)
def send_service_message(
    conversation_id: str,
    payload: ChatMessageCreate,
    profile: dict = Depends(require_service_profile),
    center: dict = Depends(get_current_service_center),
) -> ChatMessageOut:
    text = payload.message_text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    admin_client = get_supabase_client(use_service_role=True)
    conversation = _get_conversation_for_profile(admin_client, conversation_id, profile, center)
    response = (
        admin_client.table("chat_messages")
        .insert(
            {
                "conversation_id": conversation_id,
                "org_id": center["org_id"],
                "sender_profile_id": profile["id"],
                "sender_role": "service",
                "message_text": text,
            }
        )
        .execute()
    )
    admin_client.table("chat_conversations").update({"updated_at": _now()}).eq("id", conversation["id"]).execute()
    _mark_read(admin_client, conversation_id, profile["id"])
    message = response.data[0]
    notify_profiles(
        admin_client,
        manager_profiles(admin_client, center["org_id"]),
        org_id=center["org_id"],
        source_key=f"event:chat_message:{message['id']}",
        alert_type="chat_message",
        title="New service-center message",
        message=text,
        severity="info",
        category="chat",
        action_url="/maintenance",
        related_entity="chat_conversations",
        related_id=conversation_id,
        source_table="chat_messages",
        source_id=message["id"],
        metadata={"conversation_id": conversation_id, "service_booking_id": conversation.get("service_booking_id"), "center_id": center.get("id")},
    )
    return _hydrate_messages(admin_client, [message])[0]


@service_router.post("/conversations/{conversation_id}/read")
def mark_service_conversation_read(
    conversation_id: str,
    profile: dict = Depends(require_service_profile),
    center: dict = Depends(get_current_service_center),
) -> dict:
    admin_client = get_supabase_client(use_service_role=True)
    _get_conversation_for_profile(admin_client, conversation_id, profile, center)
    _mark_read(admin_client, conversation_id, profile["id"])
    return {"status": "ok"}
