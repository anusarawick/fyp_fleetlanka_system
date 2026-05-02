from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

import pandas as pd
from fastapi import HTTPException

from app.ml.features_v3 import MAINTENANCE_FEATURE_COLUMNS, build_maintenance_v3_features


DEFAULT_COMPONENT_STATE = {
    "service_interval_km": 10000.0,
    "oil_interval_km": 5000.0,
    "tyre_life_km": 45000.0,
    "brake_life_km": 30000.0,
    "battery_life_months": 30.0,
    "fuel_filter_interval_km": 20000.0,
}

DEFAULT_OPERATING_PROFILE = {
    "fuel_type": "diesel",
    "business_type": "delivery",
    "road_condition_primary": "mixed",
    "driver_behavior_profile": "normal",
    "expected_kmpl": 10.0,
    "typical_load_factor": 1.0,
}

VEHICLE_TYPE_MAP = {
    "car": "car",
    "suv": "van",
    "van": "van",
    "truck": "truck",
    "bus": "bus",
    "motorcycle": "car",
}


def _parse_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _parse_int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _parse_date(value: Any) -> date | None:
    try:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except Exception:
        return None
    return None


def _days_since(value: Any, default: int = 365) -> int:
    parsed = _parse_date(value)
    if parsed is None:
        return default
    return max(0, (datetime.now(timezone.utc).date() - parsed).days)


def _date_days_ago(days: int) -> str:
    return (datetime.now(timezone.utc) - pd.Timedelta(days=days)).date().isoformat()


def _normalize_category(value: Any, default: str) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip().lower().replace(" ", "_").replace("-", "_")
    return default


def _normalize_vehicle_type(value: Any) -> str:
    normalized = _normalize_category(value, "car")
    return VEHICLE_TYPE_MAP.get(normalized, normalized if normalized in {"car", "van", "truck", "bus", "pickup"} else "car")


def _maintenance_kind(row: dict[str, Any]) -> str:
    raw = row.get("event_type") or row.get("service_type") or ""
    value = _normalize_category(raw, "")
    if "oil" in value:
        return "oil"
    if "tyre" in value or "tire" in value:
        return "tyre"
    if "brake" in value:
        return "brake"
    if "fuel" in value and "filter" in value:
        return "fuel_filter"
    if "battery" in value:
        return "battery"
    if "repair" in value:
        return "repair"
    if "service" in value:
        return "service"
    return value or "service"


def _latest_odometer(rows: list[dict[str, Any]], kinds: set[str]) -> float | None:
    for row in rows:
        if _maintenance_kind(row) in kinds and row.get("odometer_km") is not None:
            return _parse_float(row.get("odometer_km"))
    return None


def _fuel_efficiency(distance_km: float, liters: float, fallback: float) -> float:
    if distance_km > 0 and liters > 0:
        return distance_km / liters
    return fallback


def build_live_maintenance_v3_record(supabase: Any, org_id: str, vehicle_id: str) -> dict[str, Any]:
    vehicle_resp = (
        supabase.table("vehicles")
        .select("*")
        .eq("id", vehicle_id)
        .eq("org_id", org_id)
        .limit(1)
        .execute()
    )
    vehicles = vehicle_resp.data or []
    if not vehicles:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    vehicle = vehicles[0]

    operating_rows = (
        supabase.table("vehicle_operating_profiles")
        .select("*")
        .eq("vehicle_id", vehicle_id)
        .eq("org_id", org_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    component_rows = (
        supabase.table("vehicle_component_state")
        .select("*")
        .eq("vehicle_id", vehicle_id)
        .eq("org_id", org_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    operating = {**DEFAULT_OPERATING_PROFILE, **(operating_rows[0] if operating_rows else {})}
    component = {**DEFAULT_COMPONENT_STATE, **(component_rows[0] if component_rows else {})}

    maintenance_rows = (
        supabase.table("maintenance")
        .select("service_date,service_type,event_type,event_category,severity,cost_lkr,odometer_km,next_service_due_km")
        .eq("vehicle_id", vehicle_id)
        .eq("org_id", org_id)
        .order("service_date", desc=True)
        .execute()
        .data
        or []
    )
    trip_rows = (
        supabase.table("trips")
        .select("scheduled_start,start_time,end_time,distance_km,duration_min,avg_speed_kmh,idle_min")
        .eq("vehicle_id", vehicle_id)
        .eq("org_id", org_id)
        .gte("scheduled_start", _date_days_ago(56))
        .execute()
        .data
        or []
    )
    fuel_rows = (
        supabase.table("fuel_logs")
        .select("fuel_date,liters,cost_lkr,odometer_km")
        .eq("vehicle_id", vehicle_id)
        .eq("org_id", org_id)
        .gte("fuel_date", _date_days_ago(56))
        .execute()
        .data
        or []
    )

    today = datetime.now(timezone.utc).date()
    snapshot = today.isoformat()
    current_year = today.year
    vehicle_year = _parse_int(vehicle.get("year"), current_year - 5)
    vehicle_age = max(0, current_year - vehicle_year)
    odometer = _parse_float(vehicle.get("odometer_km"), _parse_float(vehicle.get("mileage"), 0.0))
    expected_kmpl = _parse_float(operating.get("expected_kmpl"), _parse_float(vehicle.get("fuel_efficiency"), 10.0))

    def rows_since(rows: list[dict[str, Any]], date_key: str, days: int) -> list[dict[str, Any]]:
        cutoff = today - pd.Timedelta(days=days)
        result = []
        for row in rows:
            parsed = _parse_date(row.get(date_key))
            if parsed and parsed >= cutoff:
                result.append(row)
        return result

    trips_7d = rows_since(trip_rows, "scheduled_start", 7)
    trips_28d = rows_since(trip_rows, "scheduled_start", 28)
    trips_56d = rows_since(trip_rows, "scheduled_start", 56)
    fuel_7d = rows_since(fuel_rows, "fuel_date", 7)
    fuel_28d = rows_since(fuel_rows, "fuel_date", 28)
    maint_84d = rows_since(maintenance_rows, "service_date", 84)
    maint_168d = rows_since(maintenance_rows, "service_date", 168)

    distance_week = sum(_parse_float(row.get("distance_km"), 0.0) for row in trips_7d)
    distance_4w = sum(_parse_float(row.get("distance_km"), 0.0) for row in trips_28d)
    distance_8w = sum(_parse_float(row.get("distance_km"), 0.0) for row in trips_56d)
    idle_week = sum(_parse_float(row.get("idle_min"), 0.0) for row in trips_7d)
    fuel_week = sum(_parse_float(row.get("liters"), 0.0) for row in fuel_7d)
    fuel_4w = sum(_parse_float(row.get("liters"), 0.0) for row in fuel_28d)

    avg_trip_distance = distance_week / len(trips_7d) if trips_7d else 0.0
    actual_efficiency = _fuel_efficiency(distance_week, fuel_week, expected_kmpl)
    efficiency_4w = _fuel_efficiency(distance_4w, fuel_4w, actual_efficiency)
    load_factor = _parse_float(operating.get("typical_load_factor"), 1.0)
    overload_ratio = max(0.75, load_factor)

    latest_service_odometer = (
        _parse_float(component.get("last_service_odometer_km"), -1.0)
        if component.get("last_service_odometer_km") is not None
        else (_latest_odometer(maintenance_rows, {"service"}) or -1.0)
    )
    latest_oil_odometer = (
        _parse_float(component.get("last_oil_change_odometer_km"), -1.0)
        if component.get("last_oil_change_odometer_km") is not None
        else (_latest_odometer(maintenance_rows, {"oil"}) or latest_service_odometer)
    )
    latest_tyre_odometer = (
        _parse_float(component.get("last_tyre_change_odometer_km"), -1.0)
        if component.get("last_tyre_change_odometer_km") is not None
        else (_latest_odometer(maintenance_rows, {"tyre"}) or latest_service_odometer)
    )
    latest_brake_odometer = (
        _parse_float(component.get("last_brake_service_odometer_km"), -1.0)
        if component.get("last_brake_service_odometer_km") is not None
        else (_latest_odometer(maintenance_rows, {"brake"}) or latest_service_odometer)
    )
    latest_fuel_filter_odometer = (
        _parse_float(component.get("last_fuel_filter_change_odometer_km"), -1.0)
        if component.get("last_fuel_filter_change_odometer_km") is not None
        else (_latest_odometer(maintenance_rows, {"fuel_filter"}) or latest_service_odometer)
    )

    fallback_last = max(0.0, odometer - _parse_float(component.get("service_interval_km"), 10000.0) * 0.6)
    if latest_service_odometer < 0:
        latest_service_odometer = fallback_last
    if latest_oil_odometer < 0:
        latest_oil_odometer = fallback_last
    if latest_tyre_odometer < 0:
        latest_tyre_odometer = max(0.0, odometer - 22000.0)
    if latest_brake_odometer < 0:
        latest_brake_odometer = max(0.0, odometer - 16000.0)
    if latest_fuel_filter_odometer < 0:
        latest_fuel_filter_odometer = max(0.0, odometer - 11000.0)

    repair_rows_24w = [row for row in maint_168d if _maintenance_kind(row) == "repair"]
    repair_costs = [_parse_float(row.get("cost_lkr"), 0.0) for row in repair_rows_24w if row.get("cost_lkr") is not None]
    last_maintenance_date = maintenance_rows[0].get("service_date") if maintenance_rows else None
    status = _normalize_category(vehicle.get("status"), "active")
    if status == "maintenance":
        status = "maintenance"
    elif status not in {"active", "inactive"}:
        status = "active"

    row = {
        "vehicle_id": vehicle_id,
        "snapshot_date": snapshot,
        "year": today.year,
        "month": today.month,
        "week_of_year": int(today.strftime("%V")),
        "vehicle_type": _normalize_vehicle_type(vehicle.get("vehicle_type")),
        "brand": _normalize_category(vehicle.get("make"), "unknown"),
        "model": _normalize_category(vehicle.get("model"), "unknown"),
        "fuel_type": _normalize_category(operating.get("fuel_type"), "diesel"),
        "engine_capacity_cc": _parse_int(vehicle.get("engine_size_cc"), 1500),
        "transmission_type": _normalize_category(vehicle.get("transmission_type"), "manual"),
        "business_type": _normalize_category(operating.get("business_type"), "delivery"),
        "province": "not_used",
        "district": "not_used",
        "road_condition_primary": _normalize_category(operating.get("road_condition_primary"), "mixed"),
        "driver_behavior_profile": _normalize_category(operating.get("driver_behavior_profile"), "normal"),
        "vehicle_age_years": vehicle_age,
        "odometer_km": odometer,
        "current_status": status,
        "weekly_distance_km": distance_week,
        "distance_last_4w": distance_4w,
        "distance_last_8w": distance_8w,
        "avg_weekly_distance_4w": distance_4w / 4.0 if distance_4w > 0 else distance_week,
        "trip_count_week": len(trips_7d),
        "trip_count_last_4w": len(trips_28d),
        "avg_trip_distance_week": avg_trip_distance,
        "idle_minutes_week": idle_week,
        "fuel_used_liters_week": fuel_week,
        "actual_fuel_efficiency_kmpl": actual_efficiency,
        "fuel_efficiency_avg_4w": efficiency_4w,
        "fuel_efficiency_change_4w": actual_efficiency - efficiency_4w,
        "overload_ratio_week": overload_ratio,
        "overload_avg_last_4w": overload_ratio,
        "km_since_last_service": max(0.0, odometer - latest_service_odometer),
        "km_since_last_oil_change": max(0.0, odometer - latest_oil_odometer),
        "km_since_last_tyre_change": max(0.0, odometer - latest_tyre_odometer),
        "km_since_last_brake_service": max(0.0, odometer - latest_brake_odometer),
        "km_since_last_fuel_filter_change": max(0.0, odometer - latest_fuel_filter_odometer),
        "battery_age_months": _days_since(component.get("battery_installed_at"), 540) / 30.4,
        "service_interval_km": _parse_float(component.get("service_interval_km"), 10000.0),
        "oil_interval_km": _parse_float(component.get("oil_interval_km"), 5000.0),
        "tyre_life_km": _parse_float(component.get("tyre_life_km"), 45000.0),
        "brake_life_km": _parse_float(component.get("brake_life_km"), 30000.0),
        "battery_life_months": _parse_float(component.get("battery_life_months"), 30.0),
        "fuel_filter_interval_km": _parse_float(component.get("fuel_filter_interval_km"), 20000.0),
        "missed_services_count": 1 if maintenance_rows and _days_since(last_maintenance_date, 365) > 240 else 0,
        "accident_count": _parse_int(vehicle.get("accident_history_count"), 0),
        "repeat_failure_count": len(repair_rows_24w),
        "maintenance_events_last_12w": len(maint_84d),
        "repair_events_last_24w": len(repair_rows_24w),
        "avg_repair_cost_last_24w": sum(repair_costs) / len(repair_costs) if repair_costs else 0.0,
        "days_since_last_maintenance": _days_since(last_maintenance_date, 365),
    }

    feature_frame = build_maintenance_v3_features(pd.DataFrame([row]), include_target=False)
    record = feature_frame.iloc[0].to_dict()
    return {column: record[column] for column in MAINTENANCE_FEATURE_COLUMNS if column in record}
