from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any

import pandas as pd
from sklearn.metrics import mean_absolute_error, r2_score, root_mean_squared_error

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.ml.train_fuel_v2 import TARGET_COL, build_pipeline, time_train_test_split


def duplicate_stats(df: pd.DataFrame, target_col: str) -> dict:
    feature_columns = [column for column in df.columns if column != target_col]
    full_dupes = int(df.duplicated().sum())
    feature_only_dupes = int(df[feature_columns].duplicated().sum())
    row_count = max(len(df), 1)
    return {
        "full_row_duplicates": full_dupes,
        "feature_only_duplicates": feature_only_dupes,
        "full_row_duplicate_rate": round(full_dupes / row_count, 6),
        "feature_only_duplicate_rate": round(feature_only_dupes / row_count, 6),
    }


def top_feature_importance(model: Any, top_k: int = 15) -> list[dict]:
    preprocessor = model.named_steps["preprocessor"]
    regressor = model.named_steps["regressor"]
    feature_names = preprocessor.get_feature_names_out().tolist()
    importances = regressor.feature_importances_.tolist()
    pairs = sorted(zip(feature_names, importances), key=lambda item: item[1], reverse=True)[:top_k]
    return [{"feature": feature, "importance": round(float(value), 6)} for feature, value in pairs]


def validate(raw: pd.DataFrame) -> dict:
    X_train, X_test, y_train, y_test, metadata = time_train_test_split(raw)
    model, _, _ = build_pipeline(X_train)
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    evaluation_frame = X_test.copy()
    evaluation_frame[TARGET_COL] = y_test.values

    naive_pred = X_test["fuel_used_liters_week"].to_numpy()

    return {
        "model_version": "fuel_v2_weekly_rf",
        "feature_builder_version": metadata["feature_builder_version"],
        "rows": int(len(X_train) + len(X_test)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "feature_count": int(X_train.shape[1]),
        "feature_columns": metadata["feature_columns"],
        "target_summary": {
            "train_mean": round(float(y_train.mean()), 6),
            "test_mean": round(float(y_test.mean()), 6),
            "train_min": round(float(y_train.min()), 6),
            "train_max": round(float(y_train.max()), 6),
            "test_min": round(float(y_test.min()), 6),
            "test_max": round(float(y_test.max()), 6),
        },
        "duplicate_stats_test_frame": duplicate_stats(evaluation_frame, TARGET_COL),
        "time_split": {
            "train_end_date": metadata["train_end_date"],
            "test_start_date": "2025-04-01",
        },
        "metrics": {
            "mae": round(float(mean_absolute_error(y_test, y_pred)), 6),
            "rmse": round(float(root_mean_squared_error(y_test, y_pred)), 6),
            "r2": round(float(r2_score(y_test, y_pred)), 6),
        },
        "naive_baseline": {
            "strategy": "use_current_week_fuel_liters_as_next_week_prediction",
            "mae": round(float(mean_absolute_error(y_test, naive_pred)), 6),
            "rmse": round(float(root_mean_squared_error(y_test, naive_pred)), 6),
            "r2": round(float(r2_score(y_test, naive_pred)), 6),
        },
        "top_feature_importance": top_feature_importance(model),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate fuel model v2 weekly dataset.")
    parser.add_argument(
        "--data",
        default="app/ml/data/weekly_fuel_ml_dataset.csv",
        help="Path to weekly fuel ML CSV",
    )
    parser.add_argument(
        "--report",
        default="app/ml/models/fuel_validation_report_v2.json",
        help="Path to write JSON report",
    )
    args = parser.parse_args()

    raw = pd.read_csv(args.data)
    result = {"data_path": args.data, "fuel_v2": validate(raw)}

    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(result, indent=2))

    print(json.dumps(result, indent=2))
    print(f"\nValidation report written to: {report_path}")


if __name__ == "__main__":
    main()
