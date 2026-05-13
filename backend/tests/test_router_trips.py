from fastapi.testclient import TestClient

import app.routers.trips as trips_router


def test_trip_router_manager_creates_assigned_trip(router_app, fake_supabase, manager_profile) -> None:
    fake_supabase.tables["trips"] = []
    client = TestClient(router_app(trips_router.router, manager_profile, trips_router))

    response = client.post(
        "/trips",
        json={
            "vehicle_id": "vehicle-1",
            "driver_id": "profile-driver",
            "trip_title": "Colombo delivery",
            "scheduled_start": "2026-05-15T08:00:00+00:00",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "assigned"
    assert response.json()["driver_id"] == "profile-driver"


def test_trip_router_driver_cannot_create_trip(router_app, fake_supabase, driver_profile) -> None:
    client = TestClient(router_app(trips_router.router, driver_profile, trips_router))

    response = client.post(
        "/trips",
        json={"vehicle_id": "vehicle-1", "driver_id": "profile-driver", "trip_title": "Driver-created"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Drivers must start manager-assigned trips"
