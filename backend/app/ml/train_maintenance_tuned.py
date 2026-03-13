from __future__ import annotations

import json
from pathlib import Path
import sys

import joblib
import pandas as pd
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.ml.train_maintenance import build_training_frame

TUNED_RF_PARAMS = {
    "n_estimators": 220,
    "max_depth": 12,
    "min_samples_split": 12,
    "min_samples_leaf": 1,
    "max_features": "log2",
}
TUNED_DECISION_THRESHOLD = 0.35


def main() -> None:
    data_path = "app/ml/data/vehicle_maintenance_data.csv"
    df = pd.read_csv(data_path)
    X, y, metadata = build_training_frame(df)

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
            ("classifier", RandomForestClassifier(random_state=42, **TUNED_RF_PARAMS)),
        ]
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    print(classification_report(y_test, y_pred))

    models_dir = Path("app/ml/models")
    models_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, models_dir / "maintenance_model.pkl")

    metadata = {
        "model_type": "random_forest_classifier",
        **metadata,
        "numeric_features": numeric_features,
        "categorical_features": categorical_features,
        "selected_hyperparameters": TUNED_RF_PARAMS,
        "decision_threshold": TUNED_DECISION_THRESHOLD,
        "selection_objective": "0.6*recall_1 + 0.4*f1_1",
    }
    (models_dir / "maintenance_model_meta.json").write_text(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
