from fastapi.testclient import TestClient

import app.routers.service_bookings as service_bookings_router


def test_service_booking_router_creates_pending_booking(router_app, fake_supabase, manager_profile) -> None:
    fake_supabase.tables["service_bookings"] = []
    client = TestClient(router_app(service_bookings_router.router, manager_profile, service_bookings_router))

    response = client.post(
        "/service-bookings",
        json={
            "vehicle_id": "vehicle-1",
            "center_id": "center-1",
            "requested_date": "2026-05-14",
            "work_type": "Regular Service",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "pending"
    assert response.json()["org_id"] == "org-1"


def test_service_booking_router_blocks_completed_create_fields(router_app, fake_supabase, manager_profile) -> None:
    client = TestClient(router_app(service_bookings_router.router, manager_profile, service_bookings_router))

    response = client.post(
        "/service-bookings",
        json={
            "vehicle_id": "vehicle-1",
            "center_id": "center-1",
            "requested_date": "2026-05-14",
            "status": "completed",
            "final_cost_lkr": 25000,
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Managers can only create pending bookings"
