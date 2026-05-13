from fastapi.testclient import TestClient

import app.routers.notifications as notifications_router


def test_notification_router_lists_counts_and_updates_state(router_app, fake_supabase, manager_profile) -> None:
    fake_supabase.tables["alerts"] = [
        {
            "id": "alert-1",
            "org_id": "org-1",
            "recipient_profile_id": "profile-manager",
            "alert_type": "booking_created",
            "title": "New booking",
            "message": "A booking was created.",
            "severity": "info",
            "category": "bookings",
            "source_key": "event:booking:1",
            "status": "open",
            "metadata": {},
            "read_at": None,
            "dismissed_at": None,
            "resolved_at": None,
            "created_at": "2026-05-13T10:00:00+00:00",
        },
        {
            "id": "alert-other",
            "org_id": "org-1",
            "recipient_profile_id": "other-profile",
            "alert_type": "booking_created",
            "title": "Wrong recipient",
            "message": "Not visible.",
            "severity": "info",
            "category": "bookings",
            "source_key": "event:booking:2",
            "status": "open",
            "metadata": {},
            "read_at": None,
            "dismissed_at": None,
            "resolved_at": None,
            "created_at": "2026-05-13T10:00:00+00:00",
        },
    ]
    client = TestClient(router_app(notifications_router.router, manager_profile, notifications_router))

    listed = client.get("/notifications")
    counted = client.get("/notifications/count")
    read = client.post("/notifications/alert-1/read")
    dismissed = client.post("/notifications/alert-1/dismiss")

    assert listed.status_code == 200
    assert [row["id"] for row in listed.json()] == ["alert-1"]
    assert counted.json() == {"unread_count": 1}
    assert read.status_code == 200
    assert read.json()["read_at"] is not None
    assert dismissed.status_code == 200
    assert dismissed.json()["status"] == "dismissed"


def test_notification_preferences_endpoint_updates_current_user_only(router_app, fake_supabase, manager_profile) -> None:
    client = TestClient(router_app(notifications_router.router, manager_profile, notifications_router))

    response = client.patch("/notifications/preferences", json={"chat": False, "documents": False})

    assert response.status_code == 200
    assert response.json()["chat"] is False
    assert response.json()["documents"] is False
    assert fake_supabase.tables["notification_preferences"][0]["profile_id"] == "profile-manager"
