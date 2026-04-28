// Entity types for FleetLanka

export type Vehicle = {
  id: string;
  org_id?: string;
  plate_no: string;
  make?: string;
  model?: string;
  vehicle_type?: string;
  year?: number;
  status?: string;
  mileage?: number;
  odometer_km?: number;
  transmission_type?: string;
  engine_size_cc?: number;
  accident_history_count?: number;
  fuel_efficiency?: number;
  maintenance_history?: string;
  reported_issues_count?: number;
  tire_condition?: string;
  brake_condition?: string;
  battery_status?: string;
  last_service_cost_lkr?: number;
  next_service_due_km?: number;
  avg_monthly_km?: number;
  recent_trip_count_30d?: number;
  recent_fuel_efficiency_avg?: number;
  service_center_visits_12m?: number;
};

export type Driver = {
  id: string;
  org_id?: string;
  role?: string;
  email?: string;
  status?: string;
  full_name?: string;
  phone?: string;
};

export type Trip = {
  id: string;
  org_id?: string;
  vehicle_id: string;
  driver_id?: string;
  status?: string;
  trip_title?: string;
  scheduled_start?: string;
  origin_label?: string;
  destination_label?: string;
  origin_lat?: number;
  origin_lon?: number;
  destination_lat?: number;
  destination_lon?: number;
  contact_name?: string;
  contact_phone?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  notes?: string;
  start_time?: string;
  end_time?: string;
  start_lat?: number;
  start_lon?: number;
  end_lat?: number;
  end_lon?: number;
  distance_km?: number;
  duration_min?: number;
  avg_speed_kmh?: number;
  idle_min?: number;
};

export type LiveTrip = {
  trip_id: string;
  vehicle_id: string;
  vehicle_plate_no?: string;
  vehicle_label?: string;
  driver_id?: string;
  driver_name?: string;
  lat: number;
  lon: number;
  recorded_at: string;
  speed_kmh?: number;
  start_time: string;
  stale: boolean;
};

export type SavedPlace = {
  id: string;
  org_id: string;
  name: string;
  label: string;
  lat: number;
  lon: number;
  contact_name?: string;
  contact_phone?: string;
  notes?: string;
};

export type FuelLog = {
  id: string;
  vehicle_id: string;
  fuel_date: string;
  liters: number;
  cost_lkr?: number;
  odometer_km?: number;
  vendor?: string;
};

export type FuelForecast = {
  vehicle_id: string;
  plate_no: string;
  forecast_liters_7d: number;
  recent_7d_liters: number;
  recent_30d_liters: number;
  recent_distance_km_30d: number;
  recent_trip_count_30d: number;
  recent_avg_speed_kmh: number;
  fuel_efficiency_gap_ratio: number;
};

export type Maintenance = {
  id: string;
  vehicle_id: string;
  service_center_id?: string;
  service_booking_id?: string;
  service_date: string;
  service_type?: string;
  cost_lkr?: number;
  odometer_km?: number;
  next_service_due_km?: number;
  predicted_due_date?: string;
  notes?: string;
};

export type Document = {
  id: string;
  vehicle_id?: string;
  driver_id?: string;
  doc_type: string;
  doc_number?: string;
  expiry_date?: string;
  file_url?: string;
};

export type ServiceCenter = {
  id: string;
  org_id?: string;
  profile_id?: string;
  name: string;
  phone?: string;
  address?: string;
};

export type ServiceBooking = {
  id: string;
  org_id?: string;
  vehicle_id?: string;
  center_id?: string;
  requested_date: string;
  status?: string;
  notes?: string;
  work_type?: string;
  service_notes?: string;
  proposed_tire_condition?: string;
  proposed_brake_condition?: string;
  proposed_battery_status?: string;
  completion_review_status?: string;
  completion_review_notes?: string;
  completion_reviewed_at?: string;
  completion_reviewed_by?: string;
  completed_at?: string;
  final_cost_lkr?: number;
};

export type Alert = {
  title: string;
  meta: string;
};

export type DriverScore = {
  id: string;
  org_id: string;
  driver_id: string;
  driver_name?: string;
  overall_score: number;
  speed_score?: number;
  idle_score?: number;
  distance_score?: number;
  consistency_score?: number;
  computed_at: string;
};

export type MaintenancePrediction = {
  id: string;
  org_id: string;
  vehicle_id: string;
  prediction: number;
  probability: number;
  risk_level: "low" | "medium" | "high";
  threshold_used?: number;
  model_version?: string;
  input_features?: Record<string, unknown>;
  predicted_at: string;
};
