import { useMemo, useState } from "react";
import MapView from "../components/MapView";
import { DriverScore, LiveTrip, Maintenance, MaintenancePrediction, ServiceBooking, Vehicle } from "../types";
import { Link } from "react-router-dom";

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

type LiveTripFilter = "all" | "live" | "stale";

function formatDateTime(value?: string) {
  if (!value) return "Unavailable";
  return new Date(value).toLocaleString();
}

function formatTime(value?: string) {
  if (!value) return "Unavailable";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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
  const [liveTripFilter, setLiveTripFilter] = useState<LiveTripFilter>("all");

  const filteredLiveTrips = useMemo(() => {
    if (liveTripFilter === "live") return liveTrips.filter((trip) => !trip.stale);
    if (liveTripFilter === "stale") return liveTrips.filter((trip) => trip.stale);
    return liveTrips;
  }, [liveTripFilter, liveTrips]);

  const liveCount = liveTrips.filter((trip) => !trip.stale).length;
  const staleCount = liveTrips.filter((trip) => trip.stale).length;
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
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return maintenance
      .map((record) => {
        const dueDate = record.predicted_due_date;
        const dueTime = dueDate ? new Date(dueDate).getTime() : Number.NaN;
        return { record, dueDate, dueTime };
      })
      .filter(({ dueDate, dueTime }) => Boolean(dueDate) && Number.isFinite(dueTime) && dueTime >= now.getTime())
      .sort((a, b) => a.dueTime - b.dueTime)
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
          <div className="stat-icon">🚚</div>
          <div className="stat-value">{vehicleCount}</div>
          <div className="stat-label">Total Vehicles</div>
          <div className="stat-sub">All active in fleet</div>
        </div>
        <div className="stat-card stat-card--green">
          <div className="stat-icon">🧭</div>
          <div className="stat-value">{activeTrips}</div>
          <div className="stat-label">Active Trips</div>
          <div className="stat-sub">Driver-tracked sessions</div>
        </div>
        <div className="stat-card stat-card--amber">
          <div className="stat-icon">🔧</div>
          <div className="stat-value">{upcomingMaintenance.length}</div>
          <div className="stat-label">Upcoming Maintenance</div>
          <div className="stat-sub">Due today or later</div>
        </div>
        <div className="stat-card stat-card--purple">
          <div className="stat-icon">⛽</div>
          <div className="stat-value">{fuelCostTotal}</div>
          <div className="stat-label">Fuel Costs</div>
          <div className="stat-sub">Total logged</div>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="card card--map">
          <div className="card__header">
            <div>
              <h2>Live Trip Map</h2>
            </div>
            <span className="pill">{filteredLiveTrips.length} shown</span>
          </div>

          <div className="dashboard-map__filters">
            <button
              className={`filter-chip ${liveTripFilter === "all" ? "filter-chip--active" : ""}`}
              type="button"
              onClick={() => setLiveTripFilter("all")}
            >
              All ({liveTrips.length})
            </button>
            <button
              className={`filter-chip ${liveTripFilter === "live" ? "filter-chip--active" : ""}`}
              type="button"
              onClick={() => setLiveTripFilter("live")}
            >
              Live ({liveCount})
            </button>
            <button
              className={`filter-chip ${liveTripFilter === "stale" ? "filter-chip--active" : ""}`}
              type="button"
              onClick={() => setLiveTripFilter("stale")}
            >
              Stale ({staleCount})
            </button>
          </div>

          <MapView trips={filteredLiveTrips} />

          <div className="dashboard-map__list">
            <div className="dashboard-map__list-header">
              <h3>Active Trips</h3>
              <span className="muted">Last feed refresh: now</span>
            </div>
            {filteredLiveTrips.length === 0 ? (
              <p className="empty">No active tracked trips for the current filter.</p>
            ) : (
              <ul className="live-trip-list">
                {filteredLiveTrips.map((trip) => (
                  <li key={trip.trip_id} className="live-trip-item">
                    <div className="live-trip-item__main">
                      <div className="live-trip-item__title">
                        {trip.vehicle_plate_no || "Vehicle"}
                        <span className={`pill ${trip.stale ? "pill--warning" : "pill--success"}`}>
                          {trip.stale ? "Stale" : "Live"}
                        </span>
                      </div>
                      <div className="live-trip-item__meta">
                        {trip.vehicle_label || "Assigned vehicle"}
                        {trip.driver_name ? ` • ${trip.driver_name}` : ""}
                      </div>
                    </div>
                    <div className="live-trip-item__stats">
                      <span>Started {formatTime(trip.start_time)}</span>
                      <span>Updated {formatDateTime(trip.recorded_at)}</span>
                      <span>
                        {trip.speed_kmh !== undefined && trip.speed_kmh !== null
                          ? `${trip.speed_kmh.toFixed(1)} km/h`
                          : "Speed unavailable"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card__header">
            <h2>Top Driver Scores</h2>
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
            <h2>Pending Service Approvals</h2>
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

        <div className="card">
          <div className="card__header">
            <h2>Upcoming Maintenance</h2>
          </div>
          {upcomingMaintenance.length === 0 ? (
            <p className="empty">No upcoming maintenance scheduled</p>
          ) : (
            <ul className="list">
              {upcomingMaintenance.map(({ record, dueDate }) => {
                const vehicle = vehicles.find((item) => item.id === record.vehicle_id);
                return (
                  <li key={record.id}>
                    <div className="list__title">
                      {vehicle?.plate_no || "Vehicle"} • {record.service_type || "Service"}
                    </div>
                    <div className="list__meta">Due {dueDate}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="card__header">
            <h2>Expiring Documents</h2>
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
            <h2>Vehicles in Maintenance</h2>
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
            <h2>Quick Actions</h2>
          </div>
          <div className="quick-actions">
            <Link className="btn" to="/management">Add Vehicle</Link>
            <Link className="btn btn--secondary" to="/maintenance">Log Maintenance</Link>
            <Link className="btn btn--secondary" to="/maintenance">Book Service</Link>
            <Link className="btn btn--secondary" to="/ml">Run ML Check</Link>
          </div>
        </div>

        <div className="card">
          <div className="card__header">
            <h2>High Maintenance Risk</h2>
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
            <h2>Recent Alerts</h2>
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
