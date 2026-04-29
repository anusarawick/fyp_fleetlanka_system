import { FormEvent, useEffect, useMemo, useState } from "react";
import { BarChart3, CircleDollarSign, ClipboardList, Eye, Fuel as FuelIconGlyph, Pencil, Trash2, TrendingUp, type LucideIcon } from "lucide-react";

type Vehicle = {
  id: string;
  plate_no: string;
};

type FuelLog = {
  id: string;
  vehicle_id: string;
  fuel_date: string;
  liters: number;
  cost_lkr?: number;
  odometer_km?: number;
  vendor?: string;
};

type FuelForecast = {
  vehicle_id: string;
  plate_no: string;
  forecast_liters_7d: number;
};

type FuelProps = {
  vehicles: Vehicle[];
  fuelLogs: FuelLog[];
  fuelForecasts: FuelForecast[];
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
  editingFuelId: string | null;
  onExportFuel: () => void;
  onAddFuel: (e: FormEvent) => void;
  onEditFuel: (fuelLog: FuelLog) => void;
  onCancelFuelEdit: () => void;
  onDeleteFuel: (fuelId: string) => Promise<void>;
};

type FuelTab = "overview" | "forecast" | "register";

type FuelIconName = "logs" | "volume" | "cost" | "trend" | "demand";

function FuelIcon({ name }: { name: FuelIconName }) {
  const icons: Record<FuelIconName, LucideIcon> = {
    logs: ClipboardList,
    volume: FuelIconGlyph,
    cost: CircleDollarSign,
    trend: TrendingUp,
    demand: BarChart3,
  };
  const Icon = icons[name];
  return <Icon aria-hidden="true" />;
}

export default function Fuel(props: FuelProps) {
  const [activeTab, setActiveTab] = useState<FuelTab>("overview");
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [selectedFuelLog, setSelectedFuelLog] = useState<FuelLog | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FuelLog | null>(null);
  const [fuelSearch, setFuelSearch] = useState("");
  const [fuelRowsPerPage, setFuelRowsPerPage] = useState(10);
  const [fuelPage, setFuelPage] = useState(1);

  const totalLiters = props.fuelLogs.reduce((sum, f) => sum + f.liters, 0);
  const totalCost = props.fuelLogs.reduce((sum, f) => sum + (f.cost_lkr || 0), 0);
  const avgCostPerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;
  const projectedFuelDemand = props.fuelForecasts.reduce(
    (sum, row) => sum + row.forecast_liters_7d,
    0
  );

  const vehicleLabelMap = useMemo(
    () =>
      props.vehicles.reduce<Record<string, string>>((acc, vehicle) => {
        acc[vehicle.id] = vehicle.plate_no;
        return acc;
      }, {}),
    [props.vehicles]
  );

  const filteredFuelLogs = props.fuelLogs.filter((log) => {
    const query = fuelSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      log.fuel_date,
      log.vendor,
      vehicleLabelMap[log.vehicle_id] || "",
      String(log.liters),
      typeof log.cost_lkr === "number" ? String(log.cost_lkr) : "",
      typeof log.odometer_km === "number" ? String(log.odometer_km) : "",
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const fuelTotalPages = Math.max(1, Math.ceil(filteredFuelLogs.length / fuelRowsPerPage));
  const currentFuelPage = Math.min(fuelPage, fuelTotalPages);
  const paginatedFuelLogs = filteredFuelLogs.slice(
    (currentFuelPage - 1) * fuelRowsPerPage,
    currentFuelPage * fuelRowsPerPage
  );

  useEffect(() => {
    setFuelPage(1);
  }, [fuelRowsPerPage, fuelSearch, props.fuelLogs.length]);

  useEffect(() => {
    if (!props.loading) {
      setShowFuelModal(false);
    }
  }, [props.loading]);

  const fuelByDate = props.fuelLogs.reduce<Record<string, number>>((acc, f) => {
    acc[f.fuel_date] = (acc[f.fuel_date] || 0) + f.liters;
    return acc;
  }, {});
  const fuelSeries = Object.entries(fuelByDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-7);
  const maxFuel = fuelSeries.reduce((m, [, v]) => Math.max(m, v), 1);
  const demandWeights =
    fuelSeries.length > 0
      ? fuelSeries.map(([, value]) => value)
      : Array.from({ length: 7 }, () => 1);
  const demandWeightTotal =
    demandWeights.reduce((sum, value) => sum + value, 0) || 1;
  const futureDemandSeries = Array.from({ length: 7 }, (_, index) => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + index + 1);
    const weight = demandWeights[index % demandWeights.length] / demandWeightTotal;
    return [
      futureDate.toISOString().slice(0, 10),
      projectedFuelDemand * weight,
    ] as const;
  });
  const maxFuelDemand = futureDemandSeries.reduce(
    (m, [, value]) => Math.max(m, value),
    1
  );
  const vehicleFuelDemand = [...props.fuelForecasts]
    .sort((a, b) => b.forecast_liters_7d - a.forecast_liters_7d)
    .slice(0, 8);
  const topDemandVehicle = vehicleFuelDemand[0] || null;

  function closeFuelModal() {
    setShowFuelModal(false);
    if (props.editingFuelId) {
      props.onCancelFuelEdit();
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await props.onDeleteFuel(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <section className="section">
      <section className="analytics-page">
      <div className="stats stats--three analytics-stats">
        <div className="stat-card stat-card--blue">
          <div className="stat-icon"><FuelIcon name="logs" /></div>
          <div className="stat-value">{props.fuelLogs.length}</div>
          <div className="stat-label">Fuel Entries</div>
          <div className="stat-sub">Recorded transactions</div>
        </div>
        <div className="stat-card stat-card--green">
          <div className="stat-icon"><FuelIcon name="volume" /></div>
          <div className="stat-value">{totalLiters.toFixed(0)}L</div>
          <div className="stat-label">Total Fuel</div>
          <div className="stat-sub">Logged consumption</div>
        </div>
        <div className="stat-card stat-card--purple">
          <div className="stat-icon"><FuelIcon name="cost" /></div>
          <div className="stat-value">{avgCostPerLiter > 0 ? avgCostPerLiter.toFixed(0) : "0"}</div>
          <div className="stat-label">Avg Cost / Liter</div>
          <div className="stat-sub">Spend efficiency</div>
        </div>
      </div>

      <nav className="admin-tabs" aria-label="Fuel sections">
        <button
          type="button"
          className={`admin-tab ${activeTab === "overview" ? "admin-tab--active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === "forecast" ? "admin-tab--active" : ""}`}
          onClick={() => setActiveTab("forecast")}
        >
          Forecast
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === "register" ? "admin-tab--active" : ""}`}
          onClick={() => setActiveTab("register")}
        >
          Register
        </button>
      </nav>

      {activeTab === "overview" && (
      <div className="grid analytics-grid">
        <section className="card analytics-card--support">
          <div className="card__header">
            <div>
              <h3>Fuel Actions</h3>
              <p className="muted analytics-card__subtitle">Log and manage operational fuel entries from one place.</p>
            </div>
          </div>
          <div className="admin-action-buttons">
            <button
              className="btn"
              type="button"
              onClick={() => {
                props.onCancelFuelEdit();
                setShowFuelModal(true);
              }}
            >
              + Add Fuel Log
            </button>
          </div>
        </section>

        <section className="card analytics-card--support">
          <div className="card__header">
            <div>
              <h3>Demand Summary</h3>
              <p className="muted analytics-card__subtitle">Current 7-day fuel outlook across the fleet.</p>
            </div>
          </div>
          <ul className="list">
            <li>
              <div className="list__title">Projected Total</div>
              <div className="list__meta">{projectedFuelDemand.toFixed(1)} L forecast for the next 7 days</div>
            </li>
            <li>
              <div className="list__title">Highest Demand Vehicle</div>
              <div className="list__meta">
                {topDemandVehicle
                  ? `${topDemandVehicle.plate_no} • ${topDemandVehicle.forecast_liters_7d.toFixed(1)} L`
                  : "No forecast available yet"}
              </div>
            </li>
          </ul>
        </section>

        <section className="card analytics-card--support">
          <div className="card__header">
            <div>
              <h3>Register Snapshot</h3>
              <p className="muted analytics-card__subtitle">Recent logging activity and register readiness.</p>
            </div>
          </div>
          <ul className="list">
            <li>
              <div className="list__title">Filtered Register</div>
              <div className="list__meta">{filteredFuelLogs.length} logs currently available in the active register dataset</div>
            </li>
            <li>
              <div className="list__title">Most Recent Entry</div>
              <div className="list__meta">
                {props.fuelLogs[0]
                  ? `${vehicleLabelMap[props.fuelLogs[0].vehicle_id] || "Vehicle"} • ${props.fuelLogs[0].fuel_date}`
                  : "No fuel logs recorded yet"}
              </div>
            </li>
          </ul>
        </section>
      </div>
      )}

      {activeTab === "forecast" && (
      <div className="grid analytics-grid">
        <section className="card analytics-card--wide">
          <div className="card__header">
            <div>
              <h3>Fuel Trend (last 7 days)</h3>
              <p className="muted analytics-card__subtitle">Daily fuel usage across the fleet over the last 7 days.</p>
            </div>
          </div>
          {fuelSeries.length === 0 ? (
            <p className="muted empty">No fuel data to plot.</p>
          ) : (
            <div className="bar-chart">
              {fuelSeries.map(([date, value]) => (
                <div key={date} className="bar">
                  <div className="bar__track">
                    <div
                      className="bar__fill"
                      style={{ height: `${(value / maxFuel) * 100}%` }}
                    />
                  </div>
                  <div className="bar__meta">
                    <div className="bar__label">{date.slice(5)}</div>
                    <div className="bar__value">{value.toFixed(1)}L</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card analytics-card--wide">
          <div className="card__header">
            <div>
              <h3>Projected Fuel Demand (next 7 days)</h3>
              <p className="muted analytics-card__subtitle">Projected day-by-day fuel demand based on the current weekly forecast.</p>
            </div>
          </div>
          {props.fuelForecasts.length === 0 ? (
            <p className="muted empty">No fuel forecast available yet.</p>
          ) : (
            <div className="bar-chart">
              {futureDemandSeries.map(([date, value]) => (
                <div key={date} className="bar">
                  <div className="bar__track">
                    <div
                      className="bar__fill bar__fill--demand"
                      style={{ height: `${(value / maxFuelDemand) * 100}%` }}
                    />
                  </div>
                  <div className="bar__meta">
                    <div className="bar__label">{date.slice(5)}</div>
                    <div className="bar__value">{value.toFixed(1)}L</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card analytics-card--support">
          <div className="card__header">
            <div>
              <h3>Vehicle-wise Fuel Demand</h3>
              <p className="muted analytics-card__subtitle">Highest predicted vehicle demand over the next 7 days.</p>
            </div>
          </div>
          {vehicleFuelDemand.length === 0 ? (
            <p className="empty">No vehicle fuel forecast available yet.</p>
          ) : (
            <ul className="list">
              {vehicleFuelDemand.map((forecast) => (
                <li key={forecast.vehicle_id}>
                  <div className="list__title">{forecast.plate_no}</div>
                  <div className="list__meta">
                    {forecast.forecast_liters_7d.toFixed(1)} L next 7 days
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      )}

      {activeTab === "register" && (
      <div className="grid analytics-grid">
        <section className="card analytics-card--support">
          <div className="card__header">
            <div>
              <h3>Recent Activity</h3>
              <p className="muted analytics-card__subtitle">Latest recorded fuel logs for quick review.</p>
            </div>
            <div className="analytics-card__actions">
              <button className="btn btn--secondary" onClick={props.onExportFuel}>
                Export CSV
              </button>
            </div>
          </div>
          {props.fuelLogs.length === 0 ? (
            <p className="empty">No fuel logs recorded yet.</p>
          ) : (
            <ul className="list">
              {props.fuelLogs.slice(0, 4).map((log) => (
                <li key={log.id}>
                  <div className="list__title">
                    {vehicleLabelMap[log.vehicle_id] || "Vehicle"} • {log.fuel_date}
                  </div>
                  <div className="list__meta">
                    {log.liters}L • {log.cost_lkr ? `Rs.${log.cost_lkr.toLocaleString()}` : "Cost not recorded"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

      <section className="card analytics-register analytics-card--wide">
        <div className="card__header">
          <div>
            <h3>Fuel Register</h3>
            <p className="muted analytics-card__subtitle">Search, review, edit, and export the full fuel log history.</p>
          </div>
        </div>
        {props.fuelLogs.length === 0 ? (
          <p className="empty">No fuel logs recorded yet.</p>
        ) : (
          <>
            <div className="table-controls">
              <div className="table-controls__filters">
                <label className="table-controls__label table-controls__label--search">
                  Search
                  <input
                    type="search"
                    placeholder="Date, vehicle, vendor..."
                    value={fuelSearch}
                    onChange={(e) => setFuelSearch(e.target.value)}
                  />
                </label>
                <label className="table-controls__label">
                  Rows
                  <select
                    value={fuelRowsPerPage}
                    onChange={(e) => setFuelRowsPerPage(Number(e.target.value))}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>
              <div className="table-pagination">
                <span className="table-pagination__meta">
                  Page {currentFuelPage} of {fuelTotalPages}
                </span>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setFuelPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentFuelPage === 1}
                >
                  Prev
                </button>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setFuelPage((prev) => Math.min(fuelTotalPages, prev + 1))}
                  disabled={currentFuelPage === fuelTotalPages}
                >
                  Next
                </button>
              </div>
            </div>
            {filteredFuelLogs.length === 0 ? (
              <p className="empty">No fuel logs match the current search.</p>
            ) : (
              <div className="table fuel-table" style={{ ["--table-columns" as any]: 6 }}>
                <div className="table__head fuel-table__head">
                  <span>Date</span>
                  <span>Vehicle</span>
                  <span>Liters</span>
                  <span>Cost</span>
                  <span>Vendor</span>
                  <span>Actions</span>
                </div>
                {paginatedFuelLogs.map((log) => (
                  <div className="table__row fuel-table__row" key={log.id}>
                    <span data-label="Date">{log.fuel_date}</span>
                    <span data-label="Vehicle">{vehicleLabelMap[log.vehicle_id] || "--"}</span>
                    <span data-label="Liters">{log.liters}L</span>
                    <span data-label="Cost">{log.cost_lkr ? `Rs.${log.cost_lkr.toLocaleString()}` : "--"}</span>
                    <span data-label="Vendor">{log.vendor || "--"}</span>
                    <span className="table__actions fuel-table__actions" data-label="Actions">
                      <button
                        className="icon-action"
                        type="button"
                        onClick={() => setSelectedFuelLog(log)}
                        aria-label={`View fuel log ${log.id}`}
                        title="View fuel log"
                      >
                        <Eye className="icon-action__svg icon-action__svg--view" aria-hidden="true" />
                      </button>
                      <button
                        className="icon-action"
                        type="button"
                        onClick={() => {
                          props.onEditFuel(log);
                          setShowFuelModal(true);
                        }}
                        aria-label={`Edit fuel log ${log.id}`}
                        title="Edit fuel log"
                      >
                        <Pencil className="icon-action__svg icon-action__svg--edit" aria-hidden="true" />
                      </button>
                      <button
                        className="icon-action icon-action--danger"
                        type="button"
                        onClick={() => setDeleteTarget(log)}
                        aria-label={`Delete fuel log ${log.id}`}
                        title="Delete fuel log"
                        disabled={props.loading}
                      >
                        <Trash2 className="icon-action__svg icon-action__svg--delete" aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
      </div>
      )}
      </section>

      {showFuelModal && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--form" role="dialog" aria-modal="true" aria-label="Fuel log form">
            <div className="modal__header">
              <div>
                <h3>{props.editingFuelId ? "Edit Fuel Log" : "Log Fuel Purchase"}</h3>
                <p className="modal__subtle">
                  {props.editingFuelId
                    ? "Update liters, cost, odometer, and vendor details."
                    : "Capture liters, cost, odometer, and vendor details."}
                </p>
              </div>
              <button className="modal__close" type="button" onClick={closeFuelModal} aria-label="Close fuel form">
                ✕
              </button>
            </div>
            <form id="fuel-form" className="form form--two-col form--scroll" onSubmit={props.onAddFuel}>
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
            </form>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={closeFuelModal}>
                Cancel
              </button>
              <button className="btn" type="submit" form="fuel-form" disabled={props.loading}>
                {props.loading ? "Saving..." : props.editingFuelId ? "Save Changes" : "Add Fuel Log"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedFuelLog && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Fuel log details">
            <div className="modal__header">
              <div>
                <h3>Fuel Log Details</h3>
                <p className="modal__subtle">Read-only view of the selected fuel entry.</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setSelectedFuelLog(null)} aria-label="Close fuel details">
                ✕
              </button>
            </div>
            <div className="details-grid">
              <div className="detail-item"><span>Date</span><strong>{selectedFuelLog.fuel_date}</strong></div>
              <div className="detail-item"><span>Vehicle</span><strong>{vehicleLabelMap[selectedFuelLog.vehicle_id] || "--"}</strong></div>
              <div className="detail-item"><span>Liters</span><strong>{selectedFuelLog.liters}L</strong></div>
              <div className="detail-item"><span>Cost</span><strong>{selectedFuelLog.cost_lkr ? `Rs.${selectedFuelLog.cost_lkr.toLocaleString()}` : "--"}</strong></div>
              <div className="detail-item"><span>Odometer</span><strong>{selectedFuelLog.odometer_km ?? "--"}</strong></div>
              <div className="detail-item"><span>Vendor</span><strong>{selectedFuelLog.vendor || "--"}</strong></div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Confirm delete">
            <div className="modal__header">
              <h3>Delete Fuel Log?</h3>
              <button className="modal__close" type="button" onClick={() => setDeleteTarget(null)} aria-label="Close delete dialog">
                ✕
              </button>
            </div>
            <p className="muted">
              Are you sure you want to delete this fuel log for <strong>{vehicleLabelMap[deleteTarget.vehicle_id] || "Vehicle"}</strong>? This action cannot be undone.
            </p>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="btn btn--danger" type="button" onClick={confirmDelete} disabled={props.loading}>
                {props.loading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
