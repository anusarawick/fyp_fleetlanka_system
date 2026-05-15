from fastapi.testclient import TestClient

import app.routers.documents as documents_router


def test_document_router_create_update_delete_flow(router_app, fake_supabase, manager_profile) -> None:
    fake_supabase.tables["documents"] = []
    client = TestClient(router_app(documents_router.router, manager_profile, documents_router))

    created = client.post(
        "/documents",
        json={"vehicle_id": "vehicle-1", "doc_type": "Revenue License", "expiry_date": "2026-05-20"},
    )
    updated = client.patch(f"/documents/{created.json()['id']}", json={"doc_number": "RL-100"})
    deleted = client.delete(f"/documents/{created.json()['id']}")

    assert created.status_code == 200
    assert created.json()["org_id"] == "org-1"
    assert updated.status_code == 200
    assert updated.json()["doc_number"] == "RL-100"
    assert deleted.status_code == 200
    assert deleted.json() == {"status": "ok"}


def test_document_router_rejects_missing_owner(router_app, fake_supabase, manager_profile) -> None:
    client = TestClient(router_app(documents_router.router, manager_profile, documents_router))

    response = client.post("/documents", json={"doc_type": "Insurance"})

    assert response.status_code == 422
