from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class VehicleCreate(BaseModel):
    plate_no: str
    make: Optional[str] = None
    model: Optional[str] = None
    vehicle_type: Optional[str] = None
    year: Optional[int] = None
    status: Optional[str] = "active"
    mileage: Optional[float] = None
    odometer_km: Optional[float] = None
    transmission_type: Optional[str] = None
    engine_size_cc: Optional[int] = None
    accident_history_count: Optional[int] = None
    fuel_efficiency: Optional[float] = None
    maintenance_history: Optional[str] = None
    reported_issues_count: Optional[int] = None
    tire_condition: Optional[str] = None
    brake_condition: Optional[str] = None
    battery_status: Optional[str] = None
    image_url: Optional[str] = None
    image_path: Optional[str] = None
    last_service_cost_lkr: Optional[float] = None
    next_service_due_km: Optional[float] = None
    avg_monthly_km: Optional[float] = None
    recent_trip_count_30d: Optional[int] = None
    recent_fuel_efficiency_avg: Optional[float] = None
    service_center_visits_12m: Optional[int] = None
    fuel_type: Optional[str] = None
    business_type: Optional[str] = None
    road_condition_primary: Optional[str] = None
    driver_behavior_profile: Optional[str] = None
    expected_kmpl: Optional[float] = None
    typical_load_factor: Optional[float] = None
    service_interval_km: Optional[float] = None
    oil_interval_km: Optional[float] = None
    tyre_life_km: Optional[float] = None
    brake_life_km: Optional[float] = None
    battery_life_months: Optional[float] = None
    fuel_filter_interval_km: Optional[float] = None
    last_service_odometer_km: Optional[float] = None
    last_oil_change_odometer_km: Optional[float] = None
    last_tyre_change_odometer_km: Optional[float] = None
    last_brake_service_odometer_km: Optional[float] = None
    last_fuel_filter_change_odometer_km: Optional[float] = None
    battery_installed_at: Optional[str] = None


class VehicleUpdate(BaseModel):
    plate_no: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    vehicle_type: Optional[str] = None
    year: Optional[int] = None
    status: Optional[str] = None
    mileage: Optional[float] = None
    odometer_km: Optional[float] = None
    transmission_type: Optional[str] = None
    engine_size_cc: Optional[int] = None
    accident_history_count: Optional[int] = None
    fuel_efficiency: Optional[float] = None
    maintenance_history: Optional[str] = None
    reported_issues_count: Optional[int] = None
    tire_condition: Optional[str] = None
    brake_condition: Optional[str] = None
    battery_status: Optional[str] = None
    image_url: Optional[str] = None
    image_path: Optional[str] = None
    last_service_cost_lkr: Optional[float] = None
    next_service_due_km: Optional[float] = None
    avg_monthly_km: Optional[float] = None
    recent_trip_count_30d: Optional[int] = None
    recent_fuel_efficiency_avg: Optional[float] = None
    service_center_visits_12m: Optional[int] = None
    fuel_type: Optional[str] = None
    business_type: Optional[str] = None
    road_condition_primary: Optional[str] = None
    driver_behavior_profile: Optional[str] = None
    expected_kmpl: Optional[float] = None
    typical_load_factor: Optional[float] = None
    service_interval_km: Optional[float] = None
    oil_interval_km: Optional[float] = None
    tyre_life_km: Optional[float] = None
    brake_life_km: Optional[float] = None
    battery_life_months: Optional[float] = None
    fuel_filter_interval_km: Optional[float] = None
    last_service_odometer_km: Optional[float] = None
    last_oil_change_odometer_km: Optional[float] = None
    last_tyre_change_odometer_km: Optional[float] = None
    last_brake_service_odometer_km: Optional[float] = None
    last_fuel_filter_change_odometer_km: Optional[float] = None
    battery_installed_at: Optional[str] = None


class VehicleOut(BaseModel):
    id: str
    org_id: str
    plate_no: str
    make: Optional[str] = None
    model: Optional[str] = None
    vehicle_type: Optional[str] = None
    year: Optional[int] = None
    status: Optional[str] = None
    mileage: Optional[float] = None
    odometer_km: Optional[float] = None
    transmission_type: Optional[str] = None
    engine_size_cc: Optional[int] = None
    accident_history_count: Optional[int] = None
    fuel_efficiency: Optional[float] = None
    maintenance_history: Optional[str] = None
    reported_issues_count: Optional[int] = None
    tire_condition: Optional[str] = None
    brake_condition: Optional[str] = None
    battery_status: Optional[str] = None
    image_url: Optional[str] = None
    image_path: Optional[str] = None
    last_service_cost_lkr: Optional[float] = None
    next_service_due_km: Optional[float] = None
    avg_monthly_km: Optional[float] = None
    recent_trip_count_30d: Optional[int] = None
    recent_fuel_efficiency_avg: Optional[float] = None
    service_center_visits_12m: Optional[int] = None
    fuel_type: Optional[str] = None
    business_type: Optional[str] = None
    road_condition_primary: Optional[str] = None
    driver_behavior_profile: Optional[str] = None
    expected_kmpl: Optional[float] = None
    typical_load_factor: Optional[float] = None
    service_interval_km: Optional[float] = None
    oil_interval_km: Optional[float] = None
    tyre_life_km: Optional[float] = None
    brake_life_km: Optional[float] = None
    battery_life_months: Optional[float] = None
    fuel_filter_interval_km: Optional[float] = None
    last_service_odometer_km: Optional[float] = None
    last_oil_change_odometer_km: Optional[float] = None
    last_tyre_change_odometer_km: Optional[float] = None
    last_brake_service_odometer_km: Optional[float] = None
    last_fuel_filter_change_odometer_km: Optional[float] = None
    battery_installed_at: Optional[str] = None


class VehicleOutMinimal(BaseModel):
    id: str
    plate_no: str
