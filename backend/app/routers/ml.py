import json
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.deps import get_bearer_token, require_manager_profile
from app.ml.predict import FuelPredictor, MaintenancePredictor
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
}


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
        .select("service_date")
        .eq("vehicle_id", vehicle_id)
        .order("service_date", desc=True)
        .execute()
    )
    maint_rows = maint_resp.data or []
    service_history = len(maint_rows)
    last_service_date = maint_rows[0]["service_date"] if maint_rows else None

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
            {"Good", "Weak"},
            DEFAULTS["Battery_Status"],
        ),
        "days_since_last_service": _to_days_since(last_service_date),
    }
    return record


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
    meta_path = Path("app/ml/models/maintenance_model_meta.json")
    if not meta_path.exists():
        return "maintenance_model_unknown"
    try:
        raw = json.loads(meta_path.read_text())
        params = raw.get("selected_hyperparameters", {})
        threshold = raw.get("decision_threshold", "na")
        n_estimators = params.get("n_estimators", "na")
        max_depth = params.get("max_depth", "na")
        return f"rf_n{n_estimators}_d{max_depth}_thr{threshold}"
    except Exception:
        return "maintenance_model_unknown"


@router.post("/maintenance")
def predict_maintenance(
    payload: MaintenanceRequest,
    profile: dict = Depends(require_manager_profile),
) -> dict:
    try:
        predictor = MaintenancePredictor("app/ml/models/maintenance_model.pkl")
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
    try:
        record = _build_maintenance_record_for_vehicle(supabase, vehicle_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to build maintenance feature record: {exc}")

    try:
        predictor = MaintenancePredictor("app/ml/models/maintenance_model.pkl")
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
        save_response = supabase.table("maintenance_predictions").insert(save_payload).execute()
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
        "saved": True,
    }


@router.post("/fuel")
def predict_fuel(
    payload: FuelRequest,
    profile: dict = Depends(require_manager_profile),
) -> dict:
    try:
        predictor = FuelPredictor("app/ml/models/fuel_model.pkl")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    try:
        preds = predictor.predict(payload.features)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"predictions": preds}
