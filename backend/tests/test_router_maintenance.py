from fastapi.testclient import TestClient

import app.routers.maintenance as maintenance_router


def test_maintenance_router_lists_and_creates_record(router_app, fake_supabase, manager_profile) -> None:
    fake_supabase.tables["maintenance"] = [
        {
            "id": "maintenance-1",
            "org_id": "org-1",
            "vehicle_id": "vehicle-1",
            "service_date": "2026-05-10",
            "service_type": "Regular Service",
        }
    ]
    client = TestClient(router_app(maintenance_router.router, manager_profile, maintenance_router))

    listed = client.get("/maintenance")
    created = client.post(
        "/maintenance",
        json={
            "vehicle_id": "vehicle-1",
            "service_date": "2026-05-13",
            "service_type": "Inspection",
            "event_type": "Inspection",
        },
    )

    assert listed.status_code == 200
    assert listed.json()[0]["id"] == "maintenance-1"
    assert created.status_code == 200
    assert created.json()["org_id"] == "org-1"


def test_maintenance_router_requires_odometer_for_component_events(router_app, fake_supabase, manager_profile) -> None:
    client = TestClient(router_app(maintenance_router.router, manager_profile, maintenance_router))

    response = client.post(
        "/maintenance",
        json={"vehicle_id": "vehicle-1", "service_date": "2026-05-13", "event_type": "Brake Service"},
    )

    assert response.status_code == 400
    assert "Odometer is required" in response.json()["detail"]
