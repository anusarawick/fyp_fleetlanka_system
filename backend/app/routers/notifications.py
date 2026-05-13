from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_current_profile
from app.schemas.notifications import NotificationCountOut, NotificationOut
from app.services.notifications import _now, sync_generated_notifications
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _notification_query(admin_client, profile: dict):
    return (
        admin_client.table("alerts")
        .select("*")
        .eq("org_id", profile["org_id"])
        .eq("recipient_profile_id", profile["id"])
    )


def _notification_update_query(admin_client, profile: dict, updates: dict):
    return (
        admin_client.table("alerts")
        .update(updates)
        .eq("org_id", profile["org_id"])
        .eq("recipient_profile_id", profile["id"])
    )


def _sync(profile: dict, admin_client) -> None:
    try:
        sync_generated_notifications(admin_client, profile)
    except Exception as exc:
        message = str(exc)
        if "recipient_profile_id" in message or "source_key" in message or "metadata" in message:
            raise HTTPException(
                status_code=500,
                detail="Notification columns are missing. Apply migration 20260513_notifications.sql, then restart backend.",
            ) from exc
        raise


@router.get("", response_model=List[NotificationOut])
def list_notifications(profile: dict = Depends(get_current_profile)) -> List[NotificationOut]:
    admin_client = get_supabase_client(use_service_role=True)
    _sync(profile, admin_client)
    response = (
        _notification_query(admin_client, profile)
        .is_("dismissed_at", "null")
        .is_("resolved_at", "null")
        .order("created_at", desc=True)
        .limit(40)
        .execute()
    )
    rows = response.data or []
    rows.sort(key=lambda row: str(row.get("created_at") or ""), reverse=True)
    rows.sort(key=lambda row: bool(row.get("read_at")))
    return rows


@router.get("/count", response_model=NotificationCountOut)
def notification_count(profile: dict = Depends(get_current_profile)) -> NotificationCountOut:
    admin_client = get_supabase_client(use_service_role=True)
    _sync(profile, admin_client)
    response = (
        _notification_query(admin_client, profile)
        .select("id", count="exact")
        .is_("read_at", "null")
        .is_("dismissed_at", "null")
        .is_("resolved_at", "null")
        .execute()
    )
    return {"unread_count": response.count or 0}


def _mark_notification_read(notification_id: str, profile: dict) -> NotificationOut:
    admin_client = get_supabase_client(use_service_role=True)
    response = (
        _notification_update_query(admin_client, profile, {"read_at": _now(), "updated_at": _now()})
        .eq("id", notification_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Notification not found")
    return response.data[0]


def _mark_all_notifications_read(profile: dict) -> dict:
    admin_client = get_supabase_client(use_service_role=True)
    (
        _notification_update_query(admin_client, profile, {"read_at": _now(), "updated_at": _now()})
        .is_("read_at", "null")
        .is_("dismissed_at", "null")
        .is_("resolved_at", "null")
        .execute()
    )
    return {"status": "ok"}


def _dismiss_notification(notification_id: str, profile: dict) -> NotificationOut:
    admin_client = get_supabase_client(use_service_role=True)
    response = (
        _notification_update_query(
            admin_client,
            profile,
            {"dismissed_at": _now(), "status": "dismissed", "updated_at": _now()},
        )
        .eq("id", notification_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Notification not found")
    return response.data[0]


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read_patch(
    notification_id: str,
    profile: dict = Depends(get_current_profile),
) -> NotificationOut:
    return _mark_notification_read(notification_id, profile)


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read_post(
    notification_id: str,
    profile: dict = Depends(get_current_profile),
) -> NotificationOut:
    return _mark_notification_read(notification_id, profile)


@router.patch("/read-all")
def mark_all_notifications_read_patch(profile: dict = Depends(get_current_profile)) -> dict:
    return _mark_all_notifications_read(profile)


@router.post("/read-all")
def mark_all_notifications_read_post(profile: dict = Depends(get_current_profile)) -> dict:
    return _mark_all_notifications_read(profile)


@router.patch("/{notification_id}/dismiss", response_model=NotificationOut)
def dismiss_notification_patch(
    notification_id: str,
    profile: dict = Depends(get_current_profile),
) -> NotificationOut:
    return _dismiss_notification(notification_id, profile)


@router.post("/{notification_id}/dismiss", response_model=NotificationOut)
def dismiss_notification_post(
    notification_id: str,
    profile: dict = Depends(get_current_profile),
) -> NotificationOut:
    return _dismiss_notification(notification_id, profile)
