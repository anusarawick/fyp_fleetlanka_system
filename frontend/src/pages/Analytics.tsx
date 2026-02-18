type FuelLog = {
  id: string;
  fuel_date: string;
  liters: number;
  cost_lkr?: number;
  vehicle_id: string;
};

type MaintenanceRecord = {
  id: string;
  service_date: string;
  predicted_due_date?: string;
};

type AnalyticsProps = {
  fuelLogs: FuelLog[];
  maintenance: MaintenanceRecord[];
  vehicleCount: number;
  driverCount: number;
  activeTrips: number;
  onExportFuel: () => void;
  onExportMaintenance: () => void;
};

export default function Analytics(props: AnalyticsProps) {
  const fuelCostTotal = props.fuelLogs.reduce(
    (sum, f) => sum + (f.cost_lkr || 0),
    0
  );
  const fuelLitersTotal = props.fuelLogs.reduce((sum, f) => sum + f.liters, 0);
  const avgFuelPerVehicle =
    props.vehicleCount > 0 ? fuelLitersTotal / props.vehicleCount : 0;

  const upcomingMaintenance = props.maintenance.filter((m) => {
    if (!m.predicted_due_date) return false;
    const due = new Date(m.predicted_due_date).getTime();
    const now = new Date().getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return due >= now && due <= now + sevenDays;
  });

  const fuelByDate = props.fuelLogs.reduce<Record<string, number>>((acc, f) => {
    acc[f.fuel_date] = (acc[f.fuel_date] || 0) + f.liters;
    return acc;
  }, {});

  const fuelSeries = Object.entries(fuelByDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-7);

  const maxFuel = fuelSeries.reduce((m, [, v]) => Math.max(m, v), 1);

  return (
    <section className="section">
      <h2>Analytics</h2>
      <section className="stats">
        <div className="stat-card">
          <div className="stat-icon">⛽</div>
          <div className="stat-value">{fuelCostTotal.toFixed(0)}</div>
          <div className="stat-label">Fuel Cost (LKR)</div>
          <div className="stat-sub">Total logged</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-value">{avgFuelPerVehicle.toFixed(1)}</div>
          <div className="stat-label">Avg Fuel / Vehicle</div>
          <div className="stat-sub">Liters</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🧰</div>
          <div className="stat-value">{upcomingMaintenance.length}</div>
          <div className="stat-label">Maintenance Due (7d)</div>
          <div className="stat-sub">Upcoming</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🧑‍✈️</div>
          <div className="stat-value">{props.driverCount}</div>
          <div className="stat-label">Drivers</div>
          <div className="stat-sub">Registered</div>
        </div>
      </section>

      <div className="grid">
        <section className="card">
          <div className="card__header">
            <h3>Fuel Trend (last 7 days)</h3>
          </div>
          {fuelSeries.length === 0 ? (
            <p className="muted empty">No fuel data to plot.</p>
          ) : (
            <div className="bar-chart">
              {fuelSeries.map(([date, value]) => (
                <div key={date} className="bar">
                  <div
                    className="bar__fill"
                    style={{ height: `${(value / maxFuel) * 100}%` }}
                  />
                  <div className="bar__label">{date.slice(5)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="card">
          <div className="card__header">
            <h3>Fuel Logs (latest)</h3>
            <button className="btn btn--secondary" onClick={props.onExportFuel}>
              Export CSV
            </button>
          </div>
          {props.fuelLogs.length === 0 ? (
            <p className="muted empty">No fuel logs yet.</p>
          ) : (
            <ul className="list">
              {props.fuelLogs.slice(0, 8).map((f) => (
                <li key={f.id}>
                  <div className="list__title">{f.fuel_date}</div>
                  <div className="list__meta">
                    {f.liters} L • {f.cost_lkr || 0} LKR
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card__header">
            <h3>Maintenance Due Soon</h3>
            <button
              className="btn btn--secondary"
              onClick={props.onExportMaintenance}
            >
              Export CSV
            </button>
          </div>
          {upcomingMaintenance.length === 0 ? (
            <p className="muted empty">No upcoming maintenance.</p>
          ) : (
            <ul className="list">
              {upcomingMaintenance.slice(0, 8).map((m) => (
                <li key={m.id}>
                  <div className="list__title">{m.predicted_due_date}</div>
                  <div className="list__meta">Scheduled</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
