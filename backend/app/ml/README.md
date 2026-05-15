# FleetLanka ML Module

This folder contains the model training, validation, feature-building, and inference support code used by FleetLanka.

The project currently uses ML for two areas:

- **Predictive maintenance:** classify whether a vehicle is likely to need maintenance within the next 7 days.
- **Fuel forecasting:** estimate vehicle or fleet fuel demand for the next 7 days.

## Current model paths

### Live maintenance prediction

The live by-vehicle maintenance route uses the maintenance v3 model path.

- Model artifact: `app/ml/models/maintenance_model_v3.pkl`
- Metadata: `app/ml/models/maintenance_model_v3_meta.json`
- Model type: `RandomForestClassifier`
- Oversampling: `SMOTE`
- Target: `Need_Maintenance_7d`

Live feature rows are built from operational data such as vehicles, trips, fuel logs, maintenance records, operating profiles, and component state. The prediction result is stored in `maintenance_predictions`.

### Fuel forecasting

Fuel forecasting uses a regression model to estimate 7-day fuel demand.

- Model type: `RandomForestRegressor`
- Main live routes:
  - `GET /ml/fuel/forecast`
  - `GET /ml/fuel/forecast/{vehicle_id}`

The fuel v2 weekly training path is available for offline validation, but it is kept separate from live inference until reviewed.

## Feature builder

The shared weekly feature-builder version is:

```text
fleetlanka_weekly_features_v1
```

It is defined in `features_v3.py` as `FEATURE_BUILDER_VERSION`.

The same feature contract is used by the weekly maintenance v3 and fuel v2 training/validation paths. This keeps the generated datasets, training scripts, validation scripts, and model metadata aligned.

Important functions:

- `build_maintenance_v3_features(...)`
- `build_fuel_v2_features(...)`

## Main scripts

Weekly dataset and model path:

```bash
python -m app.ml.generate_weekly_fleet_datasets
python -m app.ml.train_maintenance_v3
python -m app.ml.validate_maintenance_model_v3
python -m app.ml.validate_maintenance_ablation_v3
python -m app.ml.train_fuel_v2
python -m app.ml.validate_fuel_model_v2
```

Older baseline and v2 scripts are still kept for comparison and report history:

```bash
python -m app.ml.train_maintenance
python -m app.ml.train_maintenance_tuned
python -m app.ml.tune_maintenance_model
python -m app.ml.validate_maintenance_model
python -m app.ml.train_maintenance_v2
python -m app.ml.tune_maintenance_model_v2
python -m app.ml.validate_maintenance_model_v2
python -m app.ml.train_fuel
python -m app.ml.validate_fuel_model
```

## Data

The weekly ML path uses generated, application-aligned fleet data. The generator creates vehicle records, weekly operations, maintenance events, and supervised datasets for maintenance and fuel models.

Main generated datasets:

- `app/ml/data/weekly_maintenance_ml_dataset.csv`
- `app/ml/data/weekly_fuel_ml_dataset.csv`
- `app/ml/data/vehicles.csv`
- `app/ml/data/weekly_operations.csv`
- `app/ml/data/maintenance_events.csv`

The generated CSV files are kept readable so they can be inspected and referenced in the final report.

## Inference routes

Maintenance:

- `POST /ml/maintenance`
- `POST /ml/maintenance/by-vehicle/{vehicle_id}`
- `GET /ml/maintenance/predictions`

Fuel:

- `GET /ml/fuel/forecast`
- `GET /ml/fuel/forecast/{vehicle_id}`
- `POST /ml/fuel`

The generic `POST` routes are mainly useful for direct model-input testing. Normal app usage relies on backend routes that build features from stored operational data.

## Live maintenance support tables

Maintenance v3 live prediction depends on extra vehicle profile data:

- `vehicle_operating_profiles`
- `vehicle_component_state`
- structured maintenance fields such as `event_type`, `event_category`, and `severity`

Demo data can be seeded with:

```bash
python -m app.ml.seed_maintenance_v3_demo_data --org-id <ORG_ID> --reset
```

Use this only with the intended Supabase credentials and demo data.
