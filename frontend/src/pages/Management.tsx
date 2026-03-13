import { FormEvent, useState } from "react";
import { MaintenancePrediction } from "../types";

type Vehicle = {
  id: string;
  plate_no: string;
  make?: string;
  model?: string;
  vehicle_type?: string;
  year?: number;
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
  activeTrips: number;
  editingVehicleId: string | null;
  onSaveVehicle: (e: FormEvent) => void;
  onEditVehicle: (vehicle: Vehicle) => void;
  onCancelEdit: () => void;
  onDeleteVehicle: (vehicleId: string) => void;
  onRunMaintenanceCheck: (vehicleId: string) => void;
};

export default function Management(props: ManagementProps) {
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);

  function renderRiskBadge(vehicleId: string) {
    const prediction = props.maintenancePredictionMap[vehicleId];
    if (!prediction) return <span className="pill">Not checked</span>;
    const label = `${prediction.risk_level.toUpperCase()} ${(prediction.probability * 100).toFixed(0)}%`;
    const className =
      prediction.risk_level === "high"
        ? "pill pill--danger"
        : prediction.risk_level === "medium"
          ? "pill pill--warning"
          : "pill pill--success";
    return <span className={className}>{label}</span>;
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await props.onDeleteVehicle(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <section className="section">
      <div className="grid">
        <section className="card">
          <div className="card__header">
            <h3>{props.editingVehicleId ? "✏️ Edit Vehicle" : "🚚 Add New Vehicle"}</h3>
          </div>
          <form className="form" onSubmit={props.onSaveVehicle}>
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
                placeholder="e.g., Hiace"
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
            <button className="btn" type="submit" disabled={props.loading}>
              {props.loading ? "Saving..." : props.editingVehicleId ? "Save Changes" : "+ Add Vehicle"}
            </button>
            {props.editingVehicleId && (
              <button
                className="btn btn--secondary"
                type="button"
                onClick={props.onCancelEdit}
              >
                Cancel
              </button>
            )}
          </form>
        </section>

        <section className="card">
          <div className="card__header">
            <h3>📍 Active Trips</h3>
          </div>
          <div className="stat-value" style={{ marginBottom: "8px" }}>
            {props.activeTrips}
          </div>
          <p className="muted">
            Trips currently running across the fleet.
          </p>
        </section>
      </div>

      <section className="card" style={{ marginTop: "24px" }}>
        <div className="card__header">
          <h3>📋 Current Vehicles</h3>
          {props.vehicles.length > 0 && <span className="pill">{props.vehicles.length}</span>}
        </div>
        {props.vehicles.length === 0 ? (
          <p className="empty">No vehicles added yet.</p>
        ) : (
          <div className="table" style={{ ["--table-columns" as any]: 7 }}>
            <div className="table__head">
              <span>Plate</span>
              <span>Make</span>
              <span>Model</span>
              <span>Type</span>
              <span>Year</span>
              <span>ML Risk</span>
              <span>Actions</span>
            </div>
            {props.vehicles.map((v) => (
              <div className="table__row" key={v.id}>
                <span>{v.plate_no}</span>
                <span>{v.make || "--"}</span>
                <span>{v.model || "--"}</span>
                <span>{v.vehicle_type || "--"}</span>
                <span>{v.year || "--"}</span>
                <span>{renderRiskBadge(v.id)}</span>
                <span className="table__actions">
                  <button
                    className="btn"
                    type="button"
                    onClick={() => props.onRunMaintenanceCheck(v.id)}
                    disabled={props.loading}
                  >
                    ML Check
                  </button>
                  <button className="btn btn--secondary" type="button" onClick={() => props.onEditVehicle(v)}>
                    Edit
                  </button>
                  <button
                    className="btn btn--danger"
                    type="button"
                    onClick={() => setDeleteTarget(v)}
                    disabled={props.loading}
                  >
                    Delete
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Confirm delete">
            <h3>Delete Vehicle?</h3>
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
  );
}
