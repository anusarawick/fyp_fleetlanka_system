from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any

import pandas as pd
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.ml.train_maintenance_v3 import build_pipeline, time_train_test_split

DIRECT_DUE_WEAR_FEATURES = {
    "service_due_ratio",
    "oil_due_ratio",
    "tyre_wear_ratio",
    "brake_wear_ratio",
    "battery_age_ratio",
    "fuel_filter_due_ratio",
}

DIRECT_DISTANCE_SINCE_FEATURES = {
    "km_since_last_service",
    "km_since_last_oil_change",
    "km_since_last_tyre_change",
    "km_since_last_brake_service",
    "km_since_last_fuel_filter_change",
    "battery_age_months",
    "days_since_last_maintenance",
}

DERIVED_RISK_SCORE_FEATURES = {
    "service_overdue_flag",
    "component_wear_score",
    "vehicle_stress_score",
}

SERVICE_HISTORY_FEATURES = {
    "missed_services_count",
    "maintenance_events_last_12w",
    "repair_events_last_24w",
    "avg_repair_cost_last_24w",
    "accident_count",
    "repeat_failure_count",
}


ABLATION_SCENARIOS = [
    {
        "name": "full_model",
        "description": "All weekly maintenance v3 features.",
        "drop_features": set(),
    },
    {
        "name": "without_due_wear_ratios",
        "description": "Removes direct service/component due-ratio features.",
        "drop_features": DIRECT_DUE_WEAR_FEATURES,
    },
    {
        "name": "without_due_wear_and_risk_scores",
        "description": "Removes due ratios plus derived service/risk score features.",
        "drop_features": DIRECT_DUE_WEAR_FEATURES | DERIVED_RISK_SCORE_FEATURES,
    },
    {
        "name": "operational_only",
        "description": "Keeps vehicle, usage, driver, road, and fuel behavior features while removing service-history and component-wear signals.",
        "drop_features": DIRECT_DUE_WEAR_FEATURES
        | DIRECT_DISTANCE_SINCE_FEATURES
        | DERIVED_RISK_SCORE_FEATURES
        | SERVICE_HISTORY_FEATURES,
    },
]


def top_feature_importance(model: Any, top_k: int = 12) -> list[dict]:
    preprocessor = model.named_steps["preprocessor"]
    classifier = model.named_steps["classifier"]
    feature_names = preprocessor.get_feature_names_out().tolist()
    importances = classifier.feature_importances_.tolist()
    pairs = sorted(zip(feature_names, importances), key=lambda item: item[1], reverse=True)[:top_k]
    return [{"feature": feature, "importance": round(float(value), 6)} for feature, value in pairs]


def evaluate_scenario(
    X_train: pd.DataFrame,
    X_test: pd.DataFrame,
    y_train: pd.Series,
    y_test: pd.Series,
    scenario: dict,
) -> dict:
    drop_features = set(scenario["drop_features"])
    kept_features = [column for column in X_train.columns if column not in drop_features]
    missing_drop_features = sorted(drop_features - set(X_train.columns))

    scenario_X_train = X_train[kept_features].copy()
    scenario_X_test = X_test[kept_features].copy()

    model, numeric_features, categorical_features = build_pipeline(scenario_X_train)
    model.fit(scenario_X_train, y_train)
    y_pred = model.predict(scenario_X_test)

    return {
        "name": scenario["name"],
        "description": scenario["description"],
        "feature_count": int(len(kept_features)),
        "dropped_features": sorted(drop_features & set(X_train.columns)),
        "missing_drop_features": missing_drop_features,
        "numeric_features": numeric_features,
        "categorical_features": categorical_features,
        "metrics": {
            "accuracy": round(float(accuracy_score(y_test, y_pred)), 6),
            "precision": round(float(precision_score(y_test, y_pred, zero_division=0)), 6),
            "recall": round(float(recall_score(y_test, y_pred, zero_division=0)), 6),
            "f1": round(float(f1_score(y_test, y_pred, zero_division=0)), 6),
            "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        },
        "top_feature_importance": top_feature_importance(model),
    }


def validate_ablation(raw: pd.DataFrame) -> dict:
    X_train, X_test, y_train, y_test, metadata = time_train_test_split(raw)
    scenarios = [evaluate_scenario(X_train, X_test, y_train, y_test, scenario) for scenario in ABLATION_SCENARIOS]

    full_metrics = scenarios[0]["metrics"]
    comparisons = []
    for scenario in scenarios[1:]:
        metrics = scenario["metrics"]
        comparisons.append(
            {
                "scenario": scenario["name"],
                "accuracy_delta_vs_full": round(metrics["accuracy"] - full_metrics["accuracy"], 6),
                "precision_delta_vs_full": round(metrics["precision"] - full_metrics["precision"], 6),
                "recall_delta_vs_full": round(metrics["recall"] - full_metrics["recall"], 6),
                "f1_delta_vs_full": round(metrics["f1"] - full_metrics["f1"], 6),
            }
        )

    return {
        "model_version": "maintenance_v3_weekly_rf",
        "feature_builder_version": metadata["feature_builder_version"],
        "purpose": "Ablation validation to measure how much direct maintenance due/wear features contribute to model performance.",
        "rows": int(len(X_train) + len(X_test)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "time_split": {
            "train_end_date": metadata["train_end_date"],
            "test_start_date": "2025-04-01",
        },
        "target_distribution": {
            "train": {str(k): int(v) for k, v in y_train.value_counts().sort_index().items()},
            "test": {str(k): int(v) for k, v in y_test.value_counts().sort_index().items()},
        },
        "scenarios": scenarios,
        "comparison_to_full_model": comparisons,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run maintenance v3 feature ablation validation.")
    parser.add_argument(
        "--data",
        default="app/ml/data/weekly_maintenance_ml_dataset.csv",
        help="Path to weekly maintenance ML CSV",
    )
    parser.add_argument(
        "--report",
        default="app/ml/models/maintenance_ablation_report_v3.json",
        help="Path to write JSON report",
    )
    args = parser.parse_args()

    raw = pd.read_csv(args.data)
    result = {"data_path": args.data, "maintenance_ablation_v3": validate_ablation(raw)}

    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(result, indent=2))

    print(json.dumps(result, indent=2))
    print(f"\nAblation report written to: {report_path}")


if __name__ == "__main__":
    main()
