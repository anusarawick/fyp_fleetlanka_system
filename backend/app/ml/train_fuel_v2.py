from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, r2_score, root_mean_squared_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from app.ml.features_v3 import (
    CONTEXT_ONLY_COLUMNS,
    FEATURE_BUILDER_VERSION,
    FUEL_FEATURE_COLUMNS,
    FUEL_TARGET_COL,
    build_fuel_v2_features,
)

TARGET_COL = FUEL_TARGET_COL
RAW_DATA_PATH = "app/ml/data/weekly_fuel_ml_dataset.csv"
MODEL_PATH = "app/ml/models/fuel_model_v2.pkl"
META_PATH = "app/ml/models/fuel_model_v2_meta.json"
TRAIN_END_DATE = "2025-03-31"

DEFAULT_RF_PARAMS = {
    "n_estimators": 280,
    "max_depth": 18,
    "min_samples_split": 4,
    "min_samples_leaf": 2,
    "max_features": "sqrt",
    "random_state": 42,
    "n_jobs": -1,
}

def build_fuel_training_frame_v2(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series, dict]:
    work = build_fuel_v2_features(df).dropna(subset=[TARGET_COL, "snapshot_date"])
    work["snapshot_date"] = pd.to_datetime(work["snapshot_date"], errors="coerce")
    work = work.dropna(subset=["snapshot_date"])
    y = pd.to_numeric(work[TARGET_COL], errors="coerce").fillna(0.0)
    feature_columns = [column for column in FUEL_FEATURE_COLUMNS if column in work.columns]
    X = work[feature_columns].copy()

    metadata = {
        "target": TARGET_COL,
        "prediction_window_days": 7,
        "data_source": "weekly_fuel_ml_dataset_v2",
        "model_version": "fuel_v2_weekly_rf",
        "feature_builder_version": FEATURE_BUILDER_VERSION,
        "context_only_columns": sorted(CONTEXT_ONLY_COLUMNS),
        "feature_columns": feature_columns,
        "train_end_date": TRAIN_END_DATE,
    }
    return X, y, metadata


def time_train_test_split(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, dict]:
    work = df.copy()
    work["snapshot_date"] = pd.to_datetime(work["snapshot_date"], errors="coerce")
    train_raw = work[work["snapshot_date"] <= pd.Timestamp(TRAIN_END_DATE)].copy()
    test_raw = work[work["snapshot_date"] > pd.Timestamp(TRAIN_END_DATE)].copy()
    X_train, y_train, metadata = build_fuel_training_frame_v2(train_raw)
    X_test, y_test, _ = build_fuel_training_frame_v2(test_raw)
    X_test = X_test[metadata["feature_columns"]].copy()
    return X_train, X_test, y_train, y_test, metadata


def build_pipeline(X: pd.DataFrame) -> tuple[Pipeline, list[str], list[str]]:
    numeric_features = X.select_dtypes(include=["number"]).columns.tolist()
    categorical_features = X.select_dtypes(exclude=["number"]).columns.tolist()

    numeric_pipeline = Pipeline(steps=[("imputer", SimpleImputer(strategy="median"))])
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
    raw = pd.read_csv(RAW_DATA_PATH)
    X_train, X_test, y_train, y_test, metadata = time_train_test_split(raw)

    model, numeric_features, categorical_features = build_pipeline(X_train)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    print("MAE:", round(float(mean_absolute_error(y_test, y_pred)), 6))
    print("RMSE:", round(float(root_mean_squared_error(y_test, y_pred)), 6))
    print("R2:", round(float(r2_score(y_test, y_pred)), 6))

    models_dir = Path("app/ml/models")
    models_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)

    metadata = {
        "model_type": "random_forest_regressor",
        **metadata,
        "selected_hyperparameters": DEFAULT_RF_PARAMS,
        "numeric_features": numeric_features,
        "categorical_features": categorical_features,
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "target_summary": {
            "train_mean": round(float(y_train.mean()), 6),
            "test_mean": round(float(y_test.mean()), 6),
            "train_min": round(float(y_train.min()), 6),
            "train_max": round(float(y_train.max()), 6),
            "test_min": round(float(y_test.min()), 6),
            "test_max": round(float(y_test.max()), 6),
        },
    }
    Path(META_PATH).write_text(json.dumps(metadata, indent=2))

    print(f"Saved model: {MODEL_PATH}")
    print(f"Saved metadata: {META_PATH}")


if __name__ == "__main__":
    main()
