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
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from app.ml.features_v3 import (
    CONTEXT_ONLY_COLUMNS,
    FEATURE_BUILDER_VERSION,
    MAINTENANCE_FEATURE_COLUMNS,
    MAINTENANCE_TARGET_COL,
    build_maintenance_v3_features,
)

TARGET_COL = MAINTENANCE_TARGET_COL
RAW_DATA_PATH = "app/ml/data/weekly_maintenance_ml_dataset.csv"
MODEL_PATH = "app/ml/models/maintenance_model_v3.pkl"
META_PATH = "app/ml/models/maintenance_model_v3_meta.json"
TRAIN_END_DATE = "2025-03-31"

DEFAULT_RF_PARAMS = {
    "n_estimators": 260,
    "max_depth": 18,
    "min_samples_split": 5,
    "min_samples_leaf": 2,
    "max_features": "sqrt",
    "class_weight": "balanced_subsample",
    "random_state": 42,
    "n_jobs": -1,
}

def build_training_frame_v3(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series, dict]:
    work = build_maintenance_v3_features(df).dropna(subset=[TARGET_COL, "snapshot_date"])
    work["snapshot_date"] = pd.to_datetime(work["snapshot_date"], errors="coerce")
    work = work.dropna(subset=["snapshot_date"])
    y = pd.to_numeric(work[TARGET_COL], errors="coerce").fillna(0).astype(int)
    feature_columns = [column for column in MAINTENANCE_FEATURE_COLUMNS if column in work.columns]
    X = work[feature_columns].copy()

    metadata = {
        "target": TARGET_COL,
        "prediction_window_days": 7,
        "data_source": "weekly_maintenance_ml_dataset_v3",
        "model_version": "maintenance_v3_weekly_rf",
        "feature_builder_version": FEATURE_BUILDER_VERSION,
        "context_only_columns": sorted(CONTEXT_ONLY_COLUMNS),
        "feature_columns": feature_columns,
        "train_end_date": TRAIN_END_DATE,
    }
    return X, y, metadata


def time_train_test_split(
    df: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, dict]:
    work = df.copy()
    work["snapshot_date"] = pd.to_datetime(work["snapshot_date"], errors="coerce")
    train_raw = work[work["snapshot_date"] <= pd.Timestamp(TRAIN_END_DATE)].copy()
    test_raw = work[work["snapshot_date"] > pd.Timestamp(TRAIN_END_DATE)].copy()
    X_train, y_train, metadata = build_training_frame_v3(train_raw)
    X_test, y_test, _ = build_training_frame_v3(test_raw)
    X_test = X_test[metadata["feature_columns"]].copy()
    return X_train, X_test, y_train, y_test, metadata


def build_pipeline(X: pd.DataFrame) -> tuple[ImbPipeline, list[str], list[str]]:
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

    model = ImbPipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("smote", SMOTE(random_state=42)),
            ("classifier", RandomForestClassifier(**DEFAULT_RF_PARAMS)),
        ]
    )
    return model, numeric_features, categorical_features


def main() -> None:
    raw = pd.read_csv(RAW_DATA_PATH)
    X_train, X_test, y_train, y_test, metadata = time_train_test_split(raw)

    model, numeric_features, categorical_features = build_pipeline(X_train)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    print(classification_report(y_test, y_pred))
    print("Confusion matrix:")
    print(confusion_matrix(y_test, y_pred).tolist())

    models_dir = Path("app/ml/models")
    models_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)

    metadata = {
        "model_type": "random_forest_classifier_smote",
        **metadata,
        "selected_hyperparameters": DEFAULT_RF_PARAMS,
        "numeric_features": numeric_features,
        "categorical_features": categorical_features,
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "train_target_distribution": {str(k): int(v) for k, v in y_train.value_counts().sort_index().items()},
        "test_target_distribution": {str(k): int(v) for k, v in y_test.value_counts().sort_index().items()},
    }
    Path(META_PATH).write_text(json.dumps(metadata, indent=2))

    print(f"Saved model: {MODEL_PATH}")
    print(f"Saved metadata: {META_PATH}")


if __name__ == "__main__":
    main()
