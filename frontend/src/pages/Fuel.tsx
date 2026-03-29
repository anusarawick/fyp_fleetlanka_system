import { FormEvent, useEffect, useMemo, useState } from "react";

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
  editingFuelId: string | null;
  onAddFuel: (e: FormEvent) => void;
  onEditFuel: (fuelLog: FuelLog) => void;
  onCancelFuelEdit: () => void;
  onDeleteFuel: (fuelId: string) => Promise<void>;
};

export default function Fuel(props: FuelProps) {
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [selectedFuelLog, setSelectedFuelLog] = useState<FuelLog | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FuelLog | null>(null);
  const [fuelSearch, setFuelSearch] = useState("");
  const [fuelRowsPerPage, setFuelRowsPerPage] = useState(10);
  const [fuelPage, setFuelPage] = useState(1);

  const totalLiters = props.fuelLogs.reduce((sum, f) => sum + f.liters, 0);
  const totalCost = props.fuelLogs.reduce((sum, f) => sum + (f.cost_lkr || 0), 0);
  const avgCostPerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;

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
      <div className="stats" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: "24px" }}>
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-value">{props.fuelLogs.length}</div>
          <div className="stat-label">Fuel Entries</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⛽</div>
          <div className="stat-value">{totalLiters.toFixed(0)}L</div>
          <div className="stat-label">Total Fuel</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">Rs</div>
          <div className="stat-value">{avgCostPerLiter > 0 ? avgCostPerLiter.toFixed(0) : "0"}</div>
          <div className="stat-label">Avg Cost / Liter</div>
        </div>
      </div>

      <div className="grid">
        <section className="card">
          <div className="card__header">
            <h3>Fuel Actions</h3>
          </div>
          <p className="muted">Log purchases through a focused pop-up form and keep the register uncluttered.</p>
          <div className="button-row">
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

        <section className="card">
          <div className="card__header">
            <h3>Recent Activity</h3>
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
      </div>

      <section className="card" style={{ marginTop: "24px" }}>
        <div className="card__header">
          <h3>Fuel Register</h3>
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
                        <svg className="icon-action__svg icon-action__svg--view" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
                        </svg>
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
                        <svg className="icon-action__svg icon-action__svg--edit" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M4.5 19.5h3.75L18.75 9 15 5.25 4.5 15.75v3.75Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M13.5 6.75 17.25 10.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        className="icon-action icon-action--danger"
                        type="button"
                        onClick={() => setDeleteTarget(log)}
                        aria-label={`Delete fuel log ${log.id}`}
                        title="Delete fuel log"
                        disabled={props.loading}
                      >
                        <svg className="icon-action__svg icon-action__svg--delete" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M9.75 9.75v6.75M14.25 9.75v6.75M5.25 6.75h13.5M8.25 6.75V5.25A1.5 1.5 0 0 1 9.75 3.75h4.5a1.5 1.5 0 0 1 1.5 1.5v1.5m-9.75 0 .6 10.2A1.5 1.5 0 0 0 8.1 18.75h7.8a1.5 1.5 0 0 0 1.497-1.8l-.597-10.2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
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
