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
  const totalVehiclesAndDrivers = props.vehicleCount + props.driverCount;
  const activeTripShare = props.vehicleCount > 0 ? (props.activeTrips / props.vehicleCount) * 100 : 0;
  const topDriverScore =
    props.topPerformers.length > 0
      ? Math.max(...props.topPerformers.map((driver) => driver.score))
      : null;

  return (
    <section className="section">
      <section className="analytics-page analytics-page--summary insights-page insights-page--analytics">
      <section className="stats stats--five analytics-stats">
        <div className="stat-card stat-card--blue">
          <div className="stat-icon"><AnalyticsIcon name="fuel" /></div>
          <div className="stat-value">LKR {props.fuelCostTotal.toFixed(0)}</div>
          <div className="stat-label">Fuel Spend</div>
          <div className="stat-sub">Total logged fuel cost</div>
        </div>
        <div className="stat-card stat-card--green">
          <div className="stat-icon"><AnalyticsIcon name="average" /></div>
          <div className="stat-value">{props.avgFuelPerVehicle.toFixed(1)} L</div>
          <div className="stat-label">Avg Fuel / Vehicle</div>
          <div className="stat-sub">Logged consumption per vehicle</div>
        </div>
        <div className="stat-card stat-card--purple">
          <div className="stat-icon"><AnalyticsIcon name="projection" /></div>
          <div className="stat-value">{props.projectedFuelDemand.toFixed(1)} L</div>
          <div className="stat-label">7-Day Demand</div>
          <div className="stat-sub">Projected fuel requirement</div>
        </div>
        <div className="stat-card stat-card--amber">
          <div className="stat-icon"><AnalyticsIcon name="maintenance" /></div>
          <div className="stat-value">{upcomingMaintenance.length}</div>
          <div className="stat-label">Service Outlook</div>
          <div className="stat-sub">Vehicles with next-due mileage</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><AnalyticsIcon name="drivers" /></div>
          <div className="stat-value">{props.driverCount}</div>
          <div className="stat-label">Roster Size</div>
          <div className="stat-sub">Driver accounts available</div>
        </div>
      </section>

      <div className="insights-grid">
        <section className="card insights-panel insights-panel--primary analytics-fuel-outlook">
          <div className="card__header">
            <div>
              <h3>Cost & Fuel Outlook</h3>
              <p className="muted analytics-card__subtitle">Fuel spend and short-term demand in one operating view.</p>
            </div>
          </div>
          <div className="analytics-insight-metrics">
            <div>
              <span>Total fuel cost</span>
              <strong>LKR {props.fuelCostTotal.toFixed(0)}</strong>
            </div>
            <div>
              <span>Next 7 days</span>
              <strong>{props.projectedFuelDemand.toFixed(1)} L</strong>
            </div>
            <div>
              <span>Per vehicle average</span>
              <strong>{props.avgFuelPerVehicle.toFixed(1)} L</strong>
            </div>
          </div>
        </section>

        <section className="card insights-panel analytics-service-outlook">
          <div className="card__header">
            <div>
              <h3>Service Outlook</h3>
              <p className="muted analytics-card__subtitle">Vehicles with recorded next-due odometer thresholds, ordered by urgency.</p>
            </div>
            <div className="analytics-card__actions">
              <button className="btn btn--secondary" onClick={props.onExportMaintenance}>
                Export CSV
              </button>
            </div>
          </div>
          {upcomingMaintenance.length === 0 ? (
            <p className="muted empty">No upcoming service thresholds recorded.</p>
          ) : (
            <ul className="list analytics-service-list">
              {upcomingMaintenance.slice(0, 8).map((m) => (
                <li key={m.id}>
                  <div>
                    <div className="list__title">{typeof m.next_service_due_km === "number" ? `${m.next_service_due_km.toLocaleString()} km` : "Mileage not recorded"}</div>
                    <div className="list__meta">Last service: {m.service_date || "Date not recorded"}</div>
                  </div>
                  <span className="pill pill--warning">Next Due</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card insights-panel analytics-operations-panel">
          <div className="card__header">
            <div>
              <h3>Fleet Operations</h3>
              <p className="muted analytics-card__subtitle">Current operating scale and live dispatch pressure.</p>
            </div>
          </div>
          <div className="analytics-operation-grid">
            <div>
              <span>Fleet assets</span>
              <strong>{props.vehicleCount}</strong>
            </div>
            <div>
              <span>Drivers</span>
              <strong>{props.driverCount}</strong>
            </div>
            <div>
              <span>Active trips</span>
              <strong>{props.activeTrips}</strong>
            </div>
            <div>
              <span>Dispatch load</span>
              <strong>{activeTripShare.toFixed(0)}%</strong>
            </div>
          </div>
          <p className="analytics-footnote">
            {totalVehiclesAndDrivers} vehicles and drivers are represented in this analytics view.
          </p>
        </section>

        <section className="card insights-panel insights-panel--wide">
          <div className="card__header">
            <div>
              <h3>Driver Readiness</h3>
              <p className="muted analytics-card__subtitle">Top driver scores available for dispatch review.</p>
            </div>
            {topDriverScore !== null && <span className="pill pill--success">Best score {topDriverScore}/100</span>}
          </div>
          {props.topPerformers.length === 0 ? (
            <p className="muted empty">No driver scores available yet.</p>
          ) : (
            <ul className="list analytics-driver-list">
              {props.topPerformers.map((d) => (
                <li key={d.driverId}>
                  <div>
                    <div className="list__title">{d.driverName}</div>
                    <div className="list__meta">Dispatch readiness score</div>
                  </div>
                  <span className="pill pill--info">{d.score}/100</span>
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
