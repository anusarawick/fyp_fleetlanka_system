import { FormEvent, useEffect, useState } from "react";

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
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(props.drivers.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginatedDrivers = props.drivers.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  useEffect(() => {
    if (!props.editingDriverId && !props.loading) {
      setShowDriverModal(false);
    }
  }, [props.editingDriverId, props.loading]);

  useEffect(() => {
    setPage(1);
  }, [rowsPerPage, props.drivers.length]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    await props.onDeleteDriver(deleteTarget.id);
    setDeleteTarget(null);
  }

  function openCreateModal() {
    props.onCancelEdit();
    setShowDriverModal(true);
  }

  function openEditModal(driver: Driver) {
    props.onEditDriver(driver);
    setShowDriverModal(true);
  }

  async function handleDriverSubmit(e: FormEvent) {
    await props.onSaveDriver(e);
  }

  function closeDriverModal() {
    props.onCancelEdit();
    setShowDriverModal(false);
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
            <h3>Driver Actions</h3>
          </div>
          <p className="muted">
            Create and update driver accounts from focused pop-up forms.
          </p>
          <button className="btn" type="button" onClick={openCreateModal}>
            + Add Driver
          </button>
        </section>

      </div>

      <section className="card" style={{ marginTop: "24px" }}>
        <div className="card__header">
          <h3>📋 Current Drivers</h3>
        </div>
        {props.drivers.length === 0 ? (
          <p className="empty">No drivers added yet. Create your first driver profile.</p>
        ) : (
          <>
            <div className="table-controls">
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
            <div className="table" style={{ ["--table-columns" as any]: 4 }}>
              <div className="table__head">
                <span>Name</span>
                <span>Phone</span>
                <span>Role</span>
                <span>Actions</span>
              </div>
              {paginatedDrivers.map((d) => (
                <div className="table__row" key={d.id}>
                  <span>{d.full_name || "Driver"}</span>
                  <span>{d.phone || "--"}</span>
                  <span>{d.role || "driver"}</span>
                  <span className="table__actions">
                    <button
                      className="icon-action"
                      type="button"
                      onClick={() => openEditModal(d)}
                      aria-label={`Edit ${d.full_name || "driver"}`}
                      title="Edit driver"
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
                      onClick={() => setDeleteTarget(d)}
                      disabled={props.loading}
                      aria-label={`Delete ${d.full_name || "driver"}`}
                      title="Delete driver"
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
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {showDriverModal && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Driver form">
            <div className="modal__header">
              <div>
                <h3>{props.editingDriverId ? "Edit Driver" : "Add Driver"}</h3>
                <p className="modal__subtle">
                  {props.editingDriverId ? "Update the existing driver profile." : "Create a driver account for mobile access."}
                </p>
              </div>
              <button className="modal__close" type="button" onClick={closeDriverModal} aria-label="Close driver form">
                ✕
              </button>
            </div>
            <form className="form" onSubmit={handleDriverSubmit}>
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
              <div className="modal__actions">
                <button className="btn btn--secondary" type="button" onClick={closeDriverModal}>
                  Cancel
                </button>
                <button className="btn" type="submit" disabled={props.loading}>
                  {props.loading ? "Saving..." : props.editingDriverId ? "Save Changes" : "Add Driver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Confirm delete">
            <div className="modal__header">
              <h3>Delete Driver?</h3>
              <button className="modal__close" type="button" onClick={() => setDeleteTarget(null)} aria-label="Close delete dialog">
                ✕
              </button>
            </div>
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
