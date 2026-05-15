from app.services.maintenance_sync import (
    build_maintenance_from_booking,
    default_event_category,
    default_severity,
    normalize_maintenance_kind,
    requires_component_odometer,
    sync_component_state_from_maintenance,
)


def test_normalize_maintenance_kind_handles_common_labels() -> None:
    assert normalize_maintenance_kind("Oil Change") == "oil"
    assert normalize_maintenance_kind("tire replacement") == "tyre"
    assert normalize_maintenance_kind("Brake-Check") == "brake"
    assert normalize_maintenance_kind("") == "service"


def test_default_category_and_severity() -> None:
    assert default_event_category("repair") == "repair"
    assert default_event_category("inspection") == "inspection"
    assert default_event_category("oil") == "component"
    assert default_severity("repair") == "minor"
    assert default_severity("service") == "routine"


def test_build_maintenance_from_completed_booking() -> None:
    booking = {
        "id": "booking-1",
        "org_id": "org-1",
        "vehicle_id": "vehicle-1",
        "center_id": "center-1",
        "completed_at": "2026-05-13T09:30:00+00:00",
        "requested_date": "2026-05-10",
        "work_type": "Oil Service",
        "notes": "Manager note",
        "service_notes": "Changed oil",
        "final_cost_lkr": 15000,
        "completed_odometer_km": 45000,
        "next_service_due_km": 50000,
    }

    record = build_maintenance_from_booking(booking, {"name": "Colombo Auto Care"})

    assert record["service_date"] == "2026-05-13"
    assert record["event_category"] == "component"
    assert record["severity"] == "routine"
    assert record["cost_lkr"] == 15000
    assert "Colombo Auto Care" in record["notes"]


def test_component_state_sync_updates_matching_component(fake_supabase) -> None:
    sync_component_state_from_maintenance(
        fake_supabase,
        "org-1",
        {
            "vehicle_id": "vehicle-1",
            "event_type": "brake service",
            "odometer_km": 36000,
        },
    )

    state = fake_supabase.tables["vehicle_component_state"][0]
    assert state["vehicle_id"] == "vehicle-1"
    assert state["last_brake_service_odometer_km"] == 36000
    assert requires_component_odometer({"event_type": "brake service"}) is True
