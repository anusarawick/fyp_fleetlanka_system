from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.ml.predict import FuelPredictor, MaintenancePredictor

router = APIRouter(prefix="/ml", tags=["ml"])


class MaintenanceRequest(BaseModel):
    features: list[list[float]]


class FuelRequest(BaseModel):
    features: list[list[float]]


@router.post("/maintenance")
def predict_maintenance(payload: MaintenanceRequest) -> dict:
    try:
        predictor = MaintenancePredictor("app/ml/models/maintenance_model.pkl")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    preds = predictor.predict(payload.features)
    return {"predictions": preds}


@router.post("/fuel")
def predict_fuel(payload: FuelRequest) -> dict:
    try:
        predictor = FuelPredictor("app/ml/models/fuel_model.pkl")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    preds = predictor.predict(payload.features)
    return {"predictions": preds}
