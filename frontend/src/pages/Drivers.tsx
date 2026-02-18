import { FormEvent, useState } from "react";

type Driver = {
  id: string;
  full_name?: string;
  phone?: string;
  role?: string;
};

type DriversProps = {
  drivers: Driver[];
  loading: boolean;
  driverName: string;
  setDriverName: (v: string) => void;
  driverEmail: string;
  setDriverEmail: (v: string) => void;
  driverPhone: string;
  setDriverPhone: (v: string) => void;
  driverPassword: string;
  setDriverPassword: (v: string) => void;
  editingDriverId: string | null;
  onSaveDriver: (e: FormEvent) => void;
  onEditDriver: (driver: Driver) => void;
  onCancelEdit: () => void;
  onDeleteDriver: (driverId: string) => void;
};

export default function Drivers(props: DriversProps) {
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);

  async function confirmDelete() {
    if (!deleteTarget) return;
    await props.onDeleteDriver(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <section className="section">
      <div className="stats" style={{ gridTemplateColumns: "repeat(2, 1fr)", marginBottom: "24px" }}>
        <div className="stat-card">
          <div className="stat-icon">👤</div>
          <div className="stat-value">{props.drivers.length}</div>
          <div className="stat-label">Total Drivers</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-value">Active</div>
          <div className="stat-label">All drivers onboarded</div>
        </div>
      </div>

      <div className="grid">
        <section className="card">
          <div className="card__header">
            <h3>{props.editingDriverId ? "✏️ Edit Driver" : "👤 Add New Driver"}</h3>
          </div>
          <form className="form" onSubmit={props.onSaveDriver}>
            <label>
              Full Name
              <input
                placeholder="e.g., Kamal Perera"
                value={props.driverName}
                onChange={(e) => props.setDriverName(e.target.value)}
              />
            </label>
            <label>
              Email Address
              <input
                type="email"
                placeholder="e.g., driver@fleetlanka.lk"
                value={props.driverEmail}
                onChange={(e) => props.setDriverEmail(e.target.value)}
                required={!props.editingDriverId}
                disabled={!!props.editingDriverId}
              />
            </label>
            <label>
              Phone Number
              <input
                placeholder="e.g., 077-1234567"
                value={props.driverPhone}
                onChange={(e) => props.setDriverPhone(e.target.value)}
              />
            </label>
            <label>
              Temporary Password
              <input
                type="password"
                placeholder="Minimum 6 characters"
                value={props.driverPassword}
                onChange={(e) => props.setDriverPassword(e.target.value)}
                required={!props.editingDriverId}
                disabled={!!props.editingDriverId}
              />
            </label>
            <button className="btn" type="submit" disabled={props.loading}>
              {props.loading ? "Saving..." : props.editingDriverId ? "Save Changes" : "+ Add Driver"}
            </button>
            {props.editingDriverId && (
              <button className="btn btn--secondary" type="button" onClick={props.onCancelEdit}>
                Cancel
              </button>
            )}
          </form>
        </section>

      </div>

      <section className="card" style={{ marginTop: "24px" }}>
        <div className="card__header">
          <h3>📋 Current Drivers</h3>
          {props.drivers.length > 0 && (
            <span className="pill">{props.drivers.length}</span>
          )}
        </div>
        {props.drivers.length === 0 ? (
          <p className="empty">No drivers added yet. Create your first driver profile.</p>
        ) : (
          <div className="table" style={{ ["--table-columns" as any]: 4 }}>
            <div className="table__head">
              <span>Name</span>
              <span>Phone</span>
              <span>Role</span>
              <span>Actions</span>
            </div>
            {props.drivers.map((d) => (
              <div className="table__row" key={d.id}>
                <span>{d.full_name || "Driver"}</span>
                <span>{d.phone || "--"}</span>
                <span>{d.role || "driver"}</span>
                <span className="table__actions">
                  <button className="btn btn--secondary" type="button" onClick={() => props.onEditDriver(d)}>
                    Edit
                  </button>
                  <button
                    className="btn btn--danger"
                    type="button"
                    onClick={() => setDeleteTarget(d)}
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
            <h3>Delete Driver?</h3>
            <p className="muted">
              Are you sure you want to delete <strong>{deleteTarget.full_name || "this driver"}</strong>? This action
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
