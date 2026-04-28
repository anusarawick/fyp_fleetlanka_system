from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

TARGET_COL = "Need_Maintenance_7d"
RAW_DATA_PATH = "app/ml/data/vehicle_maintenance_data_v2_raw.csv"
MODEL_PATH = "app/ml/models/maintenance_model_v2.pkl"
META_PATH = "app/ml/models/maintenance_model_v2_meta.json"
DEFAULT_RF_PARAMS = {
    "n_estimators": 420,
    "max_depth": 18,
    "min_samples_split": 4,
    "min_samples_leaf": 2,
    "max_features": "sqrt",
    "class_weight": "balanced_subsample",
    "random_state": 42,
}

NUMERIC_RAW_COLUMNS = [
    "Mileage",
    "Reported_Issues",
    "Vehicle_Age",
    "Engine_Size",
    "Service_History",
    "Accident_History",
    "Fuel_Efficiency",
    "days_since_last_service",
    "last_service_cost_lkr",
    "next_service_due_km",
    "avg_monthly_km",
    "recent_trip_count_30d",
    "recent_fuel_efficiency_avg",
    "service_center_visits_12m",
]

CATEGORICAL_RAW_COLUMNS = [
    "Vehicle_Model",
    "Maintenance_History",
    "Transmission_Type",
    "Tire_Condition",
    "Brake_Condition",
    "Battery_Status",
]

SELECTED_ENGINEERED_COLUMNS = [
    "mileage_since_last_service",
    "km_until_service_due",
    "days_to_expected_service_due",
    "service_overdue_flag",
    "issues_per_1000km",
    "services_per_year",
    "accidents_per_year",
    "condition_score",
    "component_risk_score",
    "usage_intensity_score",
    "fuel_efficiency_gap_ratio",
    "issue_pressure_score",
    "vehicle_stress_score",
]

CONDITION_SCORES = {"New": 0.0, "Good": 1.0, "Worn Out": 2.6}
BATTERY_SCORES = {"New": 0.0, "Good": 0.8, "Weak": 2.3}
MAINT_HISTORY_SCORES = {"Good": 0.0, "Average": 1.0, "Poor": 2.2}


def enrich_maintenance_features_v2(frame: pd.DataFrame) -> pd.DataFrame:
    enriched = frame.copy()

    for column in NUMERIC_RAW_COLUMNS:
        if column in enriched.columns:
            enriched[column] = pd.to_numeric(enriched[column], errors="coerce")

    for column in CATEGORICAL_RAW_COLUMNS:
        if column in enriched.columns:
            enriched[column] = enriched[column].astype(str).str.strip()

    mileage = enriched["Mileage"].fillna(0).clip(lower=0)
    issues = enriched["Reported_Issues"].fillna(0).clip(lower=0)
    vehicle_age = enriched["Vehicle_Age"].fillna(1).clip(lower=1)
    service_history = enriched["Service_History"].fillna(0).clip(lower=0)
    accident_history = enriched["Accident_History"].fillna(0).clip(lower=0)
    days_since_service = enriched["days_since_last_service"].fillna(0).clip(lower=0)
    avg_monthly_km = enriched["avg_monthly_km"].fillna(1).clip(lower=1)
    next_service_due_km = enriched["next_service_due_km"].fillna(mileage)
    last_service_cost = enriched["last_service_cost_lkr"].fillna(0).clip(lower=0)
    recent_trip_count = enriched["recent_trip_count_30d"].fillna(0).clip(lower=0)
    rated_efficiency = enriched["Fuel_Efficiency"].fillna(1).abs().clip(lower=1)
    recent_efficiency = enriched["recent_fuel_efficiency_avg"].fillna(rated_efficiency).abs().clip(lower=0.1)
    visits_12m = enriched["service_center_visits_12m"].fillna(0).clip(lower=0)

    km_until_due = next_service_due_km - mileage
    monthly_km_per_day = (avg_monthly_km / 30.0).clip(lower=1.0)

    tire_score = enriched["Tire_Condition"].map(CONDITION_SCORES).fillna(1.0)
    brake_score = enriched["Brake_Condition"].map(CONDITION_SCORES).fillna(1.0)
    battery_score = enriched["Battery_Status"].map(BATTERY_SCORES).fillna(0.8)
    history_score = enriched["Maintenance_History"].map(MAINT_HISTORY_SCORES).fillna(1.0)

    mileage_since_last_service = (avg_monthly_km * (days_since_service / 30.0)).round(3)
    days_to_expected_service_due = (km_until_due / monthly_km_per_day).round(3)
    service_overdue_flag = ((km_until_due <= 0) | (days_since_service > 180)).astype(int)
    issues_per_1000km = ((issues / mileage.clip(lower=1.0)) * 1000.0).round(6)
    services_per_year = (service_history / vehicle_age).round(6)
    accidents_per_year = (accident_history / vehicle_age).round(6)
    condition_score = ((tire_score + brake_score + battery_score) / 3.0).round(4)
    component_risk_score = (
        (tire_score * 0.35) + (brake_score * 0.4) + (battery_score * 0.25) + (history_score * 0.45)
    ).round(4)
    usage_intensity_score = (
        ((avg_monthly_km / 3500.0) * 0.65) + ((recent_trip_count / 140.0) * 0.35)
    ).round(4)
    fuel_efficiency_gap_ratio = ((rated_efficiency - recent_efficiency) / rated_efficiency.clip(lower=1.0)).round(6)
    issue_pressure_score = (
        (issues * 0.45)
        + (accident_history * 0.3)
        + (history_score * 0.55)
        + (service_overdue_flag * 1.1)
    ).round(4)
    trip_load_proxy = ((recent_trip_count * avg_monthly_km) / 10000.0).round(4)
    service_gap_km_ratio = (mileage_since_last_service / (km_until_due.abs() + 1000.0)).round(6)
    vehicle_stress_score = (
        (usage_intensity_score * 0.45)
        + (trip_load_proxy * 0.18)
        + (fuel_efficiency_gap_ratio.clip(lower=0) * 1.2)
        + (service_gap_km_ratio.clip(lower=0) * 0.35)
    ).round(4)

    enriched["mileage_since_last_service"] = mileage_since_last_service
    enriched["km_until_service_due"] = km_until_due.round(3)
    enriched["days_to_expected_service_due"] = days_to_expected_service_due
    enriched["service_overdue_flag"] = service_overdue_flag
    enriched["issues_per_1000km"] = issues_per_1000km
    enriched["services_per_year"] = services_per_year
    enriched["accidents_per_year"] = accidents_per_year
    enriched["condition_score"] = condition_score
    enriched["component_risk_score"] = component_risk_score
    enriched["usage_intensity_score"] = usage_intensity_score
    enriched["fuel_efficiency_gap_ratio"] = fuel_efficiency_gap_ratio
    enriched["issue_pressure_score"] = issue_pressure_score
    enriched["vehicle_stress_score"] = vehicle_stress_score

    return enriched


def build_training_frame_v2(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series, dict]:
    work = df.copy().dropna(subset=[TARGET_COL])
    y = pd.to_numeric(work[TARGET_COL], errors="coerce").fillna(0).astype(int)
    raw_X = work.drop(columns=[TARGET_COL])
    enriched = enrich_maintenance_features_v2(raw_X)
    selected_columns = list(raw_X.columns) + SELECTED_ENGINEERED_COLUMNS
    X = enriched[selected_columns].copy()

    metadata = {
        "target": TARGET_COL,
        "prediction_window_days": 7,
        "data_source": "raw_v2",
        "raw_feature_columns": list(raw_X.columns),
        "selected_engineered_columns": SELECTED_ENGINEERED_COLUMNS,
        "feature_columns": list(X.columns),
    }
    return X, y, metadata


def main() -> None:
    df = pd.read_csv(RAW_DATA_PATH)
    X, y, metadata = build_training_frame_v2(df)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    numeric_features = X_train.select_dtypes(include=["number"]).columns.tolist()
    categorical_features = X_train.select_dtypes(exclude=["number"]).columns.tolist()

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

    model = ImbPipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("smote", SMOTE(random_state=42)),
            ("classifier", RandomForestClassifier(**DEFAULT_RF_PARAMS)),
        ]
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    print(classification_report(y_test, y_pred))

    models_dir = Path("app/ml/models")
    models_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, models_dir / "maintenance_model_v2.pkl")

    metadata = {
        "model_type": "random_forest_classifier",
        **metadata,
        "numeric_features": numeric_features,
        "categorical_features": categorical_features,
    }
    (models_dir / "maintenance_model_v2_meta.json").write_text(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
