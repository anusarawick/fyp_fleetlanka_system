import { FormEvent, useEffect, useState } from "react";
import {
  AlertCircle,
  Eye,
  KeyRound,
  Mail,
  MailCheck,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { DriverInsights, Trip } from "../types";

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
  trips: Trip[];
  driverInsights: DriverInsights | null;
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

function deriveTripStatus(trip: Trip) {
  if (trip.status) return trip.status;
  if (trip.end_time) return "completed";
  if (trip.start_time) return "in_progress";
  return "assigned";
}

function driverLabel(driver: Driver) {
  return driver.full_name || driver.email || driver.phone || "Driver";
}

function buildInsightBucket(drivers: Driver[]) {
  return {
    count: drivers.length,
    driver_ids: drivers.map((driver) => driver.id),
    preview: drivers.slice(0, 3).map(driverLabel),
  };
}

function buildDriverInsights(drivers: Driver[], trips: Trip[]): DriverInsights {
  const activeDrivers = drivers.filter((driver) => (driver.status || "active") === "active");
  const inactiveDrivers = drivers.filter((driver) => (driver.status || "active") !== "active");
  const assignedDriverIds = new Set(
    trips
      .filter((trip) => trip.driver_id && ["assigned", "in_progress"].includes(deriveTripStatus(trip)))
      .map((trip) => trip.driver_id as string)
  );
  const availableDrivers = activeDrivers.filter((driver) => !assignedDriverIds.has(driver.id));
  const contactReadyDrivers = activeDrivers.filter((driver) => driver.email && driver.phone);

  return {
    attention: {
      missing_phone: buildInsightBucket(drivers.filter((driver) => !driver.phone)),
      missing_email: buildInsightBucket(drivers.filter((driver) => !driver.email)),
      inactive_access: buildInsightBucket(inactiveDrivers),
    },
    dispatch_coverage: {
      available_drivers: availableDrivers.length,
      assigned_now: assignedDriverIds.size,
      contact_ready: contactReadyDrivers.length,
      active_total: activeDrivers.length,
    },
    cleanup: {
      incomplete_profiles: drivers.filter((driver) => !driver.email || !driver.phone).length,
      missing_names: drivers.filter((driver) => !driver.full_name).length,
      disabled_accounts: inactiveDrivers.length,
    },
  };
}

export default function Drivers(props: DriversProps) {
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
      return (driver.status || "active").toLowerCase() === statusFilter;
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
  const incompleteProfiles = props.drivers.filter((driver) => !driver.email || !driver.phone);
  const contactCoverage = props.drivers.length
    ? Math.round((completeProfiles.length / props.drivers.length) * 100)
    : 0;
  const attentionDrivers = [...incompleteProfiles, ...inactiveDrivers]
    .filter((driver, index, list) => list.findIndex((item) => item.id === driver.id) === index)
    .slice(0, 5);
  const missingPhoneDrivers = props.drivers.filter((driver) => !driver.phone);
  const missingEmailDrivers = props.drivers.filter((driver) => !driver.email);
  const activePercent = props.drivers.length ? Math.round((activeDrivers.length / props.drivers.length) * 100) : 0;
  const inactivePercent = props.drivers.length ? Math.round((inactiveDrivers.length / props.drivers.length) * 100) : 0;
  const unnamedDrivers = props.drivers.filter((driver) => !driver.full_name);
  const localDriverInsights = buildDriverInsights(props.drivers, props.trips);
  const driverInsights = props.driverInsights || localDriverInsights;
  const dispatchCoverage = driverInsights.dispatch_coverage;
  const availablePercent = dispatchCoverage.active_total
    ? Math.min(100, Math.round((dispatchCoverage.available_drivers / dispatchCoverage.active_total) * 100))
    : 0;
  const assignedPercent = dispatchCoverage.active_total
    ? Math.min(100, Math.round((dispatchCoverage.assigned_now / dispatchCoverage.active_total) * 100))
    : 0;
  const contactReadyPercent = dispatchCoverage.active_total
    ? Math.min(100, Math.round((dispatchCoverage.contact_ready / dispatchCoverage.active_total) * 100))
    : 0;

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

  function statusTone(status?: string) {
    return (status || "active") === "active" ? "status-badge--success" : "status-badge--danger";
  }

  function insightPreview(preview: string[]) {
    if (preview.length === 0) return "No records need review";
    return `${preview.join(", ")}${preview.length >= 3 ? "..." : ""}`;
  }

  function openFirstDriver(driverIds: string[]) {
    const driver = props.drivers.find((item) => item.id === driverIds[0]);
    if (driver) openEditModal(driver);
  }

  return (
    <section className="section">
      <section className="admin-page people-page people-page--drivers">
        <section className="dashboard-kpis drivers-kpi-grid" aria-label="Driver roster summary">
          <article className="dashboard-kpi-card dashboard-kpi-card--teal drivers-kpi-card">
            <span className="dashboard-kpi-card__icon"><DriversIcon name="drivers" /></span>
            <div>
              <span className="dashboard-kpi-card__label">Total Drivers</span>
              <strong>{props.drivers.length}</strong>
              <small className="dashboard-trend">{attentionDrivers.length} record{attentionDrivers.length === 1 ? "" : "s"} need review</small>
            </div>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card--green drivers-kpi-card">
            <span className="dashboard-kpi-card__icon"><DriversIcon name="active" /></span>
            <div>
              <span className="dashboard-kpi-card__label">Active Drivers</span>
              <strong>{activeDrivers.length}</strong>
              <small className="dashboard-trend dashboard-trend--positive">{activePercent}% of roster enabled</small>
            </div>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card--orange drivers-kpi-card">
            <span className="dashboard-kpi-card__icon"><DriversIcon name="inactive" /></span>
            <div>
              <span className="dashboard-kpi-card__label">Inactive Drivers</span>
              <strong>{inactiveDrivers.length}</strong>
              <small className="dashboard-trend dashboard-trend--warning">{inactivePercent}% withheld from access</small>
            </div>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card--purple drivers-kpi-card">
            <span className="dashboard-kpi-card__icon"><DriversIcon name="coverage" /></span>
            <div>
              <span className="dashboard-kpi-card__label">Contact Coverage</span>
              <strong>{contactCoverage}%</strong>
              <small className="dashboard-trend">{completeProfiles.length} complete contact profile{completeProfiles.length === 1 ? "" : "s"}</small>
            </div>
          </article>
        </section>

        <div className="drivers-workspace">
          <section className="drivers-board-card drivers-register-card">
            <div className="drivers-card-header">
              <h3>Driver Register</h3>
              <button className="drivers-table-action" type="button" onClick={openCreateModal}>
                <Plus aria-hidden="true" />
                Add Driver
              </button>
            </div>

            {props.drivers.length === 0 ? (
              <div className="drivers-empty-state">
                <Users aria-hidden="true" />
                <div>
                  <strong>No drivers added yet</strong>
                  <span>Create the first driver profile for mobile access.</span>
                </div>
              </div>
            ) : (
              <>
                <div className="drivers-table-controls">
                  <label className="drivers-search-control">
                    <Search aria-hidden="true" />
                    <input
                      type="search"
                      placeholder="Search by name, email, or phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </label>
                  <label className="drivers-select-control">
                    <span>Status</span>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option value="all">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                  <label className="drivers-select-control drivers-select-control--rows">
                    <span>Rows</span>
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

                {filteredDrivers.length === 0 ? (
                  <div className="drivers-empty-state">
                    <Search aria-hidden="true" />
                    <div>
                      <strong>No drivers match the filters</strong>
                      <span>Adjust search or status to see more records.</span>
                    </div>
                  </div>
                ) : (
                  <div className="table drivers-table">
                    <div className="table__head drivers-table__head">
                      <span>Name</span>
                      <span>Email</span>
                      <span>Phone</span>
                      <span>Status</span>
                      <span>Actions</span>
                    </div>
                    {paginatedDrivers.map((d) => (
                      <div className="table__row drivers-table__row" key={d.id}>
                        <span className="drivers-table__cell drivers-table__cell--name" data-label="Name">
                          <strong>{d.full_name || "Driver"}</strong>
                        </span>
                        <span className="drivers-table__cell" data-label="Email">{d.email || "Not recorded"}</span>
                        <span className="drivers-table__cell" data-label="Phone">{d.phone || "Not recorded"}</span>
                        <span className="drivers-table__cell drivers-table__cell--status" data-label="Status">
                          <span className={`status-badge ${statusTone(d.status)}`}>
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

                <div className="drivers-table-footer">
                  <span>Showing {filteredDrivers.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredDrivers.length)} of {filteredDrivers.length} drivers</span>
                  <div>
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Prev
                    </button>
                    <strong>{currentPage}</strong>
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>

          <aside className="drivers-insights-column" aria-label="Driver roster insights">
            <section className="drivers-board-card drivers-attention-card">
              <div className="drivers-card-header drivers-card-header--compact">
                <h3>Attention Needed</h3>
              </div>
              <div className="drivers-attention-summary">
                <button type="button" onClick={() => openFirstDriver(driverInsights.attention.missing_phone.driver_ids)}>
                  <span className="drivers-insight-icon drivers-insight-icon--danger"><Phone aria-hidden="true" /></span>
                  <span>
                    <strong>Missing Phone</strong>
                    <small>{insightPreview(driverInsights.attention.missing_phone.preview)}</small>
                  </span>
                  <b>{driverInsights.attention.missing_phone.count}</b>
                </button>
                <button type="button" onClick={() => openFirstDriver(driverInsights.attention.missing_email.driver_ids)}>
                  <span className="drivers-insight-icon drivers-insight-icon--warning"><Mail aria-hidden="true" /></span>
                  <span>
                    <strong>Missing Email</strong>
                    <small>{insightPreview(driverInsights.attention.missing_email.preview)}</small>
                  </span>
                  <b>{driverInsights.attention.missing_email.count}</b>
                </button>
                <button type="button" onClick={() => openFirstDriver(driverInsights.attention.inactive_access.driver_ids)}>
                  <span className="drivers-insight-icon drivers-insight-icon--info"><UserX aria-hidden="true" /></span>
                  <span>
                    <strong>Inactive Access</strong>
                    <small>{insightPreview(driverInsights.attention.inactive_access.preview)}</small>
                  </span>
                  <b>{driverInsights.attention.inactive_access.count}</b>
                </button>
              </div>
            </section>

            <section className="drivers-board-card drivers-signals-card">
              <div className="drivers-card-header drivers-card-header--compact">
                <h3>Dispatch Coverage</h3>
              </div>
              <div className="drivers-signal-list">
                <div>
                  <span className="drivers-insight-icon drivers-insight-icon--teal"><UserCheck aria-hidden="true" /></span>
                  <p><strong>Available Drivers</strong><small>{dispatchCoverage.available_drivers} / {dispatchCoverage.active_total} active</small></p>
                  <em>{availablePercent}%</em>
                  <i><b style={{ width: `${availablePercent}%` }} /></i>
                </div>
                <div>
                  <span className="drivers-insight-icon drivers-insight-icon--info"><Users aria-hidden="true" /></span>
                  <p><strong>Assigned Now</strong><small>{dispatchCoverage.assigned_now} active workflow driver{dispatchCoverage.assigned_now === 1 ? "" : "s"}</small></p>
                  <em>{assignedPercent}%</em>
                  <i><b style={{ width: `${assignedPercent}%` }} /></i>
                </div>
                <div>
                  <span className="drivers-insight-icon drivers-insight-icon--purple"><Phone aria-hidden="true" /></span>
                  <p><strong>Contact Ready</strong><small>{dispatchCoverage.contact_ready} / {dispatchCoverage.active_total} active</small></p>
                  <em>{contactReadyPercent}%</em>
                  <i><b style={{ width: `${contactReadyPercent}%` }} /></i>
                </div>
              </div>
            </section>

            <section className="drivers-board-card drivers-notes-card">
              <div className="drivers-card-header drivers-card-header--compact">
                <h3>Roster Cleanup</h3>
              </div>
              <div className="drivers-access-notes">
                <button type="button" onClick={() => openFirstDriver([...missingPhoneDrivers, ...missingEmailDrivers].map((driver) => driver.id))}>
                  <span className="drivers-insight-icon drivers-insight-icon--warning"><AlertCircle aria-hidden="true" /></span>
                  <p><strong>Incomplete Profiles</strong><small>{driverInsights.cleanup.incomplete_profiles} contact gap{driverInsights.cleanup.incomplete_profiles === 1 ? "" : "s"}</small></p>
                </button>
                <button type="button" onClick={() => openFirstDriver(unnamedDrivers.map((driver) => driver.id))}>
                  <span className="drivers-insight-icon drivers-insight-icon--teal"><ShieldCheck aria-hidden="true" /></span>
                  <p><strong>Missing Names</strong><small>{driverInsights.cleanup.missing_names} profile{driverInsights.cleanup.missing_names === 1 ? "" : "s"} need a display name</small></p>
                </button>
                <button type="button" onClick={() => openFirstDriver(inactiveDrivers.map((driver) => driver.id))}>
                  <span className="drivers-insight-icon drivers-insight-icon--info"><KeyRound aria-hidden="true" /></span>
                  <p><strong>Disabled Accounts</strong><small>{driverInsights.cleanup.disabled_accounts} inactive account{driverInsights.cleanup.disabled_accounts === 1 ? "" : "s"}</small></p>
                </button>
              </div>
            </section>
          </aside>
        </div>

      {showDriverModal && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--form" role="dialog" aria-modal="true" aria-label="Driver form">
            <div className="modal__header">
              <div>
                <h3>{props.editingDriverId ? "Edit Driver" : "Add Driver"}</h3>
                <p className="modal__subtle">
                  {props.editingDriverId ? "Update contact details and mobile access." : "Create a mobile account for a driver."}
                </p>
              </div>
              <button className="modal__close" type="button" onClick={closeDriverModal} aria-label="Close driver form">
                ✕
              </button>
            </div>
            <form id="driver-form" className="form form--scroll" onSubmit={handleDriverSubmit}>
              <div className="form-section-title">
                <div>
                  <h4>Account</h4>
                  <p>Name and sign-in email used by the mobile driver app.</p>
                </div>
              </div>
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
              <div className="form-section-title">
                <div>
                  <h4>Contact</h4>
                  <p>Phone details used by dispatch and manager follow-up.</p>
                </div>
              </div>
              <label>
                Phone Number
                <input
                  placeholder="e.g., 077-1234567"
                  value={props.driverPhone}
                  onChange={(e) => props.setDriverPhone(e.target.value)}
                />
              </label>
              <div className="form-section-title">
                <div>
                  <h4>Access</h4>
                  <p>Choose whether this driver can sign in and receive assignments.</p>
                </div>
              </div>
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
                <p className="modal__subtle">Contact details and account availability.</p>
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
              <div className="detail-item"><span>Access</span><strong>{(viewTarget.status || "active") === "active" ? "Can use driver app" : "Disabled"}</strong></div>
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
