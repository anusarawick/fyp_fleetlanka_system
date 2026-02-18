from __future__ import annotations

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split


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

    model = RandomForestRegressor(n_estimators=200, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    print("MAE:", mean_absolute_error(y_test, y_pred))
    print("RMSE:", mean_squared_error(y_test, y_pred, squared=False))
    print("R2:", r2_score(y_test, y_pred))

    joblib.dump(model, "app/ml/models/fuel_model.pkl")


if __name__ == "__main__":
    main()
