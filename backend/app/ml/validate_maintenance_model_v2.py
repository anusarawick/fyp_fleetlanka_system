from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.utils import shuffle

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.ml.train_maintenance import build_training_frame as build_baseline_training_frame
from app.ml.train_maintenance_v2 import DEFAULT_RF_PARAMS, build_training_frame_v2


def build_pipeline(
    X: pd.DataFrame, random_state: int = 42, n_estimators: int = 180
) -> ImbPipeline:
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

    classifier_params = dict(DEFAULT_RF_PARAMS)
    classifier_params["random_state"] = random_state
    classifier_params["n_estimators"] = n_estimators

    return ImbPipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("smote", SMOTE(random_state=random_state)),
            (
                "classifier",
                RandomForestClassifier(**classifier_params),
            ),
        ]
    )


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


def top_feature_importance(model: ImbPipeline, top_k: int = 12) -> list[dict]:
    preprocessor = model.named_steps["preprocessor"]
    clf = model.named_steps["classifier"]
    feature_names = preprocessor.get_feature_names_out().tolist()
    importances = clf.feature_importances_.tolist()
    pairs = sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)[:top_k]
    return [{"feature": f, "importance": round(v, 6)} for f, v in pairs]


def evaluate_dataset(
    raw: pd.DataFrame,
    build_training_frame,
    n_estimators: int,
    cv_folds: int,
) -> dict:
    X, y, meta = build_training_frame(raw)
    target_col = meta["target"]
    df_for_dupes = X.copy()
    df_for_dupes[target_col] = y.values

    dupes = duplicate_stats(df_for_dupes, target_col=target_col)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    model = build_pipeline(X_train, random_state=42, n_estimators=n_estimators)
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    X_train_sh, y_train_sh = shuffle(X_train, y_train, random_state=42)
    y_train_sh = pd.Series(np.random.permutation(y_train_sh.values), index=y_train_sh.index)
    shuffled_model = build_pipeline(X_train_sh, random_state=42, n_estimators=n_estimators)
    shuffled_model.fit(X_train_sh, y_train_sh)
    shuffled_pred = shuffled_model.predict(X_test)

    cv = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=42)
    cv_f1 = cross_val_score(
        build_pipeline(X, random_state=42, n_estimators=n_estimators),
        X,
        y,
        cv=cv,
        scoring="f1",
        n_jobs=1,
    )
    cv_acc = cross_val_score(
        build_pipeline(X, random_state=42, n_estimators=n_estimators),
        X,
        y,
        cv=cv,
        scoring="accuracy",
        n_jobs=1,
    )

    return {
        "rows": int(len(X)),
        "feature_count": int(X.shape[1]),
        "target_distribution": {str(k): int(v) for k, v in y.value_counts().sort_index().items()},
        "duplicate_stats": dupes,
        "holdout_metrics": {
            "accuracy": round(float(accuracy_score(y_test, y_pred)), 6),
            "f1": round(float(f1_score(y_test, y_pred)), 6),
            "classification_report": classification_report(y_test, y_pred, output_dict=True),
        },
        "shuffled_target_baseline": {
            "accuracy": round(float(accuracy_score(y_test, shuffled_pred)), 6),
            "f1": round(float(f1_score(y_test, shuffled_pred)), 6),
        },
        "cross_validation": {
            "f1_scores": [round(float(v), 6) for v in cv_f1.tolist()],
            "f1_mean": round(float(cv_f1.mean()), 6),
            "accuracy_scores": [round(float(v), 6) for v in cv_acc.tolist()],
            "accuracy_mean": round(float(cv_acc.mean()), 6),
        },
        "top_feature_importance": top_feature_importance(model, top_k=12),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate maintenance model v2 and compare with baseline.")
    parser.add_argument(
        "--data",
        default="app/ml/data/vehicle_maintenance_data_v2_raw.csv",
        help="Path to maintenance v2 raw CSV",
    )
    parser.add_argument(
        "--baseline-data",
        default="app/ml/data/vehicle_maintenance_data.csv",
        help="Path to baseline maintenance CSV for comparison",
    )
    parser.add_argument(
        "--report",
        default="app/ml/models/maintenance_validation_report_v2.json",
        help="Path to write JSON report",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=20000,
        help="Optional sample size for faster validation (0 = full dataset)",
    )
    parser.add_argument("--cv-folds", type=int, default=3, help="Number of stratified CV folds")
    parser.add_argument("--n-estimators", type=int, default=420, help="RandomForest tree count")
    args = parser.parse_args()

    data_path = Path(args.data)
    report_path = Path(args.report)
    baseline_path = Path(args.baseline_data)

    raw_v2 = pd.read_csv(data_path)
    if args.sample_size and 0 < args.sample_size < len(raw_v2):
        raw_v2 = raw_v2.sample(n=args.sample_size, random_state=42).reset_index(drop=True)

    result = {
        "data_path": str(data_path),
        "baseline_data_path": str(baseline_path),
        "v2": evaluate_dataset(raw_v2, build_training_frame_v2, args.n_estimators, args.cv_folds),
    }

    if baseline_path.exists():
        raw_baseline = pd.read_csv(baseline_path)
        if args.sample_size and 0 < args.sample_size < len(raw_baseline):
            raw_baseline = raw_baseline.sample(n=args.sample_size, random_state=42).reset_index(drop=True)
        result["baseline"] = evaluate_dataset(
            raw_baseline, build_baseline_training_frame, args.n_estimators, args.cv_folds
        )

        baseline_accuracy = result["baseline"]["holdout_metrics"]["accuracy"]
        v2_accuracy = result["v2"]["holdout_metrics"]["accuracy"]
        baseline_cv_accuracy = result["baseline"]["cross_validation"]["accuracy_mean"]
        v2_cv_accuracy = result["v2"]["cross_validation"]["accuracy_mean"]

        result["comparison"] = {
            "holdout_accuracy_delta": round(v2_accuracy - baseline_accuracy, 6),
            "cv_accuracy_delta": round(v2_cv_accuracy - baseline_cv_accuracy, 6),
            "v2_beats_baseline_on_accuracy": bool(v2_accuracy > baseline_accuracy and v2_cv_accuracy > baseline_cv_accuracy),
        }

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(result, indent=2))

    print(json.dumps(result, indent=2))
    print(f"\nValidation report written to: {report_path}")


if __name__ == "__main__":
    main()
