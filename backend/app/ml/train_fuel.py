from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor


def main() -> None:
    data_path = "app/ml/data/fuel.csv"
    df = pd.read_csv(data_path)

    # Example expected columns:
    # features: distance_km, avg_speed, load_kg, idle_min
    # target: fuel_liters
    features = ["distance_km", "avg_speed", "load_kg", "idle_min"]
    target = "fuel_liters"

    X = df[features]
    y = df[target]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    model = XGBRegressor(
        n_estimators=400,
        learning_rate=0.05,
        max_depth=6,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
        objective="reg:squarederror",
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    print("MAE:", mean_absolute_error(y_test, y_pred))
    print("RMSE:", mean_squared_error(y_test, y_pred, squared=False))
    print("R2:", r2_score(y_test, y_pred))

    models_dir = Path("app/ml/models")
    models_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, models_dir / "fuel_model.pkl")

    metadata = {
        "model_type": "xgboost_regressor",
        "target": target,
        "features": features,
    }
    (models_dir / "fuel_model_meta.json").write_text(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
