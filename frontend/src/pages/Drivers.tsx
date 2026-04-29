import { FormEvent, useEffect, useState } from "react";
import { Eye, MailCheck, Pencil, Trash2, UserCheck, UserX, Users, type LucideIcon } from "lucide-react";

type Driver = {
  id: string;
  org_id?: string;
  email?: string;
  full_name?: string;
  phone?: string;
  role?: string;
  status?: string;
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
  driverStatus: string;
  setDriverStatus: (v: string) => void;
  driverPassword: string;
  setDriverPassword: (v: string) => void;
  editingDriverId: string | null;
  onSaveDriver: (e: FormEvent) => void;
  onEditDriver: (driver: Driver) => void;
  onCancelEdit: () => void;
  onDeleteDriver: (driverId: string) => void;
};

type DriversTab = "overview" | "register";

type DriversIconName = "drivers" | "active" | "inactive" | "coverage";

function DriversIcon({ name }: { name: DriversIconName }) {
  const icons: Record<DriversIconName, LucideIcon> = {
    drivers: Users,
    active: UserCheck,
    inactive: UserX,
    coverage: MailCheck,
  };
  const Icon = icons[name];
  return <Icon aria-hidden="true" />;
}

export default function Drivers(props: DriversProps) {
  const [activeTab, setActiveTab] = useState<DriversTab>("overview");
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [viewTarget, setViewTarget] = useState<Driver | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [resetPasswordEnabled, setResetPasswordEnabled] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const filteredDrivers = props.drivers
    .filter((driver) => {
      if (statusFilter === "all") return true;
      return (driver.status || "").toLowerCase() === statusFilter;
    })
    .filter((driver) => {
      const query = searchTerm.trim().toLowerCase();
      if (!query) return true;
      return [driver.full_name, driver.email, driver.phone, driver.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });

  const totalPages = Math.max(1, Math.ceil(filteredDrivers.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginatedDrivers = filteredDrivers.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );
  const activeDrivers = props.drivers.filter((driver) => (driver.status || "active") === "active");
  const inactiveDrivers = props.drivers.filter((driver) => (driver.status || "active") !== "active");
  const completeProfiles = props.drivers.filter((driver) => Boolean(driver.email) && Boolean(driver.phone));

  useEffect(() => {
    if (!props.editingDriverId && !props.loading) {
      setShowDriverModal(false);
    }
  }, [props.editingDriverId, props.loading]);

  useEffect(() => {
    setPage(1);
  }, [rowsPerPage, statusFilter, searchTerm, props.drivers.length]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    await props.onDeleteDriver(deleteTarget.id);
    setDeleteTarget(null);
  }

  function openCreateModal() {
    props.onCancelEdit();
    setResetPasswordEnabled(false);
    setShowDriverModal(true);
  }

  function openEditModal(driver: Driver) {
    props.onEditDriver(driver);
    setResetPasswordEnabled(false);
    setShowDriverModal(true);
  }

  async function handleDriverSubmit(e: FormEvent) {
    await props.onSaveDriver(e);
  }

  function closeDriverModal() {
    props.onCancelEdit();
    setResetPasswordEnabled(false);
    setShowDriverModal(false);
  }

  function formatStatus(status?: string) {
    if (!status) return "--";
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  return (
    <section className="section">
      <section className="admin-page">
      <section className="stats stats--four admin-stats">
        <div className="stat-card stat-card--blue">
          <div className="stat-icon"><DriversIcon name="drivers" /></div>
          <div className="stat-value">{props.drivers.length}</div>
          <div className="stat-label">Total Drivers</div>
          <div className="stat-sub">Registered driver accounts</div>
        </div>
        <div className="stat-card stat-card--green">
          <div className="stat-icon"><DriversIcon name="active" /></div>
          <div className="stat-value">{activeDrivers.length}</div>
          <div className="stat-label">Active Drivers</div>
          <div className="stat-sub">Currently enabled for work</div>
        </div>
        <div className="stat-card stat-card--amber">
          <div className="stat-icon"><DriversIcon name="inactive" /></div>
          <div className="stat-value">{inactiveDrivers.length}</div>
          <div className="stat-label">Inactive Drivers</div>
          <div className="stat-sub">Temporarily disabled accounts</div>
        </div>
        <div className="stat-card stat-card--purple">
          <div className="stat-icon"><DriversIcon name="coverage" /></div>
          <div className="stat-value">{completeProfiles.length}</div>
          <div className="stat-label">Profile Coverage</div>
          <div className="stat-sub">Accounts with email and phone details</div>
        </div>
      </section>

      <nav className="admin-tabs" aria-label="Driver sections">
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
              <h3>Driver Actions</h3>
              <p className="muted admin-card__subtitle">Create driver accounts and manage mobile-access roster records from one place.</p>
            </div>
          </div>
          <div className="admin-action-buttons">
            <button className="btn" type="button" onClick={openCreateModal}>
              Add Driver
            </button>
          </div>
        </section>

        <section className="card admin-card--summary">
          <div className="card__header">
            <div>
              <h3>Roster Status</h3>
              <p className="muted admin-card__subtitle">Operational view of the driver pool and current account readiness.</p>
            </div>
          </div>
          <ul className="list">
            <li>
              <div className="list__title">Active Roster</div>
              <div className="list__meta">{activeDrivers.length} drivers currently available for assignment</div>
            </li>
            <li>
              <div className="list__title">Inactive Accounts</div>
              <div className="list__meta">{inactiveDrivers.length} drivers currently withheld from access</div>
            </li>
            <li>
              <div className="list__title">Contact Completeness</div>
              <div className="list__meta">{completeProfiles.length} driver profiles have both email and phone on record</div>
            </li>
          </ul>
        </section>
      </div>
      )}

      {activeTab === "register" && (
      <section className="card admin-table-section">
        <div className="card__header">
          <div>
            <h3>Driver Register</h3>
            <p className="muted admin-card__subtitle">Search, filter, review, and manage current driver accounts without leaving the roster view.</p>
          </div>
          <div className="button-row">
            <button className="btn btn--compact" type="button" onClick={openCreateModal}>
              Add Driver
            </button>
          </div>
        </div>
        {props.drivers.length === 0 ? (
          <p className="empty">No drivers added yet. Create your first driver profile.</p>
        ) : (
          <>
            <div className="table-controls">
              <div className="table-controls__filters">
                <label className="table-controls__label table-controls__label--search">
                  Search
                  <input
                    type="search"
                    placeholder="Name, email, phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </label>
                <label className="table-controls__label">
                  Status
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">All</option>
                    <option value="active">Active</option>
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
            {filteredDrivers.length === 0 ? (
              <p className="empty">No drivers match the current filters.</p>
            ) : (
            <div className="table drivers-table" style={{ ["--table-columns" as any]: 5 }}>
              <div className="table__head drivers-table__head">
                <span>Name</span>
                <span>Email</span>
                <span>Phone</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {paginatedDrivers.map((d) => (
                <div className="table__row drivers-table__row" key={d.id}>
                  <span className="drivers-table__cell" data-label="Name">{d.full_name || "Driver"}</span>
                  <span className="drivers-table__cell" data-label="Email">{d.email || "--"}</span>
                  <span className="drivers-table__cell" data-label="Phone">{d.phone || "--"}</span>
                  <span className="drivers-table__cell drivers-table__cell--status" data-label="Status">
                    <span className={`risk-pill ${(d.status || "active") === "active" ? "risk-pill--low" : "risk-pill--high"}`}>
                      {formatStatus(d.status || "active")}
                    </span>
                  </span>
                  <span className="table__actions drivers-table__actions" data-label="Actions">
                    <button
                      className="icon-action"
                      type="button"
                      onClick={() => setViewTarget(d)}
                      aria-label={`View ${d.full_name || "driver"}`}
                      title="View driver"
                    >
                      <Eye className="icon-action__svg icon-action__svg--view" aria-hidden="true" />
                    </button>
                    <button
                      className="icon-action"
                      type="button"
                      onClick={() => openEditModal(d)}
                      aria-label={`Edit ${d.full_name || "driver"}`}
                      title="Edit driver"
                    >
                      <Pencil className="icon-action__svg icon-action__svg--edit" aria-hidden="true" />
                    </button>
                    <button
                      className="icon-action icon-action--danger"
                      type="button"
                      onClick={() => setDeleteTarget(d)}
                      disabled={props.loading}
                      aria-label={`Delete ${d.full_name || "driver"}`}
                      title="Delete driver"
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
      )}

      {showDriverModal && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--form" role="dialog" aria-modal="true" aria-label="Driver form">
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
            <form id="driver-form" className="form form--scroll" onSubmit={handleDriverSubmit}>
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
                  required
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
              <div className="form-toggle-row">
                <label className="toggle-switch">
                  <span className="toggle-switch__label">
                    {props.driverStatus === "active" ? "Active" : "Inactive"}
                  </span>
                  <input
                    type="checkbox"
                    className="toggle-switch__input"
                    checked={props.driverStatus === "active"}
                    onChange={(e) => props.setDriverStatus(e.target.checked ? "active" : "inactive")}
                  />
                  <span className="toggle-switch__track" aria-hidden="true">
                    <span className="toggle-switch__thumb" />
                  </span>
                </label>
              </div>
              {props.editingDriverId ? (
                <>
                  <label className="toggle-switch">
                    <span className="toggle-switch__label">Reset Password</span>
                    <input
                      type="checkbox"
                      className="toggle-switch__input"
                      checked={resetPasswordEnabled}
                      onChange={(e) => {
                        setResetPasswordEnabled(e.target.checked);
                        if (!e.target.checked) props.setDriverPassword("");
                      }}
                    />
                    <span className="toggle-switch__track" aria-hidden="true">
                      <span className="toggle-switch__thumb" />
                    </span>
                  </label>
                  {resetPasswordEnabled && (
                    <label>
                      New Password
                      <input
                        type="password"
                        placeholder="Minimum 6 characters"
                        value={props.driverPassword}
                        onChange={(e) => props.setDriverPassword(e.target.value)}
                      />
                    </label>
                  )}
                </>
              ) : (
                <label>
                  Temporary Password
                  <input
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={props.driverPassword}
                    onChange={(e) => props.setDriverPassword(e.target.value)}
                    required
                  />
                </label>
              )}
            </form>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={closeDriverModal}>
                Cancel
              </button>
              <button className="btn" type="submit" form="driver-form" disabled={props.loading}>
                {props.loading ? "Saving..." : props.editingDriverId ? "Save Changes" : "Add Driver"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Driver details">
            <div className="modal__header">
              <div>
                <h3>Driver Details</h3>
                <p className="modal__subtle">Summary of the current driver record.</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setViewTarget(null)} aria-label="Close driver details">
                ✕
              </button>
            </div>
            <div className="details-grid">
              <div className="detail-item"><span>Name</span><strong>{viewTarget.full_name || "Driver"}</strong></div>
              <div className="detail-item"><span>Email</span><strong>{viewTarget.email || "--"}</strong></div>
              <div className="detail-item"><span>Phone</span><strong>{viewTarget.phone || "--"}</strong></div>
              <div className="detail-item"><span>Status</span><strong>{formatStatus(viewTarget.status || "active")}</strong></div>
              <div className="detail-item"><span>Driver ID</span><strong>{viewTarget.id}</strong></div>
            </div>
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
    </section>
  );
}
