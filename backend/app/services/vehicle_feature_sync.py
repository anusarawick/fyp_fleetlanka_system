from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Optional


def _parse_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_int(value: Any) -> Optional[int]:
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _vehicle_age_months(vehicle: dict[str, Any]) -> int:
    current_year = datetime.now(timezone.utc).year
    year = _parse_int(vehicle.get("year"))
    if year is None:
        return 0
    return max(0, (current_year - year) * 12)


def apply_vehicle_feature_updates(supabase: Any, vehicle_id: str, updates: dict[str, Any]) -> None:
    if not updates:
        return
    supabase.table("vehicles").update(updates).eq("id", vehicle_id).execute()


def sync_service_maintenance_vehicle_features(
    supabase: Any,
    vehicle_id: str,
    *,
    last_service_cost_lkr: Optional[float],
    next_service_due_km: Optional[float],
) -> dict[str, Any]:
    cutoff = (datetime.now(timezone.utc).date() - timedelta(days=365)).isoformat()
    visits_resp = (
        supabase.table("maintenance")
        .select("id", count="exact")
        .eq("vehicle_id", vehicle_id)
        .gte("service_date", cutoff)
        .execute()
    )
    updates = {
        "last_service_cost_lkr": last_service_cost_lkr,
        "next_service_due_km": next_service_due_km,
        "service_center_visits_12m": visits_resp.count or 0,
    }
    apply_vehicle_feature_updates(supabase, vehicle_id, updates)
    return updates


def sync_trip_vehicle_features(supabase: Any, vehicle_id: str) -> dict[str, Any]:
    vehicle_resp = (
        supabase.table("vehicles")
        .select("id,year,odometer_km,mileage")
        .eq("id", vehicle_id)
        .single()
        .execute()
    )
    vehicle = vehicle_resp.data or {}
    if not vehicle:
        return {}

    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    trips_resp = (
        supabase.table("trips")
        .select("distance_km")
        .eq("vehicle_id", vehicle_id)
        .eq("status", "completed")
        .gte("end_time", cutoff)
        .execute()
    )
    trips = trips_resp.data or []
    recent_trip_count_30d = len(trips)
    recent_distance_km_30d = sum(_parse_float(row.get("distance_km")) or 0.0 for row in trips)

    avg_monthly_km = recent_distance_km_30d
    if avg_monthly_km <= 0:
        odometer_km = _parse_float(vehicle.get("odometer_km"))
        if odometer_km is None:
            odometer_km = _parse_float(vehicle.get("mileage")) or 0.0
        vehicle_age_months = _vehicle_age_months(vehicle)
        avg_monthly_km = odometer_km / max(vehicle_age_months, 1)

    updates = {
        "recent_trip_count_30d": recent_trip_count_30d,
        "avg_monthly_km": round(avg_monthly_km, 3),
    }
    apply_vehicle_feature_updates(supabase, vehicle_id, updates)
    return updates


def sync_fuel_vehicle_features(supabase: Any, vehicle_id: str) -> dict[str, Any]:
    cutoff = (datetime.now(timezone.utc).date() - timedelta(days=30)).isoformat()
    fuel_resp = (
        supabase.table("fuel_logs")
        .select("liters,odometer_km,fuel_date")
        .eq("vehicle_id", vehicle_id)
        .gte("fuel_date", cutoff)
        .order("fuel_date", desc=True)
        .execute()
    )
    rows = fuel_resp.data or []

    odometer_points = []
    liters_total = 0.0
    for row in rows:
        liters_total += _parse_float(row.get("liters")) or 0.0
        odometer = _parse_float(row.get("odometer_km"))
        if odometer is not None:
            odometer_points.append(odometer)

    recent_efficiency: Optional[float] = None
    if len(odometer_points) >= 2 and liters_total > 0:
        distance = max(0.0, max(odometer_points) - min(odometer_points))
        if distance > 0:
            recent_efficiency = round(distance / liters_total, 3)

    updates = {"recent_fuel_efficiency_avg": recent_efficiency}
    apply_vehicle_feature_updates(supabase, vehicle_id, updates)
    return updates
