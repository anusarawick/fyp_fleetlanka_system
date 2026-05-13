from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.core.deps import get_current_profile
from app.routers.health import router as health_router


def make_test_app() -> FastAPI:
    app = FastAPI()
    app.include_router(health_router)
    return app


def test_health_endpoint_returns_ok() -> None:
    response = TestClient(make_test_app()).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_protected_endpoint_requires_bearer_token() -> None:
    try:
        get_current_profile(token=None)
    except HTTPException as exc:
        assert exc.status_code == 401
        assert exc.detail == "Missing bearer token"
    else:
        raise AssertionError("Expected missing token to raise HTTPException")
