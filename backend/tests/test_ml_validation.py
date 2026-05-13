from __future__ import annotations

import pandas as pd
import pytest

from app.ml.features_v3 import require_columns
from app.ml.predict import _BasePredictor, FuelPredictor, MaintenancePredictor


def make_predictor(expected_features: int | None = 2, feature_names: list[str] | None = None) -> _BasePredictor:
    predictor = object.__new__(_BasePredictor)
    predictor.expected_features = expected_features
    predictor.feature_names = feature_names or ["a", "b"]
    return predictor


def test_base_predictor_rejects_invalid_feature_shapes() -> None:
    predictor = make_predictor()

    with pytest.raises(ValueError, match="cannot be empty"):
        predictor._validate_features([])
    with pytest.raises(ValueError, match="same number"):
        predictor._validate_features([[1, 2], [1]])
    with pytest.raises(ValueError, match="cannot be empty"):
        predictor._validate_features([[]])
    with pytest.raises(ValueError, match="invalid feature width"):
        predictor._validate_features([[1, 2, 3]])
    with pytest.raises(ValueError, match="numeric"):
        predictor._validate_features([[1, "bad"]])


def test_record_predictors_validate_missing_fields() -> None:
    maintenance = object.__new__(MaintenancePredictor)
    maintenance.feature_names = ["mileage", "age_months"]
    maintenance.numeric_features = ["mileage", "age_months"]
    maintenance.categorical_features = []

    fuel = object.__new__(FuelPredictor)
    fuel.feature_names = ["distance_km", "vehicle_type"]
    fuel.numeric_features = ["distance_km"]
    fuel.categorical_features = ["vehicle_type"]

    with pytest.raises(ValueError, match="records cannot be empty"):
        maintenance._records_to_frame([])
    with pytest.raises(ValueError, match="missing required fields"):
        maintenance._records_to_frame([{"mileage": 12000}])

    frame = fuel._records_to_frame([{"distance_km": "120.5", "vehicle_type": "van"}])
    assert frame["distance_km"].iloc[0] == 120.5
    assert frame["vehicle_type"].iloc[0] == "van"


def test_require_columns_reports_missing_dataset_columns() -> None:
    frame = pd.DataFrame([{"vehicle_id": "vehicle-1", "mileage": 1000}])

    require_columns(frame, ["vehicle_id"], "fleet")
    with pytest.raises(ValueError, match="fleet is missing required columns"):
        require_columns(frame, ["vehicle_id", "fuel_efficiency"], "fleet")
