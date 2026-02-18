from __future__ import annotations

import joblib
import pandas as pd
from imblearn.over_sampling import SMOTE
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split


def main() -> None:
    data_path = "app/ml/data/maintenance.csv"
    df = pd.read_csv(data_path)

    # Example expected columns:
    # features: mileage, engine_hours, avg_speed, last_service_km, temp
    # target: needs_service (0/1)
    features = ["mileage", "engine_hours", "avg_speed", "last_service_km", "temp"]
    target = "needs_service"

    X = df[features]
    y = df[target]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    smote = SMOTE(random_state=42)
    X_res, y_res = smote.fit_resample(X_train, y_train)

    model = RandomForestClassifier(n_estimators=200, random_state=42)
    model.fit(X_res, y_res)

    y_pred = model.predict(X_test)
    print(classification_report(y_test, y_pred))

    joblib.dump(model, "app/ml/models/maintenance_model.pkl")


if __name__ == "__main__":
    main()
