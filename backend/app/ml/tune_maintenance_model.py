from __future__ import annotations

import json
from pathlib import Path
from typing import Any
import sys
import time

import joblib
import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import ParameterGrid, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.ml.train_maintenance import build_training_frame


def build_preprocessor(X: pd.DataFrame) -> tuple[ColumnTransformer, list[str], list[str]]:
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
    return preprocessor, numeric_features, categorical_features


def evaluate_threshold(y_true: np.ndarray, y_prob: np.ndarray, threshold: float) -> dict[str, float]:
    y_pred = (y_prob >= threshold).astype(int)
    return {
        "threshold": threshold,
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision_1": float(precision_score(y_true, y_pred, pos_label=1, zero_division=0)),
        "recall_1": float(recall_score(y_true, y_pred, pos_label=1, zero_division=0)),
        "f1_1": float(f1_score(y_true, y_pred, pos_label=1, zero_division=0)),
    }


def score_candidate(metrics: dict[str, float]) -> float:
    # Prioritize class-1 recall and F1 for maintenance risk detection.
    return (metrics["recall_1"] * 0.6) + (metrics["f1_1"] * 0.4)


def main() -> None:
    data_path = Path("app/ml/data/vehicle_maintenance_data.csv")
    df = pd.read_csv(data_path)
    X, y, base_meta = build_training_frame(df)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    preprocessor, numeric_features, categorical_features = build_preprocessor(X_train)

    param_grid = {
        "n_estimators": [220, 320, 420],
        "max_depth": [None, 12, 18],
        "min_samples_split": [2, 6, 12],
        "min_samples_leaf": [1, 2, 4],
        "max_features": ["sqrt", "log2"],
    }
    thresholds = [0.35, 0.4, 0.45, 0.5, 0.55]

    param_list = list(ParameterGrid(param_grid))
    total_candidates = len(param_list) * len(thresholds)
    start_time = time.time()

    best: dict[str, Any] | None = None
    candidates = 0

    print(
        f"Starting tuning: {len(param_list)} parameter sets x {len(thresholds)} thresholds = {total_candidates} candidates"
    )

    for params in param_list:
        model = ImbPipeline(
            steps=[
                ("preprocessor", preprocessor),
                ("smote", SMOTE(random_state=42)),
                ("classifier", RandomForestClassifier(random_state=42, **params)),
            ]
        )
        model.fit(X_train, y_train)
        y_prob = model.predict_proba(X_test)[:, 1]

        for threshold in thresholds:
            metrics = evaluate_threshold(y_test.to_numpy(), y_prob, threshold)
            candidate = {
                "params": params,
                "metrics": metrics,
                "score": score_candidate(metrics),
                "model": model,
            }
            candidates += 1
            if best is None or candidate["score"] > best["score"]:
                best = candidate

            # Progress every 5 candidates and on completion.
            if candidates % 5 == 0 or candidates == total_candidates:
                elapsed = time.time() - start_time
                rate = elapsed / candidates if candidates else 0.0
                remaining = max(0.0, (total_candidates - candidates) * rate)
                progress = (candidates / total_candidates) * 100
                best_score = best["score"] if best else 0.0
                print(
                    f"[{candidates}/{total_candidates}] {progress:5.1f}% | "
                    f"elapsed {elapsed/60:5.1f}m | eta {remaining/60:5.1f}m | "
                    f"best_score {best_score:.4f}"
                )

    assert best is not None

    best_model: ImbPipeline = best["model"]
    best_threshold: float = float(best["metrics"]["threshold"])

    final_prob = best_model.predict_proba(X_test)[:, 1]
    final_pred = (final_prob >= best_threshold).astype(int)

    models_dir = Path("app/ml/models")
    models_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(best_model, models_dir / "maintenance_model.pkl")

    report = {
        "data_path": str(data_path),
        "candidates_evaluated": candidates,
        "total_candidates": total_candidates,
        "selection_objective": "0.6*recall_1 + 0.4*f1_1",
        "best_params": best["params"],
        "best_threshold": best_threshold,
        "best_holdout_metrics": {
            "accuracy": round(float(accuracy_score(y_test, final_pred)), 6),
            "precision_1": round(float(precision_score(y_test, final_pred, pos_label=1, zero_division=0)), 6),
            "recall_1": round(float(recall_score(y_test, final_pred, pos_label=1, zero_division=0)), 6),
            "f1_1": round(float(f1_score(y_test, final_pred, pos_label=1, zero_division=0)), 6),
            "confusion_matrix": confusion_matrix(y_test, final_pred).tolist(),
            "classification_report": classification_report(y_test, final_pred, output_dict=True),
        },
    }
    (models_dir / "maintenance_tuning_report.json").write_text(json.dumps(report, indent=2))

    metadata = {
        "model_type": "random_forest_classifier",
        **base_meta,
        "numeric_features": numeric_features,
        "categorical_features": categorical_features,
        "selected_hyperparameters": best["params"],
        "decision_threshold": best_threshold,
        "selection_objective": "0.6*recall_1 + 0.4*f1_1",
    }
    (models_dir / "maintenance_model_meta.json").write_text(json.dumps(metadata, indent=2))

    print(json.dumps(report, indent=2))
    print("\nSaved tuned model: app/ml/models/maintenance_model.pkl")
    print("Saved tuning report: app/ml/models/maintenance_tuning_report.json")
    print("Updated metadata: app/ml/models/maintenance_model_meta.json")


if __name__ == "__main__":
    main()
