from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_validate, train_test_split

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.ml.train_fuel import build_fuel_training_frame, build_pipeline


def duplicate_stats(df: pd.DataFrame, target_col: str) -> dict:
    full_dupes = int(df.duplicated().sum())
    feature_only_dupes = int(df.drop(columns=[target_col]).duplicated().sum())
    row_count = max(len(df), 1)
    return {
        "full_row_duplicates": full_dupes,
        "feature_only_duplicates": feature_only_dupes,
        "full_row_duplicate_rate": round(full_dupes / row_count, 6),
        "feature_only_duplicate_rate": round(feature_only_dupes / row_count, 6),
    }



def top_feature_importance(model: any, top_k: int = 12) -> list[dict]:
    preprocessor = model.named_steps["preprocessor"]
    regressor = model.named_steps["regressor"]
    feature_names = preprocessor.get_feature_names_out().tolist()
    importances = regressor.feature_importances_.tolist()
    pairs = sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)[:top_k]
    return [{"feature": feature, "importance": round(value, 6)} for feature, value in pairs]



def evaluate_dataset(raw: pd.DataFrame, cv_folds: int) -> dict:
    X, y, meta = build_fuel_training_frame(raw)
    target_col = meta["target"]
    df_for_dupes = X.copy()
    df_for_dupes[target_col] = y.values

    dupes = duplicate_stats(df_for_dupes, target_col)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    model, _, _ = build_pipeline(X_train)
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    naive_pred = (
        X_test["weekly_distance_projection"].fillna(X_train["weekly_distance_projection"].median())
        / X_test["observed_km_per_liter_30d"].fillna(X_train["observed_km_per_liter_30d"].median()).clip(lower=1.0)
    ).to_numpy()

    cv = KFold(n_splits=cv_folds, shuffle=True, random_state=42)
    cv_results = cross_validate(
        build_pipeline(X)[0],
        X,
        y,
        cv=cv,
        scoring={
            "mae": "neg_mean_absolute_error",
            "rmse": "neg_root_mean_squared_error",
            "r2": "r2",
        },
        n_jobs=1,
    )

    return {
        "rows": int(len(X)),
        "feature_count": int(X.shape[1]),
        "duplicate_stats": dupes,
        "holdout_metrics": {
            "mae": round(float(mean_absolute_error(y_test, y_pred)), 6),
            "rmse": round(float(mean_squared_error(y_test, y_pred, squared=False)), 6),
            "r2": round(float(r2_score(y_test, y_pred)), 6),
        },
        "naive_baseline": {
            "strategy": "predict_weekly_distance_projection_divided_by_observed_km_per_liter_30d",
            "mae": round(float(mean_absolute_error(y_test, naive_pred)), 6),
            "rmse": round(float(mean_squared_error(y_test, naive_pred, squared=False)), 6),
            "r2": round(float(r2_score(y_test, naive_pred)), 6),
        },
        "cross_validation": {
            "mae_scores": [round(float(-v), 6) for v in cv_results["test_mae"].tolist()],
            "mae_mean": round(float((-cv_results["test_mae"]).mean()), 6),
            "rmse_scores": [round(float(-v), 6) for v in cv_results["test_rmse"].tolist()],
            "rmse_mean": round(float((-cv_results["test_rmse"]).mean()), 6),
            "r2_scores": [round(float(v), 6) for v in cv_results["test_r2"].tolist()],
            "r2_mean": round(float(cv_results["test_r2"].mean()), 6),
        },
        "top_feature_importance": top_feature_importance(model, top_k=12),
    }



def main() -> None:
    parser = argparse.ArgumentParser(description="Validate fuel forecasting model.")
    parser.add_argument(
        "--data",
        default="app/ml/data/vehicle_fuel_forecast_raw.csv",
        help="Path to fuel forecasting raw CSV",
    )
    parser.add_argument(
        "--report",
        default="app/ml/models/fuel_validation_report.json",
        help="Path to write JSON report",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=20000,
        help="Optional sample size for faster validation (0 = full dataset)",
    )
    parser.add_argument("--cv-folds", type=int, default=3, help="Number of CV folds")
    args = parser.parse_args()

    data_path = Path(args.data)
    report_path = Path(args.report)

    raw = pd.read_csv(data_path)
    if args.sample_size and 0 < args.sample_size < len(raw):
        raw = raw.sample(n=args.sample_size, random_state=42).reset_index(drop=True)

    result = {
        "data_path": str(data_path),
        "fuel_forecast": evaluate_dataset(raw, args.cv_folds),
    }

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(result, indent=2))

    print(json.dumps(result, indent=2))
    print(f"\nValidation report written to: {report_path}")


if __name__ == "__main__":
    main()
