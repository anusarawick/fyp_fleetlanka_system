import pytest
from pydantic import ValidationError

from app.schemas.fuel_logs import FuelLogCreate
from app.schemas.notifications import NotificationOut, NotificationPreferencesUpdate
from app.schemas.profiles import password_policy_errors
from app.schemas.trips import TripCreate
from app.schemas.vehicles import VehicleCreate


def test_core_create_schemas_accept_valid_payloads() -> None:
    vehicle = VehicleCreate(plate_no="WP-CAB-1234", year=2020, odometer_km=12000)
    trip = TripCreate(vehicle_id="vehicle-1", destination_lat=6.9271, destination_lon=79.8612)
    fuel = FuelLogCreate(vehicle_id="vehicle-1", fuel_date="2026-05-13", liters=42.5)

    assert vehicle.plate_no == "WP-CAB-1234"
    assert trip.status == "assigned"
    assert fuel.liters == 42.5


def test_schema_validation_rejects_missing_required_fields() -> None:
    with pytest.raises(ValidationError):
        VehicleCreate()
    with pytest.raises(ValidationError):
        FuelLogCreate(vehicle_id="vehicle-1", liters=20)


def test_notification_schema_defaults_metadata_and_preferences() -> None:
    notification = NotificationOut(
        id="alert-1",
        org_id="org-1",
        recipient_profile_id="profile-manager",
        alert_type="ml_high_risk",
        title="High maintenance risk",
        message="Vehicle risk score is high.",
        source_key="generated:ml:vehicle-1",
        created_at="2026-05-13T10:00:00+00:00",
    )
    update = NotificationPreferencesUpdate(documents=False, chat=True)

    assert notification.metadata == {}
    assert notification.severity == "info"
    assert update.documents is False
    assert update.chat is True


def test_password_policy_rejects_weak_passwords() -> None:
    assert "Password must be at least 10 characters." in password_policy_errors("Aa1!")
    assert "Password must include an uppercase letter." in password_policy_errors("fleetlanka#2026")
    assert "Password must include a lowercase letter." in password_policy_errors("FLEETLANKA#2026")
    assert "Password must include a number." in password_policy_errors("FleetLanka#")
    assert "Password must include a symbol." in password_policy_errors("FleetLanka2026")


def test_password_policy_rejects_personal_terms() -> None:
    errors = password_policy_errors("FleetLanka#2026", ["fleetlanka"])

    assert "Password must not include your name, organization, or email username." in errors


def test_password_policy_accepts_strong_password() -> None:
    assert password_policy_errors("RoadOps#2026") == []
    assert password_policy_errors("FleetLanka#2026") == []
