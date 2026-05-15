from fastapi.testclient import TestClient

import app.routers.chat as chat_router


def seed_chat_tables(fake_supabase) -> None:
    fake_supabase.tables["organizations"] = [
        {"id": "org-1", "name": "Demo Fleet Lanka"},
    ]
    fake_supabase.tables["profiles"] = [
        {"id": "profile-manager", "org_id": "org-1", "role": "manager", "status": "active", "full_name": "MPA Wickramasinghe"},
        {"id": "profile-service", "org_id": "org-1", "role": "service", "status": "active", "full_name": "Service User"},
    ]
    fake_supabase.tables["service_centers"] = [
        {"id": "center-1", "org_id": "org-1", "profile_id": "profile-service", "name": "Colombo Auto Care"},
    ]
    fake_supabase.tables["chat_conversations"] = [
        {
            "id": "conversation-1",
            "org_id": "org-1",
            "service_center_id": "center-1",
            "service_booking_id": None,
            "conversation_type": "service_center",
            "created_at": "2026-05-13T09:00:00+00:00",
            "updated_at": "2026-05-13T09:10:00+00:00",
        }
    ]
    fake_supabase.tables["chat_messages"] = [
        {
            "id": "message-1",
            "conversation_id": "conversation-1",
            "org_id": "org-1",
            "sender_profile_id": "profile-service",
            "sender_role": "service",
            "message_text": "Vehicle is ready",
            "created_at": "2026-05-13T09:05:00+00:00",
        },
        {
            "id": "message-2",
            "conversation_id": "conversation-1",
            "org_id": "org-1",
            "sender_profile_id": "profile-manager",
            "sender_role": "manager",
            "message_text": "Please confirm pickup time",
            "created_at": "2026-05-13T09:10:00+00:00",
        },
    ]
    fake_supabase.tables["chat_read_states"] = [
        {
            "conversation_id": "conversation-1",
            "profile_id": "profile-manager",
            "last_read_at": "2026-05-13T09:01:00+00:00",
        }
    ]


def test_manager_chat_conversations_show_service_center_counterparty(router_app, fake_supabase, manager_profile) -> None:
    seed_chat_tables(fake_supabase)
    client = TestClient(router_app(chat_router.router, manager_profile, chat_router))

    response = client.get("/chat/conversations")

    assert response.status_code == 200
    row = response.json()[0]
    assert row["service_center_name"] == "Colombo Auto Care"
    assert row["counterparty_name"] == "Colombo Auto Care"
    assert row["unread_count"] == 1


def test_service_chat_conversations_show_organization_counterparty(router_app, fake_supabase, service_profile) -> None:
    seed_chat_tables(fake_supabase)
    client = TestClient(router_app(chat_router.service_router, service_profile, chat_router))

    response = client.get("/service-portal/chat/conversations")

    assert response.status_code == 200
    row = response.json()[0]
    assert row["service_center_name"] == "Colombo Auto Care"
    assert row["manager_name"] == "MPA Wickramasinghe"
    assert row["organization_name"] == "Demo Fleet Lanka"
    assert row["counterparty_name"] == "Fleet Manager - Demo Fleet Lanka"
    assert row["unread_count"] == 1
