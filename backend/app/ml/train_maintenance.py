from __future__ import annotations

import json
from pathlib import Path

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


def build_training_frame(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series, dict]:
    target_col = "Need_Maintenance"
    work = df.copy().dropna(subset=[target_col])
    y = work[target_col].astype(int)
    X = work.drop(columns=[target_col])

    metadata = {
        "target": target_col,
        "data_source": "processed",
        "feature_columns": list(X.columns),
    }
    return X, y, metadata


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
            ("classifier", RandomForestClassifier(n_estimators=300, random_state=42)),
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
    }
    (models_dir / "maintenance_model_meta.json").write_text(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
