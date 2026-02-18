import MapView from "../components/MapView";

type DashboardProps = {
  vehicleCount: number;
  activeTrips: number;
  maintenanceCount: number;
  fuelCostTotal: string;
  maintenance: { id: string; service_type?: string; service_date: string }[];
  lastMaintenancePrediction: string | null;
  lastFuelPrediction: string | null;
  alerts: { title: string; meta: string }[];
  upcomingDocs: { id: string; doc_type: string; expiry_date?: string }[];
};

export default function Dashboard({
  vehicleCount,
  activeTrips,
  maintenanceCount,
  fuelCostTotal,
  maintenance,
  lastMaintenancePrediction,
  lastFuelPrediction,
  alerts,
  upcomingDocs,
}: DashboardProps) {
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
          <div className="stat-sub">Live GPS tracking</div>
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
            <h2>Fleet Activity Map</h2>
            <span className="pill">Live</span>
          </div>
          <MapView />
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
