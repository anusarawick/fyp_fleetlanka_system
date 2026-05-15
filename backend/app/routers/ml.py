import json
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.deps import get_bearer_token, require_manager_profile
from app.ml.predict import FuelPredictor, MaintenancePredictor
from app.ml.train_fuel import SELECTED_ENGINEERED_COLUMNS as FUEL_ENGINEERED_COLUMNS
from app.ml.train_fuel import enrich_fuel_features
from app.ml.train_maintenance_v2 import enrich_maintenance_features_v2
from app.services.maintenance_v3_features import build_live_maintenance_v3_record
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/ml", tags=["ml"])

ALLOWED_VEHICLE_MODELS = {"Bus", "Car", "Motorcycle", "SUV", "Truck", "Van"}
DEFAULTS = {
    "Vehicle_Model": "Car",
    "Maintenance_History": "Average",
    "Transmission_Type": "Automatic",
    "Tire_Condition": "Good",
    "Brake_Condition": "Good",
    "Battery_Status": "Good",
    "Mileage": 0.0,
    "Reported_Issues": 0,
    "Vehicle_Age": 5,
    "Engine_Size": 1500,
    "Service_History": 0,
    "Accident_History": 0,
    "Fuel_Efficiency": 12.0,
    "days_since_last_service": 180,
    "last_service_cost_lkr": 0.0,
    "next_service_due_km": 5000.0,
    "avg_monthly_km": 1200.0,
    "recent_trip_count_30d": 0,
    "recent_fuel_efficiency_avg": 12.0,
    "service_center_visits_12m": 0,
}
MAINTENANCE_V2_MODEL_PATH = "app/ml/models/maintenance_model_v2.pkl"
MAINTENANCE_V2_META_PATH = "app/ml/models/maintenance_model_v2_meta.json"
MAINTENANCE_V3_MODEL_PATH = "app/ml/models/maintenance_model_v3.pkl"
MAINTENANCE_V3_META_PATH = "app/ml/models/maintenance_model_v3_meta.json"
FUEL_MODEL_PATH = "app/ml/models/fuel_model.pkl"
FUEL_META_PATH = "app/ml/models/fuel_model_meta.json"


class MaintenanceRequest(BaseModel):
    features: Optional[list[list[float]]] = None
    records: Optional[list[dict[str, Any]]] = None


class FuelRequest(BaseModel):
    features: list[list[float]]


def _require_token(token: Optional[str]) -> str:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return token


def _parse_float(value: Any, default: float) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _parse_int(value: Any, default: int) -> int:
    try:
        if value is None:
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _coerce_vehicle_model(value: Any) -> str:
    if isinstance(value, str):
        normalized = value.strip()
        if normalized in ALLOWED_VEHICLE_MODELS:
            return normalized
    return DEFAULTS["Vehicle_Model"]


def _coerce_enum(value: Any, allowed: set[str], default: str) -> str:
    if isinstance(value, str):
        normalized = value.strip()
        if normalized in allowed:
            return normalized
    return default


def _to_days_since(service_date: Any) -> int:
    if service_date is None:
        return DEFAULTS["days_since_last_service"]
    try:
        if isinstance(service_date, str):
            parsed = datetime.fromisoformat(service_date.replace("Z", "+00:00")).date()
        elif isinstance(service_date, datetime):
            parsed = service_date.date()
        elif isinstance(service_date, date):
            parsed = service_date
        else:
            return DEFAULTS["days_since_last_service"]
        return max(0, (datetime.now(timezone.utc).date() - parsed).days)
    except Exception:
        return DEFAULTS["days_since_last_service"]


def _build_maintenance_record_for_vehicle(supabase: Any, vehicle_id: str) -> dict[str, Any]:
    vehicle_resp = (
        supabase.table("vehicles")
        .select("*")
        .eq("id", vehicle_id)
        .limit(1)
        .execute()
    )
    vehicles = vehicle_resp.data or []
    if not vehicles:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    v = vehicles[0]

    maint_resp = (
        supabase.table("maintenance")
        .select("service_date,cost_lkr,next_service_due_km")
        .eq("vehicle_id", vehicle_id)
        .order("service_date", desc=True)
        .execute()
    )
    maint_rows = maint_resp.data or []
    service_history = len(maint_rows)
    last_service_date = maint_rows[0]["service_date"] if maint_rows else None
    latest_maintenance = maint_rows[0] if maint_rows else {}

    recent_trip_cutoff = (datetime.now(timezone.utc) - pd.Timedelta(days=30)).isoformat()
    recent_trips_resp = (
        supabase.table("trips")
        .select("id", count="exact")
        .eq("vehicle_id", vehicle_id)
        .gte("scheduled_start", recent_trip_cutoff)
        .execute()
    )
    recent_trip_count = recent_trips_resp.count or 0

    recent_fuel_resp = (
        supabase.table("fuel_logs")
        .select("liters,odometer_km")
        .eq("vehicle_id", vehicle_id)
        .order("fuel_date", desc=True)
        .limit(5)
        .execute()
    )
    fuel_rows = recent_fuel_resp.data or []
    recent_fuel_efficiency_avg = _parse_float(v.get("recent_fuel_efficiency_avg"), 0.0)
    if recent_fuel_efficiency_avg <= 0.0:
        odometer_points = [
            _parse_float(row.get("odometer_km"), -1.0)
            for row in fuel_rows
            if row.get("odometer_km") is not None
        ]
        liters_total = sum(_parse_float(row.get("liters"), 0.0) for row in fuel_rows)
        if len(odometer_points) >= 2 and liters_total > 0:
            distance = max(0.0, max(odometer_points) - min(odometer_points))
            recent_fuel_efficiency_avg = distance / liters_total if distance > 0 else 0.0

    service_center_visits_12m = _parse_int(v.get("service_center_visits_12m"), -1)
    if service_center_visits_12m < 0:
        visit_cutoff = (datetime.now(timezone.utc) - pd.Timedelta(days=365)).date().isoformat()
        recent_visits = [
            row for row in maint_rows
            if isinstance(row.get("service_date"), str) and row["service_date"] >= visit_cutoff
        ]
        service_center_visits_12m = len(recent_visits)

    current_year = datetime.now(timezone.utc).year
    vehicle_year = _parse_int(v.get("year"), current_year - DEFAULTS["Vehicle_Age"])
    vehicle_age = max(0, current_year - vehicle_year)

    raw_model = v.get("vehicle_type") or v.get("model")
    vehicle_model = _coerce_vehicle_model(raw_model)

    maintenance_history = v.get("maintenance_history")
    if not isinstance(maintenance_history, str):
        if service_history >= 6:
            maintenance_history = "Good"
        elif service_history >= 3:
            maintenance_history = "Average"
        else:
            maintenance_history = "Poor"
    maintenance_history = _coerce_enum(
        maintenance_history,
        {"Good", "Average", "Poor"},
        DEFAULTS["Maintenance_History"],
    )

    record = {
        "Vehicle_Model": vehicle_model,
        "Mileage": _parse_float(v.get("odometer_km"), DEFAULTS["Mileage"]),
        "Maintenance_History": maintenance_history,
        "Reported_Issues": _parse_int(v.get("reported_issues_count"), DEFAULTS["Reported_Issues"]),
        "Vehicle_Age": vehicle_age,
        "Transmission_Type": _coerce_enum(
            v.get("transmission_type"),
            {"Automatic", "Manual"},
            DEFAULTS["Transmission_Type"],
        ),
        "Engine_Size": _parse_int(v.get("engine_size_cc"), DEFAULTS["Engine_Size"]),
        "Service_History": service_history,
        "Accident_History": _parse_int(v.get("accident_history_count"), DEFAULTS["Accident_History"]),
        "Fuel_Efficiency": _parse_float(v.get("fuel_efficiency"), DEFAULTS["Fuel_Efficiency"]),
        "Tire_Condition": _coerce_enum(
            v.get("tire_condition"),
            {"New", "Good", "Worn Out"},
            DEFAULTS["Tire_Condition"],
        ),
        "Brake_Condition": _coerce_enum(
            v.get("brake_condition"),
            {"New", "Good", "Worn Out"},
            DEFAULTS["Brake_Condition"],
        ),
        "Battery_Status": _coerce_enum(
            v.get("battery_status"),
            {"New", "Good", "Weak"},
            DEFAULTS["Battery_Status"],
        ),
        "days_since_last_service": _to_days_since(last_service_date),
        "last_service_cost_lkr": _parse_float(
            v.get("last_service_cost_lkr"),
            _parse_float(latest_maintenance.get("cost_lkr"), DEFAULTS["last_service_cost_lkr"]),
        ),
        "next_service_due_km": _parse_float(
            v.get("next_service_due_km"),
            _parse_float(
                latest_maintenance.get("next_service_due_km"),
                _parse_float(v.get("odometer_km"), DEFAULTS["Mileage"]) + DEFAULTS["next_service_due_km"],
            ),
        ),
        "avg_monthly_km": _parse_float(
            v.get("avg_monthly_km"),
            _parse_float(v.get("odometer_km"), DEFAULTS["Mileage"]) / max(vehicle_age * 12, 1),
        ),
        "recent_trip_count_30d": _parse_int(v.get("recent_trip_count_30d"), recent_trip_count),
        "recent_fuel_efficiency_avg": recent_fuel_efficiency_avg
        if recent_fuel_efficiency_avg > 0
        else _parse_float(v.get("fuel_efficiency"), DEFAULTS["recent_fuel_efficiency_avg"]),
        "service_center_visits_12m": service_center_visits_12m,
    }
    return record


def _build_maintenance_v2_feature_record(raw_record: dict[str, Any]) -> dict[str, Any]:
    frame = pd.DataFrame([raw_record])
    enriched = enrich_maintenance_features_v2(frame)
    return enriched.iloc[0].to_dict()


def _compute_risk_levels(probs: list[float], threshold: float) -> list[str]:
    risk_levels = []
    high_cutoff = min(0.95, max(threshold + 0.2, 0.7))
    for p in probs:
        if p >= high_cutoff:
            risk_levels.append("high")
        elif p >= threshold:
            risk_levels.append("medium")
        else:
            risk_levels.append("low")
    return risk_levels


def _read_maintenance_model_version() -> str:
    meta_path = Path(MAINTENANCE_V3_META_PATH)
    if not meta_path.exists():
        return "maintenance_model_unknown"
    try:
        raw = json.loads(meta_path.read_text())
        if raw.get("target") == "Need_Maintenance_7d":
            return raw.get("model_version") or "maintenance_v3_weekly_rf"
        params = raw.get("selected_hyperparameters", {})
        threshold = raw.get("decision_threshold", "na")
        n_estimators = params.get("n_estimators", "na")
        max_depth = params.get("max_depth", "na")
        return f"rf_n{n_estimators}_d{max_depth}_thr{threshold}"
    except Exception:
        return "maintenance_model_unknown"


def _read_fuel_model_version() -> str:
    meta_path = Path(FUEL_META_PATH)
    if not meta_path.exists():
        return "fuel_model_unknown"
    try:
        raw = json.loads(meta_path.read_text())
        if raw.get("target") == "predicted_fuel_liters_7d":
            return "fuel_v1_7d_rf"
    except Exception:
        return "fuel_model_unknown"
    return "fuel_model_unknown"


def _date_string_days_ago(days: int) -> str:
    return (datetime.now(timezone.utc) - pd.Timedelta(days=days)).date().isoformat()


def _parse_date(value: Any) -> Optional[date]:
    try:
        if value is None:
            return None
        if isinstance(value, date) and not isinstance(value, datetime):
            return value
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, str):
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except Exception:
        return None
    return None


def _days_since_date(value: Any, default: int = 30) -> int:
    parsed = _parse_date(value)
    if parsed is None:
        return default
    return max(0, (datetime.now(timezone.utc).date() - parsed).days)


def _weighted_average_speed(rows: list[dict[str, Any]]) -> float:
    weighted_distance = 0.0
    weighted_speed = 0.0
    speeds: list[float] = []
    for row in rows:
        speed = _parse_float(row.get("avg_speed_kmh"), 0.0)
        if speed <= 0:
            continue
        distance = _parse_float(row.get("distance_km"), 0.0)
        if distance > 0:
            weighted_distance += distance
            weighted_speed += distance * speed
        speeds.append(speed)
    if weighted_distance > 0:
        return weighted_speed / weighted_distance
    if speeds:
        return sum(speeds) / len(speeds)
    return 35.0


def _distance_from_odometer(rows: list[dict[str, Any]]) -> float:
    odometers = [
        _parse_float(row.get("odometer_km"), -1.0)
        for row in rows
        if row.get("odometer_km") is not None
    ]
    if len(odometers) < 2:
        return 0.0
    return max(0.0, max(odometers) - min(odometers))


def _build_fuel_feature_record(raw_record: dict[str, Any]) -> dict[str, Any]:
    frame = pd.DataFrame([raw_record])
    enriched = enrich_fuel_features(frame)
    selected_columns = list(raw_record.keys()) + FUEL_ENGINEERED_COLUMNS
    return enriched[selected_columns].iloc[0].to_dict()


def _build_fuel_forecast_contexts(supabase: Any, org_id: str, vehicle_id: Optional[str] = None) -> list[dict[str, Any]]:
    vehicle_query = supabase.table("vehicles").select("*").eq("org_id", org_id)
    if vehicle_id:
        vehicle_query = vehicle_query.eq("id", vehicle_id)
    vehicles = vehicle_query.execute().data or []
    if vehicle_id and not vehicles:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if not vehicles:
        return []

    vehicle_ids = [str(v["id"]) for v in vehicles if v.get("id")]
    cutoff_7 = _date_string_days_ago(7)
    cutoff_30 = _date_string_days_ago(30)
    cutoff_90 = _date_string_days_ago(90)

    trip_query = (
        supabase.table("trips")
        .select("vehicle_id,scheduled_start,distance_km,idle_min,avg_speed_kmh")
        .eq("org_id", org_id)
        .gte("scheduled_start", cutoff_30)
    )
    fuel_query = (
        supabase.table("fuel_logs")
        .select("vehicle_id,fuel_date,liters,cost_lkr,odometer_km")
        .eq("org_id", org_id)
        .gte("fuel_date", cutoff_90)
        .order("fuel_date", desc=True)
    )
    if vehicle_id:
        trip_query = trip_query.eq("vehicle_id", vehicle_id)
        fuel_query = fuel_query.eq("vehicle_id", vehicle_id)

    trip_rows = trip_query.execute().data or []
    fuel_rows = fuel_query.execute().data or []

    trips_by_vehicle: dict[str, list[dict[str, Any]]] = {vid: [] for vid in vehicle_ids}
    for row in trip_rows:
        vid = str(row.get("vehicle_id") or "")
        if vid in trips_by_vehicle:
            trips_by_vehicle[vid].append(row)

    fuel_by_vehicle: dict[str, list[dict[str, Any]]] = {vid: [] for vid in vehicle_ids}
    for row in fuel_rows:
        vid = str(row.get("vehicle_id") or "")
        if vid in fuel_by_vehicle:
            fuel_by_vehicle[vid].append(row)

    current_year = datetime.now(timezone.utc).year
    contexts: list[dict[str, Any]] = []
    for vehicle in vehicles:
        vid = str(vehicle["id"])
        vehicle_trips_30d = trips_by_vehicle.get(vid, [])
        vehicle_trips_7d = [
            row for row in vehicle_trips_30d
            if isinstance(row.get("scheduled_start"), str) and row["scheduled_start"][:10] >= cutoff_7
        ]
        vehicle_fuel_rows = fuel_by_vehicle.get(vid, [])
        vehicle_fuel_30d = [
            row for row in vehicle_fuel_rows
            if isinstance(row.get("fuel_date"), str) and row["fuel_date"] >= cutoff_30
        ]
        vehicle_fuel_7d = [
            row for row in vehicle_fuel_rows
            if isinstance(row.get("fuel_date"), str) and row["fuel_date"] >= cutoff_7
        ]

        recent_trip_count_30d = len(vehicle_trips_30d)
        recent_distance_km_30d = sum(_parse_float(row.get("distance_km"), 0.0) for row in vehicle_trips_30d)
        recent_distance_km_7d = sum(_parse_float(row.get("distance_km"), 0.0) for row in vehicle_trips_7d)
        recent_idle_min_30d = sum(_parse_float(row.get("idle_min"), 0.0) for row in vehicle_trips_30d)
        recent_idle_min_7d = sum(_parse_float(row.get("idle_min"), 0.0) for row in vehicle_trips_7d)
        recent_avg_speed_kmh = _weighted_average_speed(vehicle_trips_30d)

        if recent_distance_km_30d <= 0.0:
            recent_distance_km_30d = _distance_from_odometer(vehicle_fuel_30d)
        if recent_distance_km_7d <= 0.0:
            recent_distance_km_7d = _distance_from_odometer(vehicle_fuel_7d)

        vehicle_year = _parse_int(vehicle.get("year"), current_year - 5)
        vehicle_age = max(0, current_year - vehicle_year)
        odometer_km = _parse_float(vehicle.get("odometer_km"), _parse_float(vehicle.get("mileage"), 0.0))
        avg_monthly_km = _parse_float(vehicle.get("avg_monthly_km"), 0.0)
        if avg_monthly_km <= 0.0:
            avg_monthly_km = recent_distance_km_30d if recent_distance_km_30d > 0 else odometer_km / max(vehicle_age * 12, 1)
        if recent_distance_km_30d <= 0.0:
            recent_distance_km_30d = max(avg_monthly_km, 80.0)
        if recent_distance_km_7d <= 0.0:
            recent_distance_km_7d = max((recent_distance_km_30d / 30.0) * 7.0, 20.0)

        last_30d_fuel_liters = sum(_parse_float(row.get("liters"), 0.0) for row in vehicle_fuel_30d)
        last_7d_fuel_liters = sum(_parse_float(row.get("liters"), 0.0) for row in vehicle_fuel_7d)
        last_30d_fuel_cost_lkr = sum(_parse_float(row.get("cost_lkr"), 0.0) for row in vehicle_fuel_30d)
        fuel_price_per_liter = (
            last_30d_fuel_cost_lkr / last_30d_fuel_liters
            if last_30d_fuel_liters > 0
            else 360.0
        )

        rated_efficiency = _parse_float(vehicle.get("fuel_efficiency"), 12.0)
        recent_efficiency = _parse_float(vehicle.get("recent_fuel_efficiency_avg"), 0.0)
        if recent_efficiency <= 0.0 and last_30d_fuel_liters > 0 and recent_distance_km_30d > 0:
            recent_efficiency = recent_distance_km_30d / last_30d_fuel_liters
        if recent_efficiency <= 0.0:
            recent_efficiency = rated_efficiency

        latest_fuel_date = vehicle_fuel_rows[0]["fuel_date"] if vehicle_fuel_rows else None
        days_since_last_fuel = _days_since_date(latest_fuel_date, default=30)

        raw_record = {
            "Vehicle_Model": _coerce_vehicle_model(vehicle.get("vehicle_type") or vehicle.get("model")),
            "Vehicle_Age": vehicle_age,
            "Transmission_Type": _coerce_enum(
                vehicle.get("transmission_type"),
                {"Automatic", "Manual"},
                DEFAULTS["Transmission_Type"],
            ),
            "Engine_Size": _parse_int(vehicle.get("engine_size_cc"), DEFAULTS["Engine_Size"]),
            "Fuel_Efficiency": rated_efficiency,
            "recent_fuel_efficiency_avg": recent_efficiency,
            "odometer_km": odometer_km,
            "avg_monthly_km": avg_monthly_km,
            "recent_trip_count_30d": _parse_int(vehicle.get("recent_trip_count_30d"), recent_trip_count_30d),
            "recent_distance_km_7d": recent_distance_km_7d,
            "recent_distance_km_30d": recent_distance_km_30d,
            "recent_idle_min_7d": recent_idle_min_7d,
            "recent_idle_min_30d": recent_idle_min_30d,
            "recent_avg_speed_kmh": recent_avg_speed_kmh,
            "last_7d_fuel_liters": last_7d_fuel_liters,
            "last_30d_fuel_liters": last_30d_fuel_liters,
            "last_30d_fuel_cost_lkr": last_30d_fuel_cost_lkr,
            "days_since_last_fuel": days_since_last_fuel,
            "fuel_price_per_liter": fuel_price_per_liter,
        }
        contexts.append(
            {
                "vehicle_id": vid,
                "plate_no": vehicle.get("plate_no") or "Vehicle",
                "raw_record": raw_record,
                "record": _build_fuel_feature_record(raw_record),
            }
        )

    return contexts


@router.get("/maintenance/predictions")
def list_maintenance_predictions(
    vehicle_id: Optional[str] = None,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> list[dict]:
    token = _require_token(token)
    supabase = get_supabase_client(use_service_role=True)
    query = (
        supabase.table("maintenance_predictions")
        .select("*")
        .eq("org_id", profile["org_id"])
        .order("predicted_at", desc=True)
    )
    if vehicle_id:
        query = query.eq("vehicle_id", vehicle_id)
    response = query.execute()
    return response.data or []


@router.delete("/maintenance/predictions/{prediction_id}")
def delete_maintenance_prediction(
    prediction_id: str,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> dict:
    token = _require_token(token)
    supabase = get_supabase_client(use_service_role=True)
    response = (
        supabase.table("maintenance_predictions")
        .delete()
        .eq("id", prediction_id)
        .eq("org_id", profile["org_id"])
        .execute()
    )
    if response.data is None:
        raise HTTPException(status_code=400, detail="Delete failed")
    return {"status": "ok"}


@router.post("/maintenance")
def predict_maintenance(
    payload: MaintenanceRequest,
    profile: dict = Depends(require_manager_profile),
) -> dict:
    try:
        if payload.records is not None:
            predictor = MaintenancePredictor(MAINTENANCE_V3_MODEL_PATH, MAINTENANCE_V3_META_PATH)
        else:
            predictor = MaintenancePredictor(MAINTENANCE_V2_MODEL_PATH, MAINTENANCE_V2_META_PATH)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    try:
        if payload.records is not None:
            preds, probs, threshold = predictor.predict_records_with_threshold(payload.records)
        elif payload.features is not None:
            preds, probs, threshold = predictor.predict_with_threshold(payload.features)
        else:
            raise ValueError("Either 'records' or 'features' must be provided")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    risk_levels = _compute_risk_levels(probs, threshold)

    return {
        "predictions": preds,
        "probabilities": probs,
        "threshold_used": threshold,
        "risk_levels": risk_levels,
    }


@router.post("/maintenance/by-vehicle/{vehicle_id}")
def predict_maintenance_by_vehicle(
    vehicle_id: str,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> dict:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    prediction_store = get_supabase_client(use_service_role=True)
    try:
        record = build_live_maintenance_v3_record(supabase, profile["org_id"], vehicle_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to build maintenance feature record: {exc}")

    try:
        predictor = MaintenancePredictor(MAINTENANCE_V3_MODEL_PATH, MAINTENANCE_V3_META_PATH)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    try:
        preds, probs, threshold = predictor.predict_records_with_threshold([record])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    risk_level = _compute_risk_levels(probs, threshold)[0]
    prediction = int(preds[0])
    probability = float(probs[0])

    save_payload = {
        "org_id": profile["org_id"],
        "vehicle_id": vehicle_id,
        "prediction": prediction,
        "probability": probability,
        "risk_level": risk_level,
        "threshold_used": float(threshold),
        "model_version": _read_maintenance_model_version(),
        "input_features": record,
    }
    try:
        save_response = prediction_store.table("maintenance_predictions").insert(save_payload).execute()
        if not save_response.data:
            raise HTTPException(
                status_code=500,
                detail="Failed to persist maintenance prediction. Apply latest Supabase migration.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to persist maintenance prediction. Apply latest Supabase migration. ({exc})",
        )

    return {
        "vehicle_id": vehicle_id,
        "prediction": prediction,
        "probability": probability,
        "threshold_used": float(threshold),
        "risk_level": risk_level,
        "record": record,
        "saved_prediction": save_response.data[0],
        "saved": True,
    }


@router.get("/fuel/forecast")
def list_fuel_forecasts(
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> dict:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    try:
        contexts = _build_fuel_forecast_contexts(supabase, profile["org_id"])
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to build fuel forecast contexts: {exc}")

    if not contexts:
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "model_version": _read_fuel_model_version(),
            "forecasts": [],
        }

    try:
        predictor = FuelPredictor(FUEL_MODEL_PATH, FUEL_META_PATH)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    try:
        predicted = predictor.predict_records([context["record"] for context in contexts])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    forecasts = []
    for context, forecast in zip(contexts, predicted):
        raw_record = context["raw_record"]
        forecasts.append(
            {
                "vehicle_id": context["vehicle_id"],
                "plate_no": context["plate_no"],
                "forecast_liters_7d": round(float(forecast), 2),
                "recent_7d_liters": round(float(raw_record["last_7d_fuel_liters"]), 2),
                "recent_30d_liters": round(float(raw_record["last_30d_fuel_liters"]), 2),
                "recent_distance_km_30d": round(float(raw_record["recent_distance_km_30d"]), 2),
                "recent_trip_count_30d": int(raw_record["recent_trip_count_30d"]),
                "recent_avg_speed_kmh": round(float(raw_record["recent_avg_speed_kmh"]), 2),
                "fuel_efficiency_gap_ratio": round(
                    max(
                        0.0,
                        (float(raw_record["Fuel_Efficiency"]) - float(raw_record["recent_fuel_efficiency_avg"]))
                        / max(float(raw_record["Fuel_Efficiency"]), 1.0),
                    ),
                    4,
                ),
            }
        )

    forecasts.sort(key=lambda row: row["forecast_liters_7d"], reverse=True)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model_version": _read_fuel_model_version(),
        "forecasts": forecasts,
    }


@router.get("/fuel/forecast/{vehicle_id}")
def predict_fuel_by_vehicle(
    vehicle_id: str,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> dict:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    try:
        contexts = _build_fuel_forecast_contexts(supabase, profile["org_id"], vehicle_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to build fuel forecast context: {exc}")

    if not contexts:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    try:
        predictor = FuelPredictor(FUEL_MODEL_PATH, FUEL_META_PATH)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    try:
        forecast = predictor.predict_records([contexts[0]["record"]])[0]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    raw_record = contexts[0]["raw_record"]
    return {
        "vehicle_id": contexts[0]["vehicle_id"],
        "plate_no": contexts[0]["plate_no"],
        "forecast_liters_7d": round(float(forecast), 2),
        "recent_7d_liters": round(float(raw_record["last_7d_fuel_liters"]), 2),
        "recent_30d_liters": round(float(raw_record["last_30d_fuel_liters"]), 2),
        "recent_distance_km_30d": round(float(raw_record["recent_distance_km_30d"]), 2),
        "recent_trip_count_30d": int(raw_record["recent_trip_count_30d"]),
        "recent_avg_speed_kmh": round(float(raw_record["recent_avg_speed_kmh"]), 2),
        "fuel_efficiency_gap_ratio": round(
            max(
                0.0,
                (float(raw_record["Fuel_Efficiency"]) - float(raw_record["recent_fuel_efficiency_avg"]))
                / max(float(raw_record["Fuel_Efficiency"]), 1.0),
            ),
            4,
        ),
        "model_version": _read_fuel_model_version(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/fuel")
def predict_fuel(
    payload: FuelRequest,
    profile: dict = Depends(require_manager_profile),
) -> dict:
    try:
        predictor = FuelPredictor(FUEL_MODEL_PATH, FUEL_META_PATH)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    try:
        preds = predictor.predict(payload.features)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"predictions": preds}
