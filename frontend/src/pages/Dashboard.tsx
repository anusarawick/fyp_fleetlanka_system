import { useMemo } from "react";
import MapView from "../components/MapView";
import { DriverScore, LiveTrip, Maintenance, MaintenancePrediction, ServiceBooking, Vehicle } from "../types";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarClock,
  Car,
  ClipboardCheck,
  FileText,
  Fuel,
  MapPinned,
  ShieldCheck,
  Trophy,
  Wrench,
  type LucideIcon,
} from "lucide-react";

type DashboardProps = {
  vehicleCount: number;
  activeTrips: number;
  fuelCostTotal: string;
  maintenance: Maintenance[];
  vehicles: Vehicle[];
  driverScores: DriverScore[];
  serviceBookings: ServiceBooking[];
  topPerformers: Array<{ driverId: string; driverName: string; score: number }>;
  maintenancePredictionMap: Record<string, MaintenancePrediction>;
  liveTrips: LiveTrip[];
  alerts: { title: string; meta: string }[];
  upcomingDocs: { id: string; doc_type: string; expiry_date?: string }[];
};

function formatCompactDateTime(value?: string) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type DashboardIconName = "fleet" | "trips" | "service" | "fuel";

function DashboardIcon({ name }: { name: DashboardIconName }) {
  const icons: Record<DashboardIconName, LucideIcon> = {
    fleet: Car,
    trips: MapPinned,
    service: Wrench,
    fuel: Fuel,
  };
  const Icon = icons[name];
  return <Icon aria-hidden="true" />;
}

export default function Dashboard({
  vehicleCount,
  activeTrips,
  fuelCostTotal,
  maintenance,
  vehicles,
  driverScores,
  serviceBookings,
  topPerformers,
  maintenancePredictionMap,
  liveTrips,
  alerts,
  upcomingDocs,
}: DashboardProps) {
  const vehiclesInMaintenance = useMemo(
    () => vehicles.filter((vehicle) => (vehicle.status || "").toLowerCase() === "maintenance").slice(0, 4),
    [vehicles]
  );
  const pendingApprovals = useMemo(
    () =>
      serviceBookings
        .filter(
          (booking) =>
            (booking.status || "pending") === "completed" &&
            (booking.completion_review_status || "pending") !== "approved"
        )
        .slice(0, 4),
    [serviceBookings]
  );
  const highRiskVehicles = useMemo(
    () =>
      Object.values(maintenancePredictionMap)
        .filter((prediction) => prediction.risk_level === "high" || prediction.risk_level === "medium")
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 4),
    [maintenancePredictionMap]
  );
  const upcomingMaintenance = useMemo(() => {
    return maintenance
      .filter((record) => typeof record.next_service_due_km === "number")
      .sort((a, b) => (a.next_service_due_km || 0) - (b.next_service_due_km || 0))
      .slice(0, 4);
  }, [maintenance]);
  const performanceBuckets = useMemo(() => {
    const latestByDriver = new Map<string, DriverScore>();
    for (const row of driverScores) {
      if (!latestByDriver.has(row.driver_id)) {
        latestByDriver.set(row.driver_id, row);
      }
    }
    const buckets = { excellent: 0, good: 0, average: 0, needsWork: 0 };
    Array.from(latestByDriver.values()).forEach((driver) => {
      if (driver.overall_score >= 85) buckets.excellent += 1;
      else if (driver.overall_score >= 70) buckets.good += 1;
      else if (driver.overall_score >= 55) buckets.average += 1;
      else buckets.needsWork += 1;
    });
    return buckets;
  }, [driverScores]);
  const totalScoredDrivers =
    performanceBuckets.excellent +
    performanceBuckets.good +
    performanceBuckets.average +
    performanceBuckets.needsWork;
  const donutStyle =
    totalScoredDrivers > 0
      ? {
          background: `conic-gradient(
            var(--success) 0 ${(performanceBuckets.excellent / totalScoredDrivers) * 100}%,
            #10b981 ${(performanceBuckets.excellent / totalScoredDrivers) * 100}% ${((performanceBuckets.excellent + performanceBuckets.good) / totalScoredDrivers) * 100}%,
            var(--warning) ${((performanceBuckets.excellent + performanceBuckets.good) / totalScoredDrivers) * 100}% ${((performanceBuckets.excellent + performanceBuckets.good + performanceBuckets.average) / totalScoredDrivers) * 100}%,
            var(--danger) ${((performanceBuckets.excellent + performanceBuckets.good + performanceBuckets.average) / totalScoredDrivers) * 100}% 100%
          )`,
        }
      : undefined;

  return (
    <>
      <section className="stats">
        <div className="stat-card stat-card--blue">
          <div className="stat-card__top">
            <div className="stat-icon"><DashboardIcon name="fleet" /></div>
            <span className="stat-badge stat-badge--steady">Fleet</span>
          </div>
          <div className="stat-value">{vehicleCount}</div>
          <div className="stat-label">Total Vehicles</div>
          <div className="stat-sub">All active in fleet</div>
        </div>
        <div className="stat-card stat-card--green">
          <div className="stat-card__top">
            <div className="stat-icon"><DashboardIcon name="trips" /></div>
            <span className="stat-badge stat-badge--live">Live</span>
          </div>
          <div className="stat-value">{activeTrips}</div>
          <div className="stat-label">Active Trips</div>
          <div className="stat-sub">Driver-tracked sessions</div>
        </div>
        <div className="stat-card stat-card--amber">
          <div className="stat-card__top">
            <div className="stat-icon"><DashboardIcon name="service" /></div>
            <span className="stat-badge stat-badge--watch">Due</span>
          </div>
          <div className="stat-value">{upcomingMaintenance.length}</div>
          <div className="stat-label">Upcoming Maintenance</div>
          <div className="stat-sub">Due today or later</div>
        </div>
        <div className="stat-card stat-card--purple">
          <div className="stat-card__top">
            <div className="stat-icon"><DashboardIcon name="fuel" /></div>
            <span className="stat-badge stat-badge--cost">Cost</span>
          </div>
          <div className="stat-value">{fuelCostTotal}</div>
          <div className="stat-label">Fuel Costs</div>
          <div className="stat-sub">Total logged</div>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-section-heading">
          <span className="dashboard-section-heading__eyebrow">Operational Monitoring</span>
          <h2>Live fleet activity</h2>
        </div>
        <div className="card card--map">
          <div className="card__header">
            <div>
              <h2><Activity aria-hidden="true" /> Live Trip Map</h2>
              <p className="muted dashboard-map__subtitle">Track currently active vehicles and the freshness of location updates.</p>
            </div>
            <span className="pill">{liveTrips.length} tracked</span>
          </div>
          <MapView trips={liveTrips} />
        </div>

        <div className="card dashboard-actions-card">
          <div className="card__header">
            <h2><ClipboardCheck aria-hidden="true" /> Quick Actions</h2>
          </div>
          <div className="quick-actions">
            <Link className="dashboard-action" to="/management">
              <span><Car aria-hidden="true" /></span>
              <strong>Add Vehicle</strong>
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link className="dashboard-action" to="/maintenance">
              <span><Wrench aria-hidden="true" /></span>
              <strong>Log Maintenance</strong>
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link className="dashboard-action" to="/maintenance">
              <span><CalendarClock aria-hidden="true" /></span>
              <strong>Book Service</strong>
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link className="dashboard-action" to="/ml">
              <span><Bot aria-hidden="true" /></span>
              <strong>Run ML Check</strong>
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="card__header">
            <h2><Trophy aria-hidden="true" /> Top Driver Scores</h2>
          </div>
          {topPerformers.length === 0 ? (
            <p className="empty">No driver score snapshots available yet.</p>
          ) : (
            <>
              <div className="donut" style={donutStyle}>
                <div className="donut__center">{totalScoredDrivers}</div>
              </div>
              <div className="legend">
                <span className="legend__item legend__item--good">Excellent {performanceBuckets.excellent}</span>
                <span className="legend__item legend__item--live">Good {performanceBuckets.good}</span>
                <span className="legend__item legend__item--avg">Average {performanceBuckets.average}</span>
                <span className="legend__item legend__item--poor">Needs work {performanceBuckets.needsWork}</span>
              </div>
            </>
          )}
        </div>

        <Link className="card card--link-panel" to="/maintenance#booking-workflow">
          <div className="card__header">
            <h2><ClipboardCheck aria-hidden="true" /> Pending Service Approvals</h2>
            <ArrowRight aria-hidden="true" className="card__header-action" />
          </div>
          {pendingApprovals.length === 0 ? (
            <p className="empty">No completed service bookings waiting for review.</p>
          ) : (
            <ul className="list">
              {pendingApprovals.map((booking) => {
                const vehicle = vehicles.find((item) => item.id === booking.vehicle_id);
                return (
                  <li key={booking.id}>
                    <div className="list__title">{vehicle?.plate_no || "Vehicle"} awaiting review</div>
                    <div className="list__meta">Completed {formatCompactDateTime(booking.completed_at || booking.requested_date)}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </Link>

        <div className="dashboard-section-heading dashboard-section-heading--spaced">
          <span className="dashboard-section-heading__eyebrow">Exceptions & Attention</span>
          <h2>Items that need review</h2>
        </div>

        <div className="card">
          <div className="card__header">
            <h2><Wrench aria-hidden="true" /> Upcoming Maintenance</h2>
          </div>
          {upcomingMaintenance.length === 0 ? (
            <p className="empty">No upcoming maintenance scheduled</p>
          ) : (
            <ul className="list">
              {upcomingMaintenance.map((record) => {
                const vehicle = vehicles.find((item) => item.id === record.vehicle_id);
                return (
                  <li key={record.id}>
                    <div className="list__title">
                      {vehicle?.plate_no || "Vehicle"} • {record.service_type || "Service"}
                    </div>
                    <div className="list__meta">
                      Next due at {typeof record.next_service_due_km === "number" ? `${record.next_service_due_km.toLocaleString()} km` : "--"}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="card__header">
            <h2><FileText aria-hidden="true" /> Expiring Documents</h2>
          </div>
          {upcomingDocs.length === 0 ? (
            <p className="empty">All documents up to date</p>
          ) : (
            <ul className="list">
              {upcomingDocs.slice(0, 3).map((d) => (
                <li key={d.id}>
                  <div className="list__title">{d.doc_type}</div>
                  <div className="list__meta">{d.expiry_date || "No date"}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="card__header">
            <h2><ShieldCheck aria-hidden="true" /> Vehicles in Maintenance</h2>
          </div>
          {vehiclesInMaintenance.length === 0 ? (
            <p className="empty">No vehicles are currently in maintenance mode.</p>
          ) : (
            <ul className="list">
              {vehiclesInMaintenance.map((vehicle) => (
                <li key={vehicle.id}>
                  <div className="list__title">{vehicle.plate_no}</div>
                  <div className="list__meta">
                    {[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle in maintenance"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="card__header">
            <h2><AlertTriangle aria-hidden="true" /> High Maintenance Risk</h2>
          </div>
          {highRiskVehicles.length === 0 ? (
            <p className="empty">No recent maintenance risk results yet.</p>
          ) : (
            <ul className="list">
              {highRiskVehicles.map((prediction) => {
                const vehicle = vehicles.find((item) => item.id === prediction.vehicle_id);
                return (
                  <li key={prediction.id}>
                    <div className="list__title">{vehicle?.plate_no || "Vehicle"}</div>
                    <div className="list__meta">
                      {prediction.risk_level} risk • {(prediction.probability * 100).toFixed(1)}%
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="card__header">
            <h2><AlertTriangle aria-hidden="true" /> Recent Alerts</h2>
            {alerts.length > 0 && (
              <span className="pill pill--warning">{alerts.length}</span>
            )}
          </div>
          {alerts.length === 0 ? (
            <p className="empty">No active alerts</p>
          ) : (
            <ul className="list">
              {alerts.slice(0, 4).map((a, idx) => (
                <li key={idx}>
                  <div className="list__title">{a.title}</div>
                  <div className="list__meta">{a.meta}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
