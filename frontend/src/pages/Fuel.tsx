import { FormEvent } from "react";

type Vehicle = {
  id: string;
  plate_no: string;
};

type FuelLog = {
  id: string;
  fuel_date: string;
  liters: number;
  cost_lkr?: number;
};

type FuelProps = {
  vehicles: Vehicle[];
  fuelLogs: FuelLog[];
  loading: boolean;
  fuelVehicle: string;
  setFuelVehicle: (v: string) => void;
  fuelDate: string;
  setFuelDate: (v: string) => void;
  fuelLiters: string;
  setFuelLiters: (v: string) => void;
  fuelCost: string;
  setFuelCost: (v: string) => void;
  fuelOdometer: string;
  setFuelOdometer: (v: string) => void;
  fuelVendor: string;
  setFuelVendor: (v: string) => void;
  onAddFuel: (e: FormEvent) => void;
};

export default function Fuel(props: FuelProps) {
  const totalLiters = props.fuelLogs.reduce((sum, f) => sum + f.liters, 0);
  const totalCost = props.fuelLogs.reduce((sum, f) => sum + (f.cost_lkr || 0), 0);

  return (
    <section className="section">
      <div className="stats" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: "24px" }}>
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-value">{props.fuelLogs.length}</div>
          <div className="stat-label">Total Entries</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⛽</div>
          <div className="stat-value">{totalLiters.toFixed(0)}L</div>
          <div className="stat-label">Total Fuel</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-value">Rs.{totalCost.toLocaleString()}</div>
          <div className="stat-label">Total Cost</div>
        </div>
      </div>

      <div className="grid">
        <section className="card">
          <div className="card__header">
            <h3>⛽ Log Fuel Purchase</h3>
          </div>
          <form className="form" onSubmit={props.onAddFuel}>
            <label>
              Vehicle
              <select
                value={props.fuelVehicle}
                onChange={(e) => props.setFuelVehicle(e.target.value)}
                required
              >
                <option value="">Select a vehicle</option>
                {props.vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate_no}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fuel Date
              <input
                type="date"
                value={props.fuelDate}
                onChange={(e) => props.setFuelDate(e.target.value)}
                required
              />
            </label>
            <label>
              Liters
              <input
                type="number"
                placeholder="e.g., 45"
                value={props.fuelLiters}
                onChange={(e) => props.setFuelLiters(e.target.value)}
                required
              />
            </label>
            <label>
              Cost (LKR)
              <input
                type="number"
                placeholder="e.g., 15000"
                value={props.fuelCost}
                onChange={(e) => props.setFuelCost(e.target.value)}
              />
            </label>
            <label>
              Odometer (km)
              <input
                type="number"
                placeholder="Current reading"
                value={props.fuelOdometer}
                onChange={(e) => props.setFuelOdometer(e.target.value)}
              />
            </label>
            <label>
              Vendor / Station
              <input
                placeholder="e.g., Lanka IOC, Colombo"
                value={props.fuelVendor}
                onChange={(e) => props.setFuelVendor(e.target.value)}
              />
            </label>
            <button className="btn" type="submit" disabled={props.loading}>
              {props.loading ? "Saving..." : "+ Add Fuel Log"}
            </button>
          </form>
        </section>

        <section className="card">
          <div className="card__header">
            <h3>📋 Recent Fuel Logs</h3>
            {props.fuelLogs.length > 0 && (
              <span className="pill">{props.fuelLogs.length}</span>
            )}
          </div>
          {props.fuelLogs.length === 0 ? (
            <p className="empty">No fuel logs recorded yet. Add your first entry above.</p>
          ) : (
            <ul className="list">
              {props.fuelLogs.slice(0, 8).map((f) => (
                <li key={f.id}>
                  <div className="list__title">{f.fuel_date}</div>
                  <div className="list__meta">
                    {f.liters}L • {f.cost_lkr ? `Rs.${f.cost_lkr.toLocaleString()}` : "Cost not recorded"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
