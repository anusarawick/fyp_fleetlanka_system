from __future__ import annotations

import copy
import sys
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core import deps


@pytest.fixture
def manager_profile() -> dict[str, Any]:
    return {
        "id": "profile-manager",
        "org_id": "org-1",
        "role": "manager",
        "status": "active",
        "full_name": "Fleet Manager",
    }


@pytest.fixture
def driver_profile() -> dict[str, Any]:
    return {
        "id": "profile-driver",
        "org_id": "org-1",
        "role": "driver",
        "status": "active",
        "full_name": "Driver One",
    }


@pytest.fixture
def service_profile() -> dict[str, Any]:
    return {
        "id": "profile-service",
        "org_id": "org-1",
        "role": "service",
        "status": "active",
        "full_name": "Service Center User",
    }


class FakeResponse:
    def __init__(self, data: Any = None, count: int | None = None):
        self.data = data
        self.count = count


class FakeSupabaseClient:
    def __init__(self, tables: dict[str, list[dict[str, Any]]] | None = None):
        self.tables = copy.deepcopy(tables or {})
        self.operations: list[dict[str, Any]] = []
        self.storage = FakeStorage()
        self.auth = FakeAuth()

    def table(self, name: str) -> "FakeTable":
        self.tables.setdefault(name, [])
        return FakeTable(self, name)


class FakeTable:
    def __init__(self, client: FakeSupabaseClient, name: str):
        self.client = client
        self.name = name
        self._filters: list[tuple[str, str, Any]] = []
        self._limit: int | None = None
        self._single = False
        self._operation = "select"
        self._payload: Any = None
        self._on_conflict: list[str] = []
        self._order_key: str | None = None
        self._order_desc = False

    def select(self, *_args: Any, **_kwargs: Any) -> "FakeTable":
        self._operation = "select"
        return self

    def eq(self, key: str, value: Any) -> "FakeTable":
        self._filters.append(("eq", key, value))
        return self

    def in_(self, key: str, values: list[Any]) -> "FakeTable":
        self._filters.append(("in", key, values))
        return self

    def neq(self, key: str, value: Any) -> "FakeTable":
        self._filters.append(("neq", key, value))
        return self

    def gte(self, key: str, value: Any) -> "FakeTable":
        self._filters.append(("gte", key, value))
        return self

    def lte(self, key: str, value: Any) -> "FakeTable":
        self._filters.append(("lte", key, value))
        return self

    def is_(self, key: str, value: Any) -> "FakeTable":
        self._filters.append(("is", key, value))
        return self

    def or_(self, _value: str) -> "FakeTable":
        return self

    def order(self, key: str, desc: bool = False, **_kwargs: Any) -> "FakeTable":
        self._order_key = key
        self._order_desc = desc
        return self

    def limit(self, value: int) -> "FakeTable":
        self._limit = value
        return self

    def single(self) -> "FakeTable":
        self._single = True
        return self

    def upsert(self, payload: dict[str, Any], on_conflict: str | None = None, **_kwargs: Any) -> "FakeTable":
        self._operation = "upsert"
        self._payload = payload
        self._on_conflict = [part.strip() for part in (on_conflict or "").split(",") if part.strip()]
        return self

    def update(self, payload: dict[str, Any]) -> "FakeTable":
        self._operation = "update"
        self._payload = payload
        return self

    def insert(self, payload: dict[str, Any]) -> "FakeTable":
        self._operation = "insert"
        self._payload = payload
        return self

    def delete(self) -> "FakeTable":
        self._operation = "delete"
        return self

    def execute(self) -> FakeResponse:
        rows = self.client.tables.setdefault(self.name, [])
        self.client.operations.append(
            {
                "table": self.name,
                "operation": self._operation,
                "payload": copy.deepcopy(self._payload),
                "filters": copy.deepcopy(self._filters),
                "on_conflict": list(self._on_conflict),
            }
        )

        if self._operation == "select":
            result = self._filtered_rows(rows)
            if self._order_key:
                result = sorted(result, key=lambda row: str(row.get(self._order_key) or ""), reverse=self._order_desc)
            if self._limit is not None:
                result = result[: self._limit]
            if self._single:
                return FakeResponse(copy.deepcopy(result[0]) if result else None)
            return FakeResponse(copy.deepcopy(result), count=len(result))

        if self._operation == "insert":
            record = copy.deepcopy(self._payload)
            if "id" not in record:
                record["id"] = f"{self.name}-{len(rows) + 1}"
            rows.append(record)
            return FakeResponse([copy.deepcopy(record)])

        if self._operation == "upsert":
            record = copy.deepcopy(self._payload)
            match = None
            if self._on_conflict:
                for existing in rows:
                    if all(existing.get(key) == record.get(key) for key in self._on_conflict):
                        match = existing
                        break
            if match is None:
                if "id" not in record:
                    record["id"] = f"{self.name}-{len(rows) + 1}"
                rows.append(record)
                match = record
            else:
                match.update(record)
            return FakeResponse([copy.deepcopy(match)])

        if self._operation == "update":
            updated = []
            for row in self._filtered_rows(rows):
                row.update(copy.deepcopy(self._payload))
                updated.append(copy.deepcopy(row))
            return FakeResponse(updated)

        if self._operation == "delete":
            kept = []
            deleted = []
            for row in rows:
                if self._matches(row):
                    deleted.append(copy.deepcopy(row))
                else:
                    kept.append(row)
            self.client.tables[self.name] = kept
            return FakeResponse(deleted)

        return FakeResponse(None)

    def _filtered_rows(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [row for row in rows if self._matches(row)]

    def _matches(self, row: dict[str, Any]) -> bool:
        for kind, key, value in self._filters:
            if kind == "eq" and row.get(key) != value:
                return False
            if kind == "in" and row.get(key) not in value:
                return False
            if kind == "neq" and row.get(key) == value:
                return False
            if kind == "gte" and str(row.get(key) or "") < str(value):
                return False
            if kind == "lte" and str(row.get(key) or "") > str(value):
                return False
            if kind == "is":
                if str(value).lower() == "null" and row.get(key) is not None:
                    return False
                if str(value).lower() != "null" and row.get(key) is None:
                    return False
        return True


class FakeAuth:
    def get_user(self, _token: str) -> Any:
        return type("AuthUserResponse", (), {"user": type("AuthUser", (), {"id": "profile-manager", "email": "manager@example.com"})()})()


class FakeStorageBucket:
    def upload(self, *_args: Any, **_kwargs: Any) -> None:
        return None

    def remove(self, *_args: Any, **_kwargs: Any) -> None:
        return None

    def create_signed_url(self, path: str, *_args: Any, **_kwargs: Any) -> dict[str, str]:
        return {"signedURL": f"https://storage.test/{path}"}


class FakeStorage:
    def from_(self, _bucket: str) -> FakeStorageBucket:
        return FakeStorageBucket()


@pytest.fixture
def fake_supabase() -> FakeSupabaseClient:
    return FakeSupabaseClient(
        {
            "profiles": [
                {"id": "profile-manager", "org_id": "org-1", "role": "manager", "status": "active"},
                {"id": "profile-service", "org_id": "org-1", "role": "service", "status": "active"},
            ],
            "service_centers": [
                {"id": "center-1", "org_id": "org-1", "profile_id": "profile-service", "name": "Colombo Auto Care"},
            ],
            "notification_preferences": [],
            "alerts": [],
        }
    )


@pytest.fixture
def router_app(monkeypatch: pytest.MonkeyPatch, fake_supabase: FakeSupabaseClient):
    def build(router: Any, profile: dict[str, Any] | None = None, *modules: Any) -> FastAPI:
        active_profile = profile or {
            "id": "profile-manager",
            "org_id": "org-1",
            "role": "manager",
            "status": "active",
            "full_name": "Fleet Manager",
        }
        for module in modules:
            if hasattr(module, "get_supabase_client"):
                monkeypatch.setattr(module, "get_supabase_client", lambda *args, **kwargs: fake_supabase)
            if hasattr(module, "sync_generated_notifications"):
                monkeypatch.setattr(module, "sync_generated_notifications", lambda *args, **kwargs: None)
            if hasattr(module, "reconcile_service_booking_payments"):
                monkeypatch.setattr(module, "reconcile_service_booking_payments", lambda *args, **kwargs: None)

        app = FastAPI()
        app.dependency_overrides[deps.get_bearer_token] = lambda: "token-1"
        app.dependency_overrides[deps.get_current_profile] = lambda: active_profile
        app.dependency_overrides[deps.require_manager_profile] = lambda: active_profile
        app.dependency_overrides[deps.require_manager_or_driver_profile] = lambda: active_profile
        app.dependency_overrides[deps.require_service_profile] = lambda: active_profile
        app.include_router(router)
        return app

    return build
