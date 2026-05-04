from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any

import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score, precision_score, recall_score

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.ml.train_maintenance_v3 import build_pipeline, time_train_test_split


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
    classifier = model.named_steps["classifier"]
    feature_names = preprocessor.get_feature_names_out().tolist()
    importances = classifier.feature_importances_.tolist()
    pairs = sorted(zip(feature_names, importances), key=lambda item: item[1], reverse=True)[:top_k]
    return [{"feature": feature, "importance": round(float(value), 6)} for feature, value in pairs]


def validate(raw: pd.DataFrame) -> dict:
    X_train, X_test, y_train, y_test, metadata = time_train_test_split(raw)
    model, _, _ = build_pipeline(X_train)
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    evaluation_frame = X_test.copy()
    evaluation_frame[metadata["target"]] = y_test.values

    return {
        "model_version": "maintenance_v3_weekly_rf",
        "feature_builder_version": metadata["feature_builder_version"],
        "rows": int(len(X_train) + len(X_test)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "feature_count": int(X_train.shape[1]),
        "feature_columns": metadata["feature_columns"],
        "target_distribution": {
            "train": {str(k): int(v) for k, v in y_train.value_counts().sort_index().items()},
            "test": {str(k): int(v) for k, v in y_test.value_counts().sort_index().items()},
        },
        "duplicate_stats_test_frame": duplicate_stats(evaluation_frame, metadata["target"]),
        "time_split": {
            "train_end_date": metadata["train_end_date"],
            "test_start_date": "2025-04-01",
        },
        "metrics": {
            "accuracy": round(float(accuracy_score(y_test, y_pred)), 6),
            "precision": round(float(precision_score(y_test, y_pred, zero_division=0)), 6),
            "recall": round(float(recall_score(y_test, y_pred, zero_division=0)), 6),
            "f1": round(float(f1_score(y_test, y_pred, zero_division=0)), 6),
            "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
            "classification_report": classification_report(y_test, y_pred, output_dict=True, zero_division=0),
        },
        "top_feature_importance": top_feature_importance(model),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate maintenance model v3 weekly dataset.")
    parser.add_argument(
        "--data",
        default="app/ml/data/weekly_maintenance_ml_dataset.csv",
        help="Path to weekly maintenance ML CSV",
    )
    parser.add_argument(
        "--report",
        default="app/ml/models/maintenance_validation_report_v3.json",
        help="Path to write JSON report",
    )
    args = parser.parse_args()

    raw = pd.read_csv(args.data)
    result = {"data_path": args.data, "maintenance_v3": validate(raw)}

    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(result, indent=2))

    print(json.dumps(result, indent=2))
    print(f"\nValidation report written to: {report_path}")


if __name__ == "__main__":
    main()
