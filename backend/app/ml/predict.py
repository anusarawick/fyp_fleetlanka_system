from __future__ import annotations

import joblib


class MaintenancePredictor:
    def __init__(self, model_path: str):
        self.model = joblib.load(model_path)

    def predict(self, features: list[list[float]]) -> list[int]:
        return self.model.predict(features).tolist()


class FuelPredictor:
    def __init__(self, model_path: str):
        self.model = joblib.load(model_path)

    def predict(self, features: list[list[float]]) -> list[float]:
        return self.model.predict(features).tolist()
