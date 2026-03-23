import { useMemo, useState } from "react";
import MapView from "../components/MapView";
import { LiveTrip } from "../types";

type DashboardProps = {
  vehicleCount: number;
  activeTrips: number;
  maintenanceCount: number;
  fuelCostTotal: string;
  maintenance: { id: string; service_type?: string; service_date: string }[];
  liveTrips: LiveTrip[];
  lastMaintenancePrediction: string | null;
  lastFuelPrediction: string | null;
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

export default function Dashboard({
  vehicleCount,
  activeTrips,
  maintenanceCount,
  fuelCostTotal,
  maintenance,
  liveTrips,
  lastMaintenancePrediction,
  lastFuelPrediction,
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
          <div className="stat-value">{maintenanceCount}</div>
          <div className="stat-label">Maintenance Due</div>
          <div className="stat-sub">Upcoming services</div>
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
              <p className="muted dashboard-map__subtitle">
                Shows only active trips reporting location from the driver app.
              </p>
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
            <h2>Driver Performance</h2>
          </div>
          <div className="donut">
            <div className="donut__center">Good</div>
          </div>
          <div className="legend">
            <span className="legend__item legend__item--good">Excellent</span>
            <span className="legend__item legend__item--avg">Average</span>
            <span className="legend__item legend__item--poor">Needs work</span>
          </div>
        </div>

        <div className="card">
          <div className="card__header">
            <h2>Upcoming Maintenance</h2>
          </div>
          {maintenance.length === 0 ? (
            <p className="empty">No upcoming maintenance scheduled</p>
          ) : (
            <ul className="list">
              {maintenance.slice(0, 3).map((m) => (
                <li key={m.id}>
                  <div className="list__title">{m.service_type || "Service"}</div>
                  <div className="list__meta">{m.service_date}</div>
                </li>
              ))}
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
            <h2>Recent Alerts</h2>
            {alerts.length > 0 && (
              <span className="pill pill--warning">{alerts.length}</span>
            )}
          </div>
          {alerts.length === 0 ? (
            <p className="empty">No active alerts</p>
          ) : (
            <ul className="list">
              {alerts.slice(0, 3).map((a, idx) => (
                <li key={idx}>
                  <div className="list__title">{a.title}</div>
                  <div className="list__meta">{a.meta}</div>
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
            <button className="btn">+ Add Vehicle</button>
            <button className="btn btn--secondary">Generate Report</button>
            <button className="btn btn--secondary">Schedule Service</button>
          </div>
        </div>

        <div className="card">
          <div className="card__header">
            <h2>ML Insights</h2>
            <span className="pill">AI</span>
          </div>
          <div className="list">
            <div>
              <div className="list__title">Maintenance Prediction</div>
              <div className="list__meta">
                {lastMaintenancePrediction || "Run prediction to see results"}
              </div>
            </div>
            <div>
              <div className="list__title">Fuel Prediction</div>
              <div className="list__meta">
                {lastFuelPrediction || "Run prediction to see results"}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
