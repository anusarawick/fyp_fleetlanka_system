from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

TARGET_COL = "predicted_fuel_liters_7d"
RAW_DATA_PATH = "app/ml/data/vehicle_fuel_forecast_raw.csv"
MODEL_PATH = "app/ml/models/fuel_model.pkl"
META_PATH = "app/ml/models/fuel_model_meta.json"
DEFAULT_RF_PARAMS = {
    "n_estimators": 320,
    "max_depth": 16,
    "min_samples_split": 4,
    "min_samples_leaf": 2,
    "max_features": "sqrt",
    "random_state": 42,
}

NUMERIC_RAW_COLUMNS = [
    "Vehicle_Age",
    "Engine_Size",
    "Fuel_Efficiency",
    "recent_fuel_efficiency_avg",
    "odometer_km",
    "avg_monthly_km",
    "recent_trip_count_30d",
    "recent_distance_km_7d",
    "recent_distance_km_30d",
    "recent_idle_min_7d",
    "recent_idle_min_30d",
    "recent_avg_speed_kmh",
    "days_since_last_fuel",
    "fuel_price_per_liter",
]

CATEGORICAL_RAW_COLUMNS = [
    "Vehicle_Model",
    "Transmission_Type",
]

SELECTED_ENGINEERED_COLUMNS = [
    "observed_km_per_liter_30d",
    "observed_liters_per_100km_30d",
    "idle_ratio_30d",
    "trip_density_per_100km_30d",
    "distance_share_7d",
    "weekly_distance_projection",
    "weekly_trip_projection",
    "fuel_efficiency_gap_ratio",
    "usage_intensity_score",
]

CONTEXT_ONLY_COLUMNS = [
    "last_7d_fuel_liters",
    "last_30d_fuel_liters",
    "last_30d_fuel_cost_lkr",
]


def enrich_fuel_features(frame: pd.DataFrame) -> pd.DataFrame:
    enriched = frame.copy()

    for column in NUMERIC_RAW_COLUMNS:
        if column in enriched.columns:
            enriched[column] = pd.to_numeric(enriched[column], errors="coerce")

    for column in CATEGORICAL_RAW_COLUMNS:
        if column in enriched.columns:
            enriched[column] = enriched[column].astype(str).str.strip()

    recent_distance_30d = enriched["recent_distance_km_30d"].fillna(0).clip(lower=0)
    recent_distance_7d = enriched["recent_distance_km_7d"].fillna(0).clip(lower=0)
    recent_liters_30d = enriched["last_30d_fuel_liters"].fillna(0).clip(lower=0)
    recent_liters_7d = enriched["last_7d_fuel_liters"].fillna(0).clip(lower=0)
    recent_trip_count = enriched["recent_trip_count_30d"].fillna(0).clip(lower=0)
    recent_idle_30d = enriched["recent_idle_min_30d"].fillna(0).clip(lower=0)
    recent_avg_speed = enriched["recent_avg_speed_kmh"].fillna(35).clip(lower=5)
    avg_monthly_km = enriched["avg_monthly_km"].fillna(1).clip(lower=1)
    rated_efficiency = enriched["Fuel_Efficiency"].fillna(1).clip(lower=1)
    recent_efficiency = enriched["recent_fuel_efficiency_avg"].fillna(rated_efficiency).clip(lower=0.1)
    fuel_cost_30d = enriched["last_30d_fuel_cost_lkr"].fillna(0).clip(lower=0)

    observed_km_per_liter_30d = (recent_distance_30d / recent_liters_30d.clip(lower=1.0)).round(6)
    observed_liters_per_100km_30d = ((recent_liters_30d / recent_distance_30d.clip(lower=1.0)) * 100.0).round(6)
    idle_ratio_30d = (recent_idle_30d / (recent_trip_count * 60.0 + 60.0)).clip(lower=0).round(6)
    trip_density_per_100km_30d = ((recent_trip_count / recent_distance_30d.clip(lower=1.0)) * 100.0).round(6)
    distance_share_7d = (recent_distance_7d / recent_distance_30d.clip(lower=1.0)).clip(lower=0).round(6)
    weekly_distance_projection = ((recent_distance_30d / 30.0) * 7.0).round(6)
    weekly_trip_projection = ((recent_trip_count / 30.0) * 7.0).round(6)
    fuel_efficiency_gap_ratio = ((rated_efficiency - recent_efficiency) / rated_efficiency.clip(lower=1.0)).round(6)
    cost_per_liter_30d = (fuel_cost_30d / recent_liters_30d.clip(lower=1.0)).round(6)
    usage_intensity_score = (
        ((avg_monthly_km / 4000.0) * 0.45)
        + ((recent_distance_30d / 2500.0) * 0.35)
        + ((recent_trip_count / 90.0) * 0.2)
    ).round(6)

    enriched["observed_km_per_liter_30d"] = observed_km_per_liter_30d
    enriched["observed_liters_per_100km_30d"] = observed_liters_per_100km_30d
    enriched["idle_ratio_30d"] = idle_ratio_30d
    enriched["trip_density_per_100km_30d"] = trip_density_per_100km_30d
    enriched["distance_share_7d"] = distance_share_7d
    enriched["weekly_distance_projection"] = weekly_distance_projection
    enriched["weekly_trip_projection"] = weekly_trip_projection
    enriched["fuel_efficiency_gap_ratio"] = fuel_efficiency_gap_ratio
    enriched["cost_per_liter_30d"] = cost_per_liter_30d
    enriched["usage_intensity_score"] = usage_intensity_score

    return enriched



def build_fuel_training_frame(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series, dict]:
    work = df.copy().dropna(subset=[TARGET_COL])
    y = pd.to_numeric(work[TARGET_COL], errors="coerce").fillna(0.0)
    raw_X = work.drop(columns=[TARGET_COL])
    enriched = enrich_fuel_features(raw_X)
    selected_raw_columns = [
        column for column in raw_X.columns
        if column not in CONTEXT_ONLY_COLUMNS
    ]
    selected_columns = selected_raw_columns + SELECTED_ENGINEERED_COLUMNS
    X = enriched[selected_columns].copy()

    metadata = {
        "target": TARGET_COL,
        "prediction_window_days": 7,
        "data_source": "synthetic_fuel_v1",
        "raw_feature_columns": list(raw_X.columns),
        "selected_raw_feature_columns": selected_raw_columns,
        "selected_engineered_columns": SELECTED_ENGINEERED_COLUMNS,
        "feature_columns": list(X.columns),
    }
    return X, y, metadata



def build_pipeline(X: pd.DataFrame) -> tuple[Pipeline, list[str], list[str]]:
    numeric_features = X.select_dtypes(include=["number"]).columns.tolist()
    categorical_features = X.select_dtypes(exclude=["number"]).columns.tolist()

    numeric_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
        ]
    )
    categorical_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_pipeline, numeric_features),
            ("cat", categorical_pipeline, categorical_features),
        ]
    )

    model = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("regressor", RandomForestRegressor(**DEFAULT_RF_PARAMS)),
        ]
    )
    return model, numeric_features, categorical_features



def main() -> None:
    df = pd.read_csv(RAW_DATA_PATH)
    X, y, metadata = build_fuel_training_frame(df)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    model, numeric_features, categorical_features = build_pipeline(X_train)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    print("MAE:", round(float(mean_absolute_error(y_test, y_pred)), 6))
    print("RMSE:", round(float(mean_squared_error(y_test, y_pred, squared=False)), 6))
    print("R2:", round(float(r2_score(y_test, y_pred)), 6))

    models_dir = Path("app/ml/models")
    models_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, models_dir / "fuel_model.pkl")

    metadata = {
        "model_type": "random_forest_regressor",
        **metadata,
        "numeric_features": numeric_features,
        "categorical_features": categorical_features,
    }
    (models_dir / "fuel_model_meta.json").write_text(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
