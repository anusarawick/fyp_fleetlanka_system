from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import pandas as pd


class _BasePredictor:
    def __init__(self, model_path: str, meta_path: str | None = None):
        self.model = joblib.load(model_path)
        self.expected_features: int | None = None
        self.feature_names: list[str] = []
        self.numeric_features: list[str] = []
        self.categorical_features: list[str] = []
        self.decision_threshold: float | None = None

        if hasattr(self.model, "n_features_in_"):
            try:
                self.expected_features = int(self.model.n_features_in_)
            except Exception:
                self.expected_features = None

        if meta_path:
            self._load_metadata(meta_path)
        self._infer_features_from_pipeline()

    def _infer_features_from_pipeline(self) -> None:
        if self.feature_names:
            return
        try:
            preprocessor = self.model.named_steps["preprocessor"]
            feature_names_in = getattr(preprocessor, "feature_names_in_", None)
            if feature_names_in is not None:
                self.feature_names = [str(x) for x in feature_names_in.tolist()]

            if not self.numeric_features or not self.categorical_features:
                num_cols: list[str] = []
                cat_cols: list[str] = []
                for name, _, cols in getattr(preprocessor, "transformers", []):
                    if name == "num":
                        num_cols = [str(c) for c in cols]
                    elif name == "cat":
                        cat_cols = [str(c) for c in cols]
                if not self.numeric_features:
                    self.numeric_features = num_cols
                if not self.categorical_features:
                    self.categorical_features = cat_cols

            if self.feature_names:
                self.expected_features = len(self.feature_names)
        except Exception:
            # Fallback best-effort; inference can still fail with a clear message later.
            return

    def _load_metadata(self, meta_path: str) -> None:
        meta_file = Path(meta_path)
        if not meta_file.exists():
            return
        try:
            raw: Any = json.loads(meta_file.read_text())
            features = raw.get("features", [])
            if isinstance(features, list) and all(isinstance(x, str) for x in features):
                self.feature_names = features
                self.expected_features = len(features)
            num_features = raw.get("numeric_features", [])
            cat_features = raw.get("categorical_features", [])
            if isinstance(num_features, list) and all(isinstance(x, str) for x in num_features):
                self.numeric_features = num_features
            if isinstance(cat_features, list) and all(isinstance(x, str) for x in cat_features):
                self.categorical_features = cat_features
            threshold = raw.get("decision_threshold")
            if isinstance(threshold, (int, float)):
                t = float(threshold)
                if 0.0 < t < 1.0:
                    self.decision_threshold = t
        except Exception:
            # Keep inference available even if metadata is missing/corrupt.
            return

    def _validate_features(self, features: list[list[float]]) -> None:
        if not features:
            raise ValueError("features cannot be empty")

        row_lengths = {len(row) for row in features}
        if len(row_lengths) != 1:
            raise ValueError("all feature rows must have the same number of columns")

        width = next(iter(row_lengths))
        if width == 0:
            raise ValueError("feature rows cannot be empty")

        if self.expected_features is not None and width != self.expected_features:
            if self.feature_names:
                expected = f"{self.expected_features} columns: {', '.join(self.feature_names)}"
            else:
                expected = f"{self.expected_features} columns"
            raise ValueError(f"invalid feature width: got {width}, expected {expected}")

        for row in features:
            for value in row:
                if not isinstance(value, (int, float)):
                    raise ValueError("all feature values must be numeric")


class MaintenancePredictor(_BasePredictor):
    def __init__(
        self,
        model_path: str,
        meta_path: str = "app/ml/models/maintenance_model_meta.json",
    ):
        super().__init__(model_path, meta_path)

    def predict(self, features: list[list[float]]) -> list[int]:
        self._validate_features(features)
        return self.model.predict(features).tolist()

    def predict_with_threshold(self, features: list[list[float]]) -> tuple[list[int], list[float], float]:
        self._validate_features(features)
        if not hasattr(self.model, "predict_proba"):
            preds = self.model.predict(features).tolist()
            probs = [float(x) for x in preds]
            return preds, probs, self._effective_threshold()

        probs = self.model.predict_proba(features)[:, 1].tolist()
        threshold = self._effective_threshold()
        preds = [1 if p >= threshold else 0 for p in probs]
        return preds, probs, threshold

    def predict_records(self, records: list[dict[str, object]]) -> list[int]:
        frame = self._records_to_frame(records)
        return self.model.predict(frame).tolist()

    def predict_records_with_threshold(
        self,
        records: list[dict[str, object]],
    ) -> tuple[list[int], list[float], float]:
        frame = self._records_to_frame(records)
        if not hasattr(self.model, "predict_proba"):
            preds = self.model.predict(frame).tolist()
            probs = [float(x) for x in preds]
            return preds, probs, self._effective_threshold()

        probs = self.model.predict_proba(frame)[:, 1].tolist()
        threshold = self._effective_threshold()
        preds = [1 if p >= threshold else 0 for p in probs]
        return preds, probs, threshold

    def _records_to_frame(self, records: list[dict[str, object]]) -> pd.DataFrame:
        if not records:
            raise ValueError("records cannot be empty")
        if not self.feature_names:
            raise ValueError("could not determine feature columns from metadata or model pipeline")

        frame = pd.DataFrame(records)
        missing = [c for c in self.feature_names if c not in frame.columns]
        if missing:
            raise ValueError(f"missing required fields: {', '.join(missing)}")

        frame = frame[self.feature_names].copy()

        for col in self.numeric_features:
            if col in frame.columns:
                frame[col] = pd.to_numeric(frame[col], errors="coerce")

        for col in self.categorical_features:
            if col in frame.columns:
                frame[col] = frame[col].astype(str)

        return frame

    def _effective_threshold(self) -> float:
        if self.decision_threshold is None:
            return 0.5
        return self.decision_threshold


class FuelPredictor(_BasePredictor):
    def __init__(self, model_path: str, meta_path: str = "app/ml/models/fuel_model_meta.json"):
        super().__init__(model_path, meta_path)

    def predict(self, features: list[list[float]]) -> list[float]:
        self._validate_features(features)
        return self.model.predict(features).tolist()
