from __future__ import annotations

from typing import Iterable

import pandas as pd

FEATURE_BUILDER_VERSION = "fleetlanka_weekly_features_v1"

CONTEXT_ONLY_COLUMNS = ("vehicle_id", "snapshot_date")
MAINTENANCE_TARGET_COL = "Need_Maintenance_7d"
FUEL_TARGET_COL = "predicted_fuel_liters_7d"

MAINTENANCE_ML_COLUMNS = [
    "vehicle_id",
    "snapshot_date",
    "year",
    "month",
    "week_of_year",
    "vehicle_type",
    "brand",
    "model",
    "fuel_type",
    "engine_capacity_cc",
    "transmission_type",
    "business_type",
    "province",
    "district",
    "road_condition_primary",
    "driver_behavior_profile",
    "vehicle_age_years",
    "odometer_km",
    "current_status",
    "weekly_distance_km",
    "distance_last_4w",
    "distance_last_8w",
    "avg_weekly_distance_4w",
    "trip_count_week",
    "trip_count_last_4w",
    "avg_trip_distance_week",
    "idle_minutes_week",
    "fuel_used_liters_week",
    "actual_fuel_efficiency_kmpl",
    "fuel_efficiency_avg_4w",
    "fuel_efficiency_change_4w",
    "overload_ratio_week",
    "overload_avg_last_4w",
    "km_since_last_service",
    "km_since_last_oil_change",
    "km_since_last_tyre_change",
    "km_since_last_brake_service",
    "km_since_last_fuel_filter_change",
    "battery_age_months",
    "service_due_ratio",
    "oil_due_ratio",
    "tyre_wear_ratio",
    "brake_wear_ratio",
    "battery_age_ratio",
    "fuel_filter_due_ratio",
    "missed_services_count",
    "accident_count",
    "repeat_failure_count",
    "maintenance_events_last_12w",
    "repair_events_last_24w",
    "avg_repair_cost_last_24w",
    "days_since_last_maintenance",
    "service_overdue_flag",
    "component_wear_score",
    "vehicle_stress_score",
    MAINTENANCE_TARGET_COL,
]

FUEL_ML_COLUMNS = [
    "vehicle_id",
    "snapshot_date",
    "year",
    "month",
    "week_of_year",
    "vehicle_type",
    "brand",
    "model",
    "fuel_type",
    "engine_capacity_cc",
    "transmission_type",
    "vehicle_age_years",
    "business_type",
    "province",
    "district",
    "road_condition_primary",
    "driver_behavior_profile",
    "avg_expected_kmpl",
    "odometer_km",
    "current_status",
    "fuel_price_per_liter",
    "weekly_distance_km",
    "trip_count_week",
    "avg_trip_distance_week",
    "avg_trip_duration_min_week",
    "idle_minutes_week",
    "avg_speed_kmh_week",
    "overload_ratio_week",
    "distance_last_4w",
    "distance_last_8w",
    "avg_weekly_distance_4w",
    "trip_count_last_4w",
    "idle_minutes_last_4w",
    "avg_speed_last_4w",
    "overload_avg_last_4w",
    "high_usage_weeks_last_8w",
    "fuel_used_liters_week",
    "fuel_cost_week_lkr",
    "fuel_liters_last_4w",
    "fuel_liters_last_8w",
    "fuel_cost_last_4w_lkr",
    "actual_fuel_efficiency_kmpl",
    "fuel_efficiency_avg_4w",
    "fuel_efficiency_avg_8w",
    "fuel_efficiency_drop_percent",
    "fuel_efficiency_change_4w",
    "idle_ratio_week",
    "idle_ratio_4w",
    "distance_trend_4w",
    "fuel_usage_trend_4w",
    "trip_density_per_100km",
    "liters_per_100km_week",
    "liters_per_100km_4w",
    "usage_intensity_score",
    "fuel_waste_score",
    FUEL_TARGET_COL,
]

MODEL_EXCLUDED_COLUMNS = ("province", "district")

MAINTENANCE_FEATURE_COLUMNS = [
    column
    for column in MAINTENANCE_ML_COLUMNS
    if column not in {*CONTEXT_ONLY_COLUMNS, MAINTENANCE_TARGET_COL, *MODEL_EXCLUDED_COLUMNS}
]
FUEL_FEATURE_COLUMNS = [column for column in FUEL_ML_COLUMNS if column not in {*CONTEXT_ONLY_COLUMNS, FUEL_TARGET_COL}]


def _missing_columns(df: pd.DataFrame, columns: Iterable[str]) -> list[str]:
    return [column for column in columns if column not in df.columns]


def require_columns(df: pd.DataFrame, columns: Iterable[str], frame_name: str) -> None:
    missing = _missing_columns(df, columns)
    if missing:
        formatted = ", ".join(missing)
        raise ValueError(f"{frame_name} is missing required columns: {formatted}")


def _safe_div(numerator: pd.Series, denominator: pd.Series, default: float = 0.0) -> pd.Series:
    result = numerator / denominator.replace(0, pd.NA)
    return pd.to_numeric(result, errors="coerce").fillna(default)


def _numeric(work: pd.DataFrame, column: str, default: float = 0.0) -> pd.Series:
    if column not in work.columns:
        return pd.Series(default, index=work.index)
    return pd.to_numeric(work[column], errors="coerce").fillna(default)


def _factor(work: pd.DataFrame, column: str, values: dict[str, float], default: float) -> pd.Series:
    if column not in work.columns:
        return pd.Series(default, index=work.index)
    return work[column].map(values).fillna(default).astype(float)


def _add_due_ratio(work: pd.DataFrame, output: str, numerator: str, denominator: str) -> None:
    if output not in work.columns and numerator in work.columns and denominator in work.columns:
        work[output] = _safe_div(_numeric(work, numerator), _numeric(work, denominator), default=0.0)


def _derive_common_weekly_features(work: pd.DataFrame) -> None:
    if "avg_weekly_distance_4w" not in work.columns and "distance_last_4w" in work.columns:
        fallback = _numeric(work, "weekly_distance_km") if "weekly_distance_km" in work.columns else 0.0
        work["avg_weekly_distance_4w"] = _safe_div(_numeric(work, "distance_last_4w"), pd.Series(4.0, index=work.index))
        work["avg_weekly_distance_4w"] = work["avg_weekly_distance_4w"].where(work["distance_last_4w"] != 0, fallback)
    if (
        "fuel_efficiency_change_4w" not in work.columns
        and "actual_fuel_efficiency_kmpl" in work.columns
        and "fuel_efficiency_avg_4w" in work.columns
    ):
        work["fuel_efficiency_change_4w"] = _numeric(work, "actual_fuel_efficiency_kmpl") - _numeric(
            work, "fuel_efficiency_avg_4w"
        )


def _derive_maintenance_features(work: pd.DataFrame) -> None:
    _derive_common_weekly_features(work)
    _add_due_ratio(work, "service_due_ratio", "km_since_last_service", "service_interval_km")
    _add_due_ratio(work, "oil_due_ratio", "km_since_last_oil_change", "oil_interval_km")
    _add_due_ratio(work, "tyre_wear_ratio", "km_since_last_tyre_change", "tyre_life_km")
    _add_due_ratio(work, "brake_wear_ratio", "km_since_last_brake_service", "brake_life_km")
    _add_due_ratio(work, "battery_age_ratio", "battery_age_months", "battery_life_months")
    _add_due_ratio(work, "fuel_filter_due_ratio", "km_since_last_fuel_filter_change", "fuel_filter_interval_km")

    if "service_overdue_flag" not in work.columns and {"service_due_ratio", "oil_due_ratio"}.issubset(work.columns):
        work["service_overdue_flag"] = ((_numeric(work, "service_due_ratio") >= 1.0) | (_numeric(work, "oil_due_ratio") >= 1.0)).astype(int)

    if "component_wear_score" not in work.columns:
        work["component_wear_score"] = (
            _numeric(work, "service_due_ratio") * 0.25
            + _numeric(work, "oil_due_ratio") * 0.20
            + _numeric(work, "tyre_wear_ratio") * 0.18
            + _numeric(work, "brake_wear_ratio") * 0.20
            + _numeric(work, "battery_age_ratio") * 0.10
            + _numeric(work, "fuel_filter_due_ratio") * 0.07
        ).clip(0, 3.5)

    if "vehicle_stress_score" not in work.columns:
        driver_factor = _factor(work, "driver_behavior_profile", {"safe": 0.88, "normal": 1.0, "aggressive": 1.22}, 1.0)
        road_factor = _factor(work, "road_condition_primary", {"urban": 1.0, "highway": 0.84, "rural": 1.12, "estate_roads": 1.30, "mixed": 1.08}, 1.0)
        work["vehicle_stress_score"] = (
            _numeric(work, "distance_last_4w") / 4200.0
            + _numeric(work, "overload_avg_last_4w") * 0.35
            + driver_factor * 0.28
            + road_factor * 0.26
        ).clip(0, 4.0)


def _derive_fuel_features(work: pd.DataFrame) -> None:
    _derive_common_weekly_features(work)
    if "idle_ratio_week" not in work.columns and {"idle_minutes_week", "avg_trip_duration_min_week", "trip_count_week"}.issubset(work.columns):
        denominator = _numeric(work, "avg_trip_duration_min_week") * _numeric(work, "trip_count_week") + _numeric(work, "idle_minutes_week")
        work["idle_ratio_week"] = _safe_div(_numeric(work, "idle_minutes_week"), denominator, default=0.0)
    if "idle_ratio_4w" not in work.columns and {"idle_minutes_last_4w", "trip_count_last_4w"}.issubset(work.columns):
        denominator = _numeric(work, "trip_count_last_4w") * 60.0 + _numeric(work, "idle_minutes_last_4w")
        work["idle_ratio_4w"] = _safe_div(_numeric(work, "idle_minutes_last_4w"), denominator, default=0.0)
    if "trip_density_per_100km" not in work.columns and {"trip_count_week", "weekly_distance_km"}.issubset(work.columns):
        work["trip_density_per_100km"] = _safe_div(_numeric(work, "trip_count_week"), _numeric(work, "weekly_distance_km"), default=0.0) * 100.0
    if "liters_per_100km_week" not in work.columns and {"fuel_used_liters_week", "weekly_distance_km"}.issubset(work.columns):
        work["liters_per_100km_week"] = _safe_div(_numeric(work, "fuel_used_liters_week"), _numeric(work, "weekly_distance_km"), default=0.0) * 100.0
    if "liters_per_100km_4w" not in work.columns and {"fuel_liters_last_4w", "distance_last_4w"}.issubset(work.columns):
        work["liters_per_100km_4w"] = _safe_div(_numeric(work, "fuel_liters_last_4w"), _numeric(work, "distance_last_4w"), default=0.0) * 100.0
    if "usage_intensity_score" not in work.columns:
        work["usage_intensity_score"] = ((_numeric(work, "distance_last_4w") / 4200.0) + (_numeric(work, "trip_count_last_4w") / 95.0)).clip(0, 4.0)
    if "fuel_waste_score" not in work.columns and {"avg_expected_kmpl", "actual_fuel_efficiency_kmpl"}.issubset(work.columns):
        efficiency_loss = (
            (_numeric(work, "avg_expected_kmpl") - _numeric(work, "actual_fuel_efficiency_kmpl"))
            / _numeric(work, "avg_expected_kmpl").replace(0, pd.NA)
        ).fillna(0.0).clip(lower=0)
        work["fuel_waste_score"] = (
            efficiency_loss * 2.2 + (_numeric(work, "idle_minutes_week") / 360.0) + (_numeric(work, "overload_ratio_week") - 1.0).clip(lower=0)
        ).clip(0, 4.0)


def _prepare_weekly_frame(
    df: pd.DataFrame,
    ordered_columns: list[str],
    target_col: str,
    frame_name: str,
    include_target: bool,
    derive_features: bool,
) -> pd.DataFrame:
    work = df.copy()
    if derive_features:
        if target_col == MAINTENANCE_TARGET_COL:
            _derive_maintenance_features(work)
        elif target_col == FUEL_TARGET_COL:
            _derive_fuel_features(work)

    required = ordered_columns if include_target else [column for column in ordered_columns if column != target_col]
    require_columns(work, required, frame_name)

    if "snapshot_date" in work.columns:
        parsed_dates = pd.to_datetime(work["snapshot_date"], errors="coerce")
        work = work.loc[parsed_dates.notna()].copy()
        work["snapshot_date"] = parsed_dates.loc[parsed_dates.notna()]

    return work.reindex(columns=required)


def build_maintenance_v3_features(df: pd.DataFrame, include_target: bool = True) -> pd.DataFrame:
    return _prepare_weekly_frame(
        df,
        MAINTENANCE_ML_COLUMNS,
        MAINTENANCE_TARGET_COL,
        "maintenance v3 weekly feature frame",
        include_target,
        derive_features=True,
    )


def build_fuel_v2_features(df: pd.DataFrame, include_target: bool = True) -> pd.DataFrame:
    return _prepare_weekly_frame(
        df,
        FUEL_ML_COLUMNS,
        FUEL_TARGET_COL,
        "fuel v2 weekly feature frame",
        include_target,
        derive_features=True,
    )
