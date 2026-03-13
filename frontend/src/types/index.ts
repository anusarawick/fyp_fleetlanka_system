// Entity types for FleetLanka

export type Vehicle = {
  id: string;
  org_id: string;
  plate_no: string;
  make?: string;
  model?: string;
  year?: number;
  status?: string;
  odometer_km?: number;
};

export type Driver = {
  id: string;
  org_id: string;
  role: string;
  full_name?: string;
  phone?: string;
};

export type Trip = {
  id: string;
  vehicle_id: string;
  start_time: string;
  end_time?: string;
  distance_km?: number;
  duration_min?: number;
  avg_speed_kmh?: number;
  idle_min?: number;
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

export type Maintenance = {
  id: string;
  vehicle_id: string;
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
  doc_type: string;
  doc_number?: string;
  expiry_date?: string;
};

export type ServiceCenter = {
  id: string;
  name: string;
};

export type ServiceBooking = {
  id: string;
  requested_date: string;
  status?: string;
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
