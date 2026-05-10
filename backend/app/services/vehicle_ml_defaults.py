from __future__ import annotations

from typing import Any


OPERATING_PROFILE_DEFAULTS = {
    "fuel_type": "diesel",
    "business_type": "delivery",
    "road_condition_primary": "mixed",
    "driver_behavior_profile": "normal",
    "expected_kmpl": 10.0,
    "typical_load_factor": 1.0,
}

COMPONENT_STATE_DEFAULTS = {
    "service_interval_km": 10000.0,
    "oil_interval_km": 5000.0,
    "tyre_life_km": 45000.0,
    "brake_life_km": 30000.0,
    "battery_life_months": 30.0,
    "fuel_filter_interval_km": 20000.0,
}

VEHICLE_TYPE_MAP = {
    "car": "car",
    "sedan": "car",
    "hatchback": "car",
    "suv": "van",
    "van": "van",
    "truck": "truck",
    "lorry": "truck",
    "bus": "bus",
    "pickup": "pickup",
    "pick_up": "pickup",
    "motorcycle": "car",
    "bike": "car",
}


def _is_blank(value: Any) -> bool:
    return value is None or value == ""


def _parse_float(value: Any) -> float | None:
    try:
        if _is_blank(value):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize_vehicle_type(value: Any) -> Any:
    if not isinstance(value, str) or not value.strip():
        return value
    normalized = value.strip().lower().replace(" ", "_").replace("-", "_")
    return VEHICLE_TYPE_MAP.get(normalized, normalized if normalized in {"car", "van", "truck", "bus", "pickup"} else "car")


def build_default_component_state(odometer_value: Any) -> dict[str, Any]:
    odometer = _parse_float(odometer_value)
    data: dict[str, Any] = dict(COMPONENT_STATE_DEFAULTS)
    if odometer is None:
        return data

    data.update(
        {
            "last_service_odometer_km": max(0.0, odometer - 6000.0),
            "last_oil_change_odometer_km": max(0.0, odometer - 3000.0),
            "last_tyre_change_odometer_km": max(0.0, odometer - 22000.0),
            "last_brake_service_odometer_km": max(0.0, odometer - 16000.0),
            "last_fuel_filter_change_odometer_km": max(0.0, odometer - 11000.0),
        }
    )
    return data


def fill_missing_vehicle_ml_defaults(
    vehicle_data: dict[str, Any],
    operating_data: dict[str, Any] | None = None,
    component_data: dict[str, Any] | None = None,
    existing_operating: dict[str, Any] | None = None,
    existing_component: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    vehicle = dict(vehicle_data)
    operating = dict(operating_data or {})
    component = dict(component_data or {})

    if vehicle.get("vehicle_type") is not None:
        vehicle["vehicle_type"] = normalize_vehicle_type(vehicle["vehicle_type"])

    for key, value in OPERATING_PROFILE_DEFAULTS.items():
        if _is_blank(operating.get(key)) and _is_blank((existing_operating or {}).get(key)):
            operating[key] = value

    odometer = vehicle.get("odometer_km")
    if _is_blank(odometer):
        odometer = vehicle.get("mileage")
    default_component = build_default_component_state(odometer)
    for key, value in default_component.items():
        if _is_blank(component.get(key)) and _is_blank((existing_component or {}).get(key)):
            component[key] = value

    return vehicle, operating, component
