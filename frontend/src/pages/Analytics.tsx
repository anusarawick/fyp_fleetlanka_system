import { BarChart3, Fuel, TrendingUp, Users, Wrench, type LucideIcon } from "lucide-react";

type FuelLog = {
  id: string;
  fuel_date: string;
  liters: number;
  cost_lkr?: number;
  vehicle_id: string;
};

type FuelForecast = {
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

type MaintenanceRecord = {
  id: string;
  service_date: string;
  next_service_due_km?: number;
};

type AnalyticsProps = {
  maintenance: MaintenanceRecord[];
  fuelCostTotal: number;
  projectedFuelDemand: number;
  avgFuelPerVehicle: number;
  vehicleCount: number;
  driverCount: number;
  activeTrips: number;
  topPerformers: { driverId: string; driverName: string; score: number }[];
  onExportMaintenance: () => void;
};

type AnalyticsIconName = "fuel" | "average" | "projection" | "maintenance" | "drivers";

function AnalyticsIcon({ name }: { name: AnalyticsIconName }) {
  const icons: Record<AnalyticsIconName, LucideIcon> = {
    fuel: Fuel,
    average: BarChart3,
    projection: TrendingUp,
    maintenance: Wrench,
    drivers: Users,
  };
  const Icon = icons[name];
  return <Icon aria-hidden="true" />;
}

export default function Analytics(props: AnalyticsProps) {
  const upcomingMaintenance = props.maintenance
    .filter((m) => typeof m.next_service_due_km === "number")
    .sort((a, b) => (a.next_service_due_km || 0) - (b.next_service_due_km || 0));

  return (
    <section className="section">
      <section className="analytics-page analytics-page--summary">
      <section className="stats stats--five analytics-stats">
        <div className="stat-card stat-card--blue">
          <div className="stat-icon"><AnalyticsIcon name="fuel" /></div>
          <div className="stat-value">{props.fuelCostTotal.toFixed(0)}</div>
          <div className="stat-label">Fuel Cost (LKR)</div>
          <div className="stat-sub">Total logged</div>
        </div>
        <div className="stat-card stat-card--green">
          <div className="stat-icon"><AnalyticsIcon name="average" /></div>
          <div className="stat-value">{props.avgFuelPerVehicle.toFixed(1)}</div>
          <div className="stat-label">Avg Fuel / Vehicle</div>
          <div className="stat-sub">Liters</div>
        </div>
        <div className="stat-card stat-card--purple">
          <div className="stat-icon"><AnalyticsIcon name="projection" /></div>
          <div className="stat-value">{props.projectedFuelDemand.toFixed(1)}</div>
          <div className="stat-label">Projected Fuel (7d)</div>
          <div className="stat-sub">Liters</div>
        </div>
        <div className="stat-card stat-card--amber">
          <div className="stat-icon"><AnalyticsIcon name="maintenance" /></div>
          <div className="stat-value">{upcomingMaintenance.length}</div>
          <div className="stat-label">Maintenance Tracked</div>
          <div className="stat-sub">By next due km</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><AnalyticsIcon name="drivers" /></div>
          <div className="stat-value">{props.driverCount}</div>
          <div className="stat-label">Drivers</div>
          <div className="stat-sub">Registered</div>
        </div>
      </section>

      <div className="grid analytics-summary-grid">
        <section className="card analytics-card--summary">
          <div className="card__header">
            <div>
              <h3>Maintenance Thresholds</h3>
              <p className="muted analytics-card__subtitle">Maintenance records carrying explicit next-due odometer thresholds.</p>
            </div>
            <div className="analytics-card__actions">
              <button
                className="btn btn--secondary"
                onClick={props.onExportMaintenance}
              >
                Export CSV
              </button>
            </div>
          </div>
          {upcomingMaintenance.length === 0 ? (
            <p className="muted empty">No next-due mileage thresholds recorded.</p>
          ) : (
            <ul className="list">
              {upcomingMaintenance.slice(0, 8).map((m) => (
                <li key={m.id}>
                  <div className="list__title">{typeof m.next_service_due_km === "number" ? `${m.next_service_due_km.toLocaleString()} km` : "--"}</div>
                  <div className="list__meta">{m.service_date}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card analytics-card--summary">
          <div className="card__header">
            <div>
              <h3>Fleet Summary</h3>
              <p className="muted analytics-card__subtitle">Current fleet and trip coverage across the portal.</p>
            </div>
          </div>
          <ul className="list">
            <li>
              <div className="list__title">Registered Vehicles</div>
              <div className="list__meta">{props.vehicleCount}</div>
            </li>
            <li>
              <div className="list__title">Registered Drivers</div>
              <div className="list__meta">{props.driverCount}</div>
            </li>
            <li>
              <div className="list__title">Active Trips</div>
              <div className="list__meta">{props.activeTrips}</div>
            </li>
          </ul>
        </section>

        <section className="card analytics-card--wide analytics-card--summary">
          <div className="card__header">
            <div>
              <h3>Top Performing Drivers</h3>
              <p className="muted analytics-card__subtitle">Latest top-scoring drivers from current performance snapshots.</p>
            </div>
          </div>
          {props.topPerformers.length === 0 ? (
            <p className="muted empty">No driver scores recorded yet.</p>
          ) : (
            <ul className="list">
              {props.topPerformers.map((d) => (
                <li key={d.driverId}>
                  <div className="list__title">{d.driverName}</div>
                  <div className="list__meta">Score: {d.score}/100</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      </section>
    </section>
  );
}
