# ML Module

This folder contains training scripts and model utilities for:
- Predictive maintenance (classification)
- Fuel consumption forecasting (regression)

## Training scripts
- `train_maintenance.py`
  - Model: RandomForestClassifier + SMOTE
  - Primary dataset: `app/ml/data/vehicle_maintenance_data.csv` (processed features + target)
  - Baseline training configuration.
  - Output:
    - `app/ml/models/maintenance_model.pkl`
    - `app/ml/models/maintenance_model_meta.json`
- `train_maintenance_tuned.py`
  - Model: RandomForestClassifier + SMOTE
  - Primary dataset: `app/ml/data/vehicle_maintenance_data.csv` (processed features + target)
  - Uses tuned RandomForest hyperparameters (promoted from tuning report):
    - `n_estimators=220`, `max_depth=12`, `min_samples_split=12`, `min_samples_leaf=1`, `max_features=log2`
    - metadata threshold: `decision_threshold=0.35`
  - Output:
    - `app/ml/models/maintenance_model.pkl`
    - `app/ml/models/maintenance_model_meta.json`
- `train_fuel.py`
  - Model: XGBoost Regressor
  - Output:
    - `app/ml/models/fuel_model.pkl`
    - `app/ml/models/fuel_model_meta.json`

- `tune_maintenance_model.py`
  - Purpose: hyperparameter + threshold tuning for maintenance model
  - Keeps algorithm family: RandomForest + SMOTE
  - Selection objective: `0.6 * recall(class=1) + 0.4 * f1(class=1)`
  - Output:
    - `app/ml/models/maintenance_model.pkl` (best tuned model)
    - `app/ml/models/maintenance_model_meta.json` (updated with threshold and params)
    - `app/ml/models/maintenance_tuning_report.json`

## Inference behavior
- API endpoints load model `.pkl` files from `app/ml/models/`.
- Predictor validates:
  - non-empty feature matrix
  - consistent row width
  - numeric values
  - expected feature count (from metadata or model)
- Maintenance endpoint supports record-based payloads for mixed feature types:
  - `POST /ml/maintenance` with:
    - `{"records":[{...feature key-values...}]}` (recommended)
    - legacy numeric payload `{"features":[[...]]}` still accepted for backward compatibility
  - Response includes:
    - `predictions`: class labels (`0` or `1`)
    - `probabilities`: positive-class probabilities (`Need_Maintenance=1`)
    - `threshold_used`: decision threshold (from metadata, fallback `0.5`)
    - `risk_levels`: `low` / `medium` / `high` labels derived from probability and threshold
- Manager by-vehicle endpoint:
  - `POST /ml/maintenance/by-vehicle/{vehicle_id}`
  - Builds feature record from vehicle + maintenance data, predicts, and persists a snapshot in `maintenance_predictions`.
  - `Vehicle_Model` mapping prefers `vehicles.vehicle_type` (Car/SUV/Truck/Bus/Motorcycle/Van), then falls back to `vehicles.model`.
  - Requires latest DB migration (`supabase/migrations/20260310_maintenance_ml_integration.sql`).

## Leakage validation
- Script: `app/ml/validate_maintenance_model.py`
- Purpose: sanity-check leakage risk before trusting maintenance metrics.
- Checks include:
  - duplicate row rates
  - holdout metrics
  - shuffled-target baseline
  - stratified CV metrics
  - top feature importance
