import { FormEvent, useEffect, useState } from "react";

type Vehicle = {
  id: string;
  org_id?: string;
  plate_no: string;
  make?: string;
  model?: string;
  vehicle_type?: string;
  year?: number;
  status?: string;
  mileage?: number;
  odometer_km?: number;
  transmission_type?: string;
  engine_size_cc?: number;
  accident_history_count?: number;
  fuel_efficiency?: number;
  maintenance_history?: string;
  reported_issues_count?: number;
  tire_condition?: string;
  brake_condition?: string;
  battery_status?: string;
};

type MaintenancePrediction = {
  vehicle_id: string;
  probability: number;
  risk_level: "low" | "medium" | "high";
};

type ManagementProps = {
  vehicles: Vehicle[];
  maintenancePredictionMap: Record<string, MaintenancePrediction>;
  loading: boolean;
  plateNo: string;
  setPlateNo: (v: string) => void;
  make: string;
  setMake: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  vehicleType: string;
  setVehicleType: (v: string) => void;
  year: string;
  setYear: (v: string) => void;
  vehicleStatus: string;
  setVehicleStatus: (v: string) => void;
  vehicleMileage: string;
  setVehicleMileage: (v: string) => void;
  vehicleOdometer: string;
  setVehicleOdometer: (v: string) => void;
  transmissionType: string;
  setTransmissionType: (v: string) => void;
  engineSizeCc: string;
  setEngineSizeCc: (v: string) => void;
  accidentHistoryCount: string;
  setAccidentHistoryCount: (v: string) => void;
  fuelEfficiency: string;
  setFuelEfficiency: (v: string) => void;
  maintenanceHistory: string;
  setMaintenanceHistory: (v: string) => void;
  reportedIssuesCount: string;
  setReportedIssuesCount: (v: string) => void;
  tireCondition: string;
  setTireCondition: (v: string) => void;
  brakeCondition: string;
  setBrakeCondition: (v: string) => void;
  batteryStatus: string;
  setBatteryStatus: (v: string) => void;
  activeTrips: number;
  editingVehicleId: string | null;
  onSaveVehicle: (e: FormEvent) => void;
  onEditVehicle: (vehicle: Vehicle) => void;
  onCancelEdit: () => void;
  onDeleteVehicle: (vehicleId: string) => void;
};

type ManagementTab = "overview" | "register";

type ManagementIconName = "fleet" | "trips" | "service" | "risk";

function ManagementIcon({ name }: { name: ManagementIconName }) {
  switch (name) {
    case "fleet":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 16V9l3-3h9l3 3v7M7 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "trips":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 18 19 6M13 6h6v6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "service":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m14.7 6.3 3 3-8.9 8.9-3.6.6.6-3.6 8.9-8.9ZM13 8l3 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "risk":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

export default function Management(props: ManagementProps) {
  const [activeTab, setActiveTab] = useState<ManagementTab>("overview");
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [viewTarget, setViewTarget] = useState<Vehicle | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const filteredVehicles = props.vehicles.filter((vehicle) => {
    if (statusFilter === "all") return true;
    return (vehicle.status || "").toLowerCase() === statusFilter;
  }).filter((vehicle) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return [
      vehicle.plate_no,
      vehicle.make,
      vehicle.model,
      vehicle.vehicle_type,
      vehicle.status,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginatedVehicles = filteredVehicles.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );
  const maintenanceVehicles = props.vehicles.filter((vehicle) => (vehicle.status || "").toLowerCase() === "maintenance");
  const activeVehicles = props.vehicles.filter((vehicle) => (vehicle.status || "").toLowerCase() === "active");
  const flaggedVehicles = Object.values(props.maintenancePredictionMap).filter(
    (prediction) => prediction.risk_level === "medium" || prediction.risk_level === "high"
  );

  useEffect(() => {
    if (!props.editingVehicleId && !props.loading) {
      setShowVehicleModal(false);
    }
  }, [props.editingVehicleId, props.loading]);

  useEffect(() => {
    setPage(1);
  }, [rowsPerPage, statusFilter, searchTerm, props.vehicles.length]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    await props.onDeleteVehicle(deleteTarget.id);
    setDeleteTarget(null);
  }

  function openCreateModal() {
    props.onCancelEdit();
    setShowVehicleModal(true);
  }

  function openEditModal(vehicle: Vehicle) {
    props.onEditVehicle(vehicle);
    setShowVehicleModal(true);
  }

  async function handleVehicleSubmit(e: FormEvent) {
    await props.onSaveVehicle(e);
  }

  function closeVehicleModal() {
    props.onCancelEdit();
    setShowVehicleModal(false);
  }

  function handleMileageChange(nextMileage: string) {
    props.setVehicleMileage(nextMileage);
    if (!props.editingVehicleId) {
      const shouldSyncOdometer =
        props.vehicleOdometer.trim() === "" || props.vehicleOdometer === props.vehicleMileage;
      if (shouldSyncOdometer) {
        props.setVehicleOdometer(nextMileage);
      }
    }
  }

  function maintenanceToggleEnabled() {
    return props.vehicleStatus === "maintenance";
  }

  function activeToggleEnabled() {
    return props.vehicleStatus === "active";
  }

  function handleVehicleActiveToggle(checked: boolean) {
    if (maintenanceToggleEnabled()) return;
    props.setVehicleStatus(checked ? "active" : "inactive");
  }

  function handleVehicleMaintenanceToggle(checked: boolean) {
    if (checked) {
      props.setVehicleStatus("maintenance");
      return;
    }
    if (props.vehicleStatus === "maintenance") {
      props.setVehicleStatus("inactive");
    }
  }

  function formatRiskLabel(level?: "low" | "medium" | "high") {
    if (!level) return "No result";
    return `${level.charAt(0).toUpperCase()}${level.slice(1)} risk`;
  }

  function formatMakeModel(vehicle: Vehicle) {
    const parts = [vehicle.make, vehicle.model].filter((value) => value && value.trim().length > 0);
    return parts.length ? parts.join(" ") : "--";
  }

  return (
    <section className="section">
      <section className="admin-page">
      <section className="stats stats--four admin-stats">
        <div className="stat-card stat-card--blue">
          <div className="stat-icon"><ManagementIcon name="fleet" /></div>
          <div className="stat-value">{props.vehicles.length}</div>
          <div className="stat-label">Fleet Vehicles</div>
          <div className="stat-sub">Registered assets</div>
        </div>
        <div className="stat-card stat-card--green">
          <div className="stat-icon"><ManagementIcon name="trips" /></div>
          <div className="stat-value">{props.activeTrips}</div>
          <div className="stat-label">Active Trips</div>
          <div className="stat-sub">Vehicles currently dispatched</div>
        </div>
        <div className="stat-card stat-card--amber">
          <div className="stat-icon"><ManagementIcon name="service" /></div>
          <div className="stat-value">{maintenanceVehicles.length}</div>
          <div className="stat-label">In Maintenance</div>
          <div className="stat-sub">Service-state vehicles</div>
        </div>
        <div className="stat-card stat-card--purple">
          <div className="stat-icon"><ManagementIcon name="risk" /></div>
          <div className="stat-value">{flaggedVehicles.length}</div>
          <div className="stat-label">Flagged Risk</div>
          <div className="stat-sub">Medium or high prediction results</div>
        </div>
      </section>

      <nav className="admin-tabs" aria-label="Fleet management sections">
        <button
          type="button"
          className={`admin-tab ${activeTab === "overview" ? "admin-tab--active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
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
      <div className="grid admin-summary-grid admin-summary-grid--balanced">
        <section className="card admin-card--action">
          <div className="card__header">
            <div>
              <h3>Fleet Actions</h3>
              <p className="muted admin-card__subtitle">Create or update vehicle records from one place.</p>
            </div>
          </div>
          <div className="quick-actions quick-actions--single">
            <button className="btn" type="button" onClick={openCreateModal}>
              Add Vehicle
            </button>
          </div>
        </section>

        <section className="card admin-card--summary">
          <div className="card__header">
            <div>
              <h3>Fleet Status</h3>
              <p className="muted admin-card__subtitle">Current balance between active and maintenance availability.</p>
            </div>
          </div>
          <ul className="list">
            <li>
              <div className="list__title">Active Vehicles</div>
              <div className="list__meta">{activeVehicles.length} vehicles currently available</div>
            </li>
            <li>
              <div className="list__title">Maintenance State</div>
              <div className="list__meta">{maintenanceVehicles.length} vehicles currently under service attention</div>
            </li>
          </ul>
        </section>

        <section className="card admin-card--summary">
          <div className="card__header">
            <div>
              <h3>Maintenance Watch</h3>
              <p className="muted admin-card__subtitle">Latest model-driven attention list for the fleet register.</p>
            </div>
          </div>
          {flaggedVehicles.length === 0 ? (
            <p className="empty">No medium or high maintenance-risk vehicles yet.</p>
          ) : (
            <ul className="list">
              {flaggedVehicles.slice(0, 3).map((prediction) => {
                const vehicle = props.vehicles.find((item) => item.id === prediction.vehicle_id);
                return (
                  <li key={prediction.vehicle_id}>
                    <div className="list__title">{vehicle?.plate_no || "Vehicle"}</div>
                    <div className="list__meta">
                      {formatRiskLabel(prediction.risk_level)} • {Math.round(prediction.probability * 100)}%
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      )}

      {activeTab === "register" && (
      <section className="card admin-table-section">
        <div className="card__header">
          <div>
            <h3>Vehicle Register</h3>
            <p className="muted admin-card__subtitle">Search, filter, review, and maintain the current fleet record.</p>
          </div>
          <div className="button-row">
            <button className="btn btn--compact" type="button" onClick={openCreateModal}>
              Add Vehicle
            </button>
          </div>
        </div>
        {props.vehicles.length === 0 ? (
          <p className="empty">No vehicles added yet.</p>
        ) : (
          <>
            <div className="table-controls">
              <div className="table-controls__filters">
                <label className="table-controls__label table-controls__label--search">
                  Search
                  <input
                    type="search"
                    placeholder="Plate, make, model..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </label>
                <label className="table-controls__label">
                  Status
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <label className="table-controls__label">
                  Rows
                  <select
                    value={rowsPerPage}
                    onChange={(e) => setRowsPerPage(Number(e.target.value))}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>
              <div className="table-pagination">
                <span className="table-pagination__meta">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Prev
                </button>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
            {filteredVehicles.length === 0 ? (
              <p className="empty">No vehicles match the selected status.</p>
            ) : (
            <div className="table management-table" style={{ ["--table-columns" as any]: 8 }}>
              <div className="table__head management-table__head">
                <span>Plate</span>
                <span>Make / Model</span>
                <span>Type</span>
                <span>Year</span>
                <span>Odometer</span>
                <span>Maintenance Risk</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {paginatedVehicles.map((v) => (
                <div className="table__row management-table__row management-table__row--vehicles" key={v.id}>
                  {(() => {
                    const latestPrediction = props.maintenancePredictionMap[v.id];
                    return (
                      <>
                  <span className="management-table__cell management-table__cell--plate" data-label="Plate">{v.plate_no}</span>
                  <span className="management-table__cell" data-label="Make / Model">{formatMakeModel(v)}</span>
                  <span className="management-table__cell" data-label="Type">{v.vehicle_type || "--"}</span>
                  <span className="management-table__cell management-table__cell--year" data-label="Year">{v.year || "--"}</span>
                  <span className="management-table__cell management-table__cell--odometer" data-label="Odometer">
                    {v.odometer_km ?? "--"}
                  </span>
                  <span className="management-table__cell management-table__cell--risk" data-label="Maintenance Risk">
                    {latestPrediction ? (
                      <span className={`risk-pill risk-pill--${latestPrediction.risk_level}`}>
                        {formatRiskLabel(latestPrediction.risk_level)}
                        <strong>{Math.round(latestPrediction.probability * 100)}%</strong>
                      </span>
                    ) : (
                      <span className="muted">Not run</span>
                    )}
                  </span>
                  <span className="management-table__cell management-table__cell--status" data-label="Status">
                    {v.status ? (
                      <span className={`risk-pill ${v.status === "active" ? "risk-pill--low" : v.status === "maintenance" ? "risk-pill--medium" : "risk-pill--high"}`}>
                        {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                      </span>
                    ) : (
                      <span className="muted">--</span>
                    )}
                  </span>
                  <span className="table__actions management-table__actions" data-label="Actions">
                    <button
                      className="icon-action"
                      type="button"
                      onClick={() => setViewTarget(v)}
                      aria-label={`View ${v.plate_no}`}
                      title="View vehicle"
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
                        <circle
                          cx="12"
                          cy="12"
                          r="3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                        />
                      </svg>
                    </button>
                    <button
                      className="icon-action"
                      type="button"
                      onClick={() => openEditModal(v)}
                      aria-label={`Edit ${v.plate_no}`}
                      title="Edit vehicle"
                    >
                      <svg className="icon-action__svg icon-action__svg--edit" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="m16.862 4.487 2.651 2.651m-1.616-4.687a2.25 2.25 0 1 1 3.182 3.182L7.5 19.212 3.75 20.25l1.038-3.75L17.897 2.451Z"
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
                      onClick={() => setDeleteTarget(v)}
                      disabled={props.loading}
                      aria-label={`Delete ${v.plate_no}`}
                      title="Delete vehicle"
                    >
                      <svg className="icon-action__svg icon-action__svg--delete" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M6 7.5h12m-10.5 0V6A1.5 1.5 0 0 1 9 4.5h6A1.5 1.5 0 0 1 16.5 6v1.5m-9 0 .664 9.294A1.5 1.5 0 0 0 9.66 18.75h4.68a1.5 1.5 0 0 0 1.496-1.956L16.5 7.5m-6 3v4.5m3-4.5v4.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </span>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
            )}
          </>
        )}
      </section>
      )}

      {showVehicleModal && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--wide modal--form" role="dialog" aria-modal="true" aria-label="Vehicle form">
            <div className="modal__header">
              <div>
                <h3>{props.editingVehicleId ? "Edit Vehicle" : "Add Vehicle"}</h3>
                <p className="modal__subtle">
                  {props.editingVehicleId ? "Update fleet details in one place." : "Create a vehicle record for fleet operations."}
                </p>
              </div>
              <button className="modal__close" type="button" onClick={closeVehicleModal} aria-label="Close vehicle form">
                ✕
              </button>
            </div>
            <form id="vehicle-form" className="form form--two-col form--scroll" onSubmit={handleVehicleSubmit}>
              <label>
                Plate Number
                <input
                  placeholder="e.g., WP CAB-1234"
                  value={props.plateNo}
                  onChange={(e) => props.setPlateNo(e.target.value)}
                  required
                />
              </label>
              <label>
                Make
                <input
                  placeholder="e.g., Toyota"
                  value={props.make}
                  onChange={(e) => props.setMake(e.target.value)}
                />
              </label>
              <label>
                Model
                <input
                  placeholder="e.g., Prius"
                  value={props.model}
                  onChange={(e) => props.setModel(e.target.value)}
                />
              </label>
              <label>
                Vehicle Type
                <select
                  value={props.vehicleType}
                  onChange={(e) => props.setVehicleType(e.target.value)}
                >
                  <option value="">Select type</option>
                  <option value="Car">Car</option>
                  <option value="SUV">SUV</option>
                  <option value="Truck">Truck</option>
                  <option value="Bus">Bus</option>
                  <option value="Motorcycle">Motorcycle</option>
                  <option value="Van">Van</option>
                </select>
              </label>
              <label>
                Year
                <input
                  type="number"
                  placeholder="e.g., 2022"
                  value={props.year}
                  onChange={(e) => props.setYear(e.target.value)}
                />
              </label>
              <label>
                Mileage (km)
                <input
                  type="number"
                  placeholder="e.g., 120000"
                  value={props.vehicleMileage}
                  onChange={(e) => handleMileageChange(e.target.value)}
                />
              </label>
              {props.editingVehicleId && (
                <label>
                  Latest Odometer (km)
                  <input
                    type="number"
                    placeholder="e.g., 125000"
                    value={props.vehicleOdometer}
                    onChange={(e) => props.setVehicleOdometer(e.target.value)}
                  />
                </label>
              )}
              <label>
                Transmission Type
                <select value={props.transmissionType} onChange={(e) => props.setTransmissionType(e.target.value)}>
                  <option value="">Select transmission</option>
                  <option value="Automatic">Automatic</option>
                  <option value="Manual">Manual</option>
                </select>
              </label>
              <label>
                Engine Size (cc)
                <input
                  type="number"
                  placeholder="e.g., 1500"
                  value={props.engineSizeCc}
                  onChange={(e) => props.setEngineSizeCc(e.target.value)}
                />
              </label>
              <label>
                Accident History Count
                <input
                  type="number"
                  min="0"
                  value={props.accidentHistoryCount}
                  onChange={(e) => props.setAccidentHistoryCount(e.target.value)}
                />
              </label>
              <label>
                Fuel Efficiency
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 12.5"
                  value={props.fuelEfficiency}
                  onChange={(e) => props.setFuelEfficiency(e.target.value)}
                />
              </label>
              <label>
                Maintenance History
                <select value={props.maintenanceHistory} onChange={(e) => props.setMaintenanceHistory(e.target.value)}>
                  <option value="">Select history</option>
                  <option value="Good">Good</option>
                  <option value="Average">Average</option>
                  <option value="Poor">Poor</option>
                </select>
              </label>
              <label>
                Reported Issues Count
                <input
                  type="number"
                  min="0"
                  value={props.reportedIssuesCount}
                  onChange={(e) => props.setReportedIssuesCount(e.target.value)}
                />
              </label>
              <label>
                Tire Condition
                <select value={props.tireCondition} onChange={(e) => props.setTireCondition(e.target.value)}>
                  <option value="">Select tire condition</option>
                  <option value="New">New</option>
                  <option value="Good">Good</option>
                  <option value="Worn Out">Worn Out</option>
                </select>
              </label>
              <label>
                Brake Condition
                <select value={props.brakeCondition} onChange={(e) => props.setBrakeCondition(e.target.value)}>
                  <option value="">Select brake condition</option>
                  <option value="New">New</option>
                  <option value="Good">Good</option>
                  <option value="Worn Out">Worn Out</option>
                </select>
              </label>
              <label>
                Battery Status
                <select value={props.batteryStatus} onChange={(e) => props.setBatteryStatus(e.target.value)}>
                  <option value="">Select battery status</option>
                  <option value="Good">Good</option>
                  <option value="Weak">Weak</option>
                </select>
              </label>
              <div className="form-toggle-row form-toggle-row--full">
                <label className="toggle-switch">
                  <span className="toggle-switch__label">Active</span>
                  <input
                    type="checkbox"
                    className="toggle-switch__input"
                    checked={activeToggleEnabled()}
                    disabled={maintenanceToggleEnabled()}
                    onChange={(e) => handleVehicleActiveToggle(e.target.checked)}
                  />
                  <span className="toggle-switch__track" aria-hidden="true">
                    <span className="toggle-switch__thumb" />
                  </span>
                </label>
                <label className="toggle-switch">
                  <span className="toggle-switch__label">Maintenance</span>
                  <input
                    type="checkbox"
                    className="toggle-switch__input"
                    checked={maintenanceToggleEnabled()}
                    onChange={(e) => handleVehicleMaintenanceToggle(e.target.checked)}
                  />
                  <span className="toggle-switch__track" aria-hidden="true">
                    <span className="toggle-switch__thumb" />
                  </span>
                </label>
              </div>
            </form>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={closeVehicleModal}>
                Cancel
              </button>
              <button className="btn" type="submit" form="vehicle-form" disabled={props.loading}>
                {props.loading ? "Saving..." : props.editingVehicleId ? "Save Changes" : "Add Vehicle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--wide modal--details" role="dialog" aria-modal="true" aria-label="Vehicle details">
            <div className="modal__header">
              <div>
                <h3>Vehicle Details</h3>
                <p className="modal__subtle">Full vehicle record from the current fleet table.</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setViewTarget(null)} aria-label="Close vehicle details">
                ✕
              </button>
            </div>
            <div className="details-grid details-grid--scroll">
              <div className="detail-item"><span>Plate</span><strong>{viewTarget.plate_no}</strong></div>
              <div className="detail-item"><span>Make / Model</span><strong>{formatMakeModel(viewTarget)}</strong></div>
              <div className="detail-item"><span>Vehicle Type</span><strong>{viewTarget.vehicle_type || "--"}</strong></div>
              <div className="detail-item"><span>Year</span><strong>{viewTarget.year || "--"}</strong></div>
              <div className="detail-item"><span>Status</span><strong>{viewTarget.status || "--"}</strong></div>
              <div className="detail-item"><span>Mileage (km)</span><strong>{viewTarget.mileage ?? "--"}</strong></div>
              <div className="detail-item"><span>Odometer (km)</span><strong>{viewTarget.odometer_km ?? "--"}</strong></div>
              <div className="detail-item"><span>Transmission</span><strong>{viewTarget.transmission_type || "--"}</strong></div>
              <div className="detail-item"><span>Engine Size (cc)</span><strong>{viewTarget.engine_size_cc ?? "--"}</strong></div>
              <div className="detail-item"><span>Accident History</span><strong>{viewTarget.accident_history_count ?? "--"}</strong></div>
              <div className="detail-item"><span>Fuel Efficiency</span><strong>{viewTarget.fuel_efficiency ?? "--"}</strong></div>
              <div className="detail-item"><span>Maintenance History</span><strong>{viewTarget.maintenance_history || "--"}</strong></div>
              <div className="detail-item"><span>Reported Issues</span><strong>{viewTarget.reported_issues_count ?? "--"}</strong></div>
              <div className="detail-item"><span>Tire Condition</span><strong>{viewTarget.tire_condition || "--"}</strong></div>
              <div className="detail-item"><span>Brake Condition</span><strong>{viewTarget.brake_condition || "--"}</strong></div>
              <div className="detail-item"><span>Battery Status</span><strong>{viewTarget.battery_status || "--"}</strong></div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Confirm delete">
            <div className="modal__header">
              <h3>Delete Vehicle?</h3>
              <button className="modal__close" type="button" onClick={() => setDeleteTarget(null)} aria-label="Close delete dialog">
                ✕
              </button>
            </div>
            <p className="muted">
              Are you sure you want to delete <strong>{deleteTarget.plate_no}</strong>? This action
              cannot be undone.
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
    </section>
  );
}
