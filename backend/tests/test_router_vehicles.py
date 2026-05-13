from fastapi.testclient import TestClient

import app.routers.vehicles as vehicles_router


def test_vehicle_router_lists_and_creates_manager_vehicle(router_app, fake_supabase, manager_profile) -> None:
    fake_supabase.tables["vehicles"] = [
        {"id": "vehicle-1", "org_id": "org-1", "plate_no": "MLV3-001", "status": "active"}
    ]
    client = TestClient(router_app(vehicles_router.router, manager_profile, vehicles_router))

    list_response = client.get("/vehicles")
    create_response = client.post(
        "/vehicles",
        json={"plate_no": "MLV3-002", "mileage": 12000, "vehicle_type": "Van"},
    )

    assert list_response.status_code == 200
    assert list_response.json()[0]["plate_no"] == "MLV3-001"
    assert create_response.status_code == 200
    assert create_response.json()["plate_no"] == "MLV3-002"
    assert create_response.json()["org_id"] == "org-1"
    assert fake_supabase.tables["vehicles"][-1]["odometer_km"] == 12000


def test_vehicle_router_returns_404_for_wrong_org_update(router_app, fake_supabase, manager_profile) -> None:
    fake_supabase.tables["vehicles"] = [
        {"id": "vehicle-2", "org_id": "other-org", "plate_no": "OUT-001"}
    ]
    client = TestClient(router_app(vehicles_router.router, manager_profile, vehicles_router))

    response = client.patch("/vehicles/vehicle-2", json={"plate_no": "MLV3-UPDATED"})

    assert response.status_code == 404
    assert response.json()["detail"] == "Vehicle not found"
