from app.services.notifications import (
    DEFAULT_PREFERENCES,
    filter_notifications_for_preferences,
    get_notification_preferences,
    is_required_notification,
    notification_allowed,
    normalize_preferences,
    update_notification_preferences,
    upsert_notification,
)


def test_missing_preferences_are_created_with_enabled_defaults(fake_supabase, manager_profile) -> None:
    preferences = get_notification_preferences(fake_supabase, manager_profile)

    assert preferences == DEFAULT_PREFERENCES
    assert fake_supabase.tables["notification_preferences"][0]["profile_id"] == manager_profile["id"]
    assert all(fake_supabase.tables["notification_preferences"][0][key] for key in DEFAULT_PREFERENCES)


def test_preference_updates_ignore_unknown_keys(fake_supabase, manager_profile) -> None:
    updated = update_notification_preferences(
        fake_supabase,
        manager_profile,
        {"documents": False, "chat": False, "unknown": False},
    )

    assert updated["documents"] is False
    assert updated["chat"] is False
    assert "unknown" not in updated


def test_required_notifications_bypass_disabled_preferences(fake_supabase, manager_profile) -> None:
    update_notification_preferences(fake_supabase, manager_profile, {"documents": False})

    assert is_required_notification("documents", "danger", "document_expired") is True
    assert notification_allowed(
        fake_supabase,
        manager_profile,
        category="documents",
        severity="danger",
        alert_type="document_expired",
    )


def test_disabled_non_required_category_is_filtered(fake_supabase, manager_profile) -> None:
    update_notification_preferences(fake_supabase, manager_profile, {"chat": False})
    rows = [
        {"id": "required", "category": "maintenance", "severity": "danger", "alert_type": "service_overdue"},
        {"id": "hidden", "category": "chat", "severity": "info", "alert_type": "chat_message"},
        {"id": "visible", "category": "bookings", "severity": "info", "alert_type": "booking_created"},
    ]

    filtered = filter_notifications_for_preferences(fake_supabase, manager_profile, rows)

    assert [row["id"] for row in filtered] == ["required", "visible"]


def test_upsert_notification_respects_preferences_and_conflict_key(fake_supabase, manager_profile) -> None:
    update_notification_preferences(fake_supabase, manager_profile, {"chat": False})

    skipped = upsert_notification(
        fake_supabase,
        org_id="org-1",
        recipient_profile_id=manager_profile["id"],
        source_key="event:chat:1",
        alert_type="chat_message",
        title="New chat message",
        message="A service center sent a message.",
        category="chat",
        severity="info",
    )
    created = upsert_notification(
        fake_supabase,
        org_id="org-1",
        recipient_profile_id=manager_profile["id"],
        source_key="event:booking:1",
        alert_type="booking_created",
        title="New booking",
        message="A booking was created.",
        category="bookings",
        severity="info",
    )
    updated = upsert_notification(
        fake_supabase,
        org_id="org-1",
        recipient_profile_id=manager_profile["id"],
        source_key="event:booking:1",
        alert_type="booking_created",
        title="Booking updated",
        message="A booking was updated.",
        category="bookings",
        severity="info",
    )

    assert skipped is None
    assert created["title"] == "New booking"
    assert updated["title"] == "Booking updated"
    assert len(fake_supabase.tables["alerts"]) == 1


def test_normalize_preferences_defaults_missing_values() -> None:
    preferences = normalize_preferences({"documents": False})

    assert preferences["documents"] is False
    assert preferences["maintenance"] is True
