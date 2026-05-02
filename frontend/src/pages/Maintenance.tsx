import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  Eye,
  FileText,
  Pencil,
  Trash2,
  Wrench,
  type LucideIcon,
} from "lucide-react";

type Vehicle = {
  id: string;
  plate_no: string;
};

type MaintenanceRecord = {
  id: string;
  vehicle_id: string;
  service_center_id?: string;
  service_booking_id?: string;
  service_date: string;
  service_type?: string;
  event_type?: string;
  event_category?: string;
  severity?: string;
  cost_lkr?: number;
  odometer_km?: number;
  next_service_due_km?: number;
  notes?: string;
};

type ServiceCenter = {
  id: string;
  name: string;
  profile_id?: string;
  phone?: string;
  address?: string;
};

type ServiceBooking = {
  id: string;
  vehicle_id?: string;
  center_id?: string;
  requested_date: string;
  status?: string;
  notes?: string;
  work_type?: string;
  service_notes?: string;
  proposed_tire_condition?: string;
  proposed_brake_condition?: string;
  proposed_battery_status?: string;
  completion_review_status?: string;
  completion_review_notes?: string;
  completion_reviewed_at?: string;
  completion_reviewed_by?: string;
  completed_at?: string;
  final_cost_lkr?: number;
  next_service_due_km?: number;
};

type MaintenanceProps = {
  vehicles: Vehicle[];
  maintenance: MaintenanceRecord[];
  centers: ServiceCenter[];
  bookings: ServiceBooking[];
  loading: boolean;
  maintVehicle: string;
  setMaintVehicle: (v: string) => void;
  maintDate: string;
  setMaintDate: (v: string) => void;
  maintType: string;
  setMaintType: (v: string) => void;
  maintEventType: string;
  setMaintEventType: (v: string) => void;
  maintEventCategory: string;
  setMaintEventCategory: (v: string) => void;
  maintSeverity: string;
  setMaintSeverity: (v: string) => void;
  maintCost: string;
  setMaintCost: (v: string) => void;
  maintOdometer: string;
  setMaintOdometer: (v: string) => void;
  maintNextDue: string;
  setMaintNextDue: (v: string) => void;
  maintNotes: string;
  setMaintNotes: (v: string) => void;
  editingMaintenanceId: string | null;
  centerName: string;
  setCenterName: (v: string) => void;
  centerPhone: string;
  setCenterPhone: (v: string) => void;
  centerAddress: string;
  setCenterAddress: (v: string) => void;
  centerPortalEmail: string;
  setCenterPortalEmail: (v: string) => void;
  centerPortalPassword: string;
  setCenterPortalPassword: (v: string) => void;
  editingCenterId: string | null;
  bookingVehicle: string;
  setBookingVehicle: (v: string) => void;
  bookingCenter: string;
  setBookingCenter: (v: string) => void;
  bookingDate: string;
  setBookingDate: (v: string) => void;
  bookingNotes: string;
  setBookingNotes: (v: string) => void;
  editingBookingId: string | null;
  onAddMaintenance: (e: FormEvent) => void;
  onEditMaintenance: (record: MaintenanceRecord) => void;
  onCancelMaintenanceEdit: () => void;
  onDeleteMaintenance: (maintenanceId: string) => Promise<void>;
  onAddCenter: (e: FormEvent) => void;
  onEditCenter: (center: ServiceCenter) => void;
  onCancelCenterEdit: () => void;
  onDeleteCenter: (centerId: string) => Promise<void>;
  onAddBooking: (e: FormEvent) => void;
  onEditBooking: (booking: ServiceBooking) => void;
  onCancelBookingEdit: () => void;
  onDeleteBooking: (bookingId: string) => Promise<void>;
  onApproveBookingCompletion: (bookingId: string) => Promise<void>;
  onRejectBookingCompletion: (bookingId: string, note: string) => Promise<void>;
};

type MaintenanceTab = "overview" | "centers" | "workflow" | "history";

type MaintenanceIconName = "records" | "centers" | "cost" | "review";

function MaintenanceIcon({ name }: { name: MaintenanceIconName }) {
  const icons: Record<MaintenanceIconName, LucideIcon> = {
    records: ClipboardList,
    centers: Building2,
    cost: CircleDollarSign,
    review: AlertTriangle,
  };
  const Icon = icons[name];
  return <Icon aria-hidden="true" />;
}

export default function Maintenance(props: MaintenanceProps) {
  const [activeTab, setActiveTab] = useState<MaintenanceTab>("overview");
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showCenterModal, setShowCenterModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [maintenanceSearch, setMaintenanceSearch] = useState("");
  const [maintenanceRowsPerPage, setMaintenanceRowsPerPage] = useState(10);
  const [maintenancePage, setMaintenancePage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceRecord | null>(null);
  const [centerSearch, setCenterSearch] = useState("");
  const [centerRowsPerPage, setCenterRowsPerPage] = useState(10);
  const [centerPage, setCenterPage] = useState(1);
  const [selectedCenter, setSelectedCenter] = useState<ServiceCenter | null>(null);
  const [deleteCenterTarget, setDeleteCenterTarget] = useState<ServiceCenter | null>(null);
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingRowsPerPage, setBookingRowsPerPage] = useState(10);
  const [bookingPage, setBookingPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<ServiceBooking | null>(null);
  const [deleteBookingTarget, setDeleteBookingTarget] = useState<ServiceBooking | null>(null);
  const [approveBookingTarget, setApproveBookingTarget] = useState<ServiceBooking | null>(null);
  const [rejectBookingTarget, setRejectBookingTarget] = useState<ServiceBooking | null>(null);
  const [rejectBookingNote, setRejectBookingNote] = useState("");

  const totalCost = props.maintenance.reduce((sum, m) => sum + (m.cost_lkr || 0), 0);

  const vehicleLabelMap = useMemo(
    () =>
      props.vehicles.reduce<Record<string, string>>((acc, vehicle) => {
        acc[vehicle.id] = vehicle.plate_no;
        return acc;
      }, {}),
    [props.vehicles]
  );

  const centerLabelMap = useMemo(
    () =>
      props.centers.reduce<Record<string, string>>((acc, center) => {
        acc[center.id] = center.name;
        return acc;
      }, {}),
    [props.centers]
  );

  const filteredMaintenance = props.maintenance.filter((record) => {
    const query = maintenanceSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      record.service_date,
      record.service_type,
      record.notes,
      record.service_booking_id ? "service booking" : "manual",
      record.service_center_id ? centerLabelMap[record.service_center_id] : "",
      record.vehicle_id ? vehicleLabelMap[record.vehicle_id] : "",
      typeof record.cost_lkr === "number" ? String(record.cost_lkr) : "",
      typeof record.next_service_due_km === "number" ? String(record.next_service_due_km) : "",
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const maintenanceTotalPages = Math.max(
    1,
    Math.ceil(filteredMaintenance.length / maintenanceRowsPerPage)
  );
  const currentMaintenancePage = Math.min(maintenancePage, maintenanceTotalPages);
  const paginatedMaintenance = filteredMaintenance.slice(
    (currentMaintenancePage - 1) * maintenanceRowsPerPage,
    currentMaintenancePage * maintenanceRowsPerPage
  );

  const filteredCenters = props.centers.filter((center) => {
    const query = centerSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      center.name,
      center.phone,
      center.address,
      center.profile_id ? "portal linked" : "portal not linked",
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const centerTotalPages = Math.max(1, Math.ceil(filteredCenters.length / centerRowsPerPage));
  const currentCenterPage = Math.min(centerPage, centerTotalPages);
  const paginatedCenters = filteredCenters.slice(
    (currentCenterPage - 1) * centerRowsPerPage,
    currentCenterPage * centerRowsPerPage
  );

  const workflowBookings = props.bookings.filter((booking) => {
    const status = booking.status || "pending";
    const reviewStatus = booking.completion_review_status || "pending";
    return status === "pending" || status === "confirmed" || (status === "completed" && reviewStatus !== "approved");
  });

  const filteredBookings = workflowBookings.filter((booking) => {
    const query = bookingSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      booking.requested_date,
      booking.status,
      booking.notes,
      booking.work_type,
      booking.service_notes,
      booking.completion_review_status,
      booking.proposed_tire_condition,
      booking.proposed_brake_condition,
      booking.proposed_battery_status,
      booking.vehicle_id ? vehicleLabelMap[booking.vehicle_id] : "",
      booking.center_id ? centerLabelMap[booking.center_id] : "",
      typeof booking.final_cost_lkr === "number" ? String(booking.final_cost_lkr) : "",
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const bookingTotalPages = Math.max(1, Math.ceil(filteredBookings.length / bookingRowsPerPage));
  const currentBookingPage = Math.min(bookingPage, bookingTotalPages);
  const paginatedBookings = filteredBookings.slice(
    (currentBookingPage - 1) * bookingRowsPerPage,
    currentBookingPage * bookingRowsPerPage
  );
  const upcomingBookings = props.bookings
    .filter((booking) => {
      const status = booking.status || "pending";
      return status === "pending" || status === "confirmed";
    })
    .sort((a, b) => a.requested_date.localeCompare(b.requested_date))
    .slice(0, 4);
  const pendingApprovalCount = workflowBookings.filter((booking) => isPendingCompletionReview(booking)).length;
  const reviewQueue = workflowBookings
    .filter((booking) => isPendingCompletionReview(booking))
    .slice(0, 4);
  const recentMaintenance = [...props.maintenance]
    .sort((a, b) => b.service_date.localeCompare(a.service_date))
    .slice(0, 5);
  const linkedCentersCount = props.centers.filter((center) => Boolean(center.profile_id)).length;

  useEffect(() => {
    setMaintenancePage(1);
  }, [maintenanceRowsPerPage, maintenanceSearch, props.maintenance.length]);

  useEffect(() => {
    setCenterPage(1);
  }, [centerRowsPerPage, centerSearch, props.centers.length]);

  useEffect(() => {
    setBookingPage(1);
  }, [bookingRowsPerPage, bookingSearch, workflowBookings.length]);

  useEffect(() => {
    if (!selectedBooking) return;
    const refreshed = props.bookings.find((booking) => booking.id === selectedBooking.id);
    if (refreshed) {
      setSelectedBooking(refreshed);
    }
  }, [props.bookings, selectedBooking]);

  useEffect(() => {
    if (!props.loading) {
      setShowMaintenanceModal(false);
      setShowCenterModal(false);
      setShowBookingModal(false);
    }
  }, [props.loading]);

  function closeMaintenanceModal() {
    setShowMaintenanceModal(false);
    if (props.editingMaintenanceId) {
      props.onCancelMaintenanceEdit();
    }
  }

  function closeCenterModal() {
    setShowCenterModal(false);
    props.onCancelCenterEdit();
  }

  function closeBookingModal() {
    setShowBookingModal(false);
    props.onCancelBookingEdit();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await props.onDeleteMaintenance(deleteTarget.id);
    setDeleteTarget(null);
  }

  async function confirmCenterDelete() {
    if (!deleteCenterTarget) return;
    await props.onDeleteCenter(deleteCenterTarget.id);
    setDeleteCenterTarget(null);
  }

  async function confirmBookingDelete() {
    if (!deleteBookingTarget) return;
    await props.onDeleteBooking(deleteBookingTarget.id);
    setDeleteBookingTarget(null);
  }

  async function confirmBookingApproval() {
    if (!approveBookingTarget) return;
    await props.onApproveBookingCompletion(approveBookingTarget.id);
    setApproveBookingTarget(null);
    setSelectedBooking((current) =>
      current && current.id === approveBookingTarget.id ? null : current
    );
  }

  async function confirmBookingRejection() {
    if (!rejectBookingTarget || !rejectBookingNote.trim()) return;
    await props.onRejectBookingCompletion(rejectBookingTarget.id, rejectBookingNote.trim());
    setRejectBookingTarget(null);
    setRejectBookingNote("");
    setSelectedBooking((current) =>
      current && current.id === rejectBookingTarget.id ? null : current
    );
  }

  function isPendingCompletionReview(booking: ServiceBooking) {
    return (booking.status || "pending") === "completed" && (booking.completion_review_status || "pending") !== "approved";
  }

  function formatReadable(value?: string) {
    if (!value) return "Not recorded";
    return value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatCurrency(value?: number) {
    return typeof value === "number" ? `Rs.${value.toLocaleString()}` : "Not recorded";
  }

  function bookingStatusLabel(booking: ServiceBooking) {
    if (isPendingCompletionReview(booking)) return "Pending approval";
    return formatReadable(booking.status || "pending");
  }

  function bookingStatusTone(booking: ServiceBooking) {
    if (isPendingCompletionReview(booking)) return "warning";
    const status = booking.status || "pending";
    if (status === "completed") return "success";
    if (status === "cancelled") return "danger";
    if (status === "confirmed") return "info";
    return "warning";
  }

  return (
    <section className="section">
      <section className="admin-page maintenance-page">
      <section className="stats stats--four admin-stats">
        <div className="stat-card stat-card--blue">
          <div className="stat-icon"><MaintenanceIcon name="records" /></div>
          <div className="stat-value">{props.maintenance.length}</div>
          <div className="stat-label">Service Records</div>
          <div className="stat-sub">Logged maintenance history</div>
        </div>
        <div className="stat-card stat-card--green">
          <div className="stat-icon"><MaintenanceIcon name="centers" /></div>
          <div className="stat-value">{props.centers.length}</div>
          <div className="stat-label">Service Centers</div>
          <div className="stat-sub">{linkedCentersCount} centers linked to portal access</div>
        </div>
        <div className="stat-card stat-card--purple">
          <div className="stat-icon"><MaintenanceIcon name="cost" /></div>
          <div className="stat-value">Rs.{totalCost.toLocaleString()}</div>
          <div className="stat-label">Total Maintenance Cost</div>
          <div className="stat-sub">Recorded service expenditure</div>
        </div>
        <div className="stat-card stat-card--amber">
          <div className="stat-icon"><MaintenanceIcon name="review" /></div>
          <div className="stat-value">{pendingApprovalCount}</div>
          <div className="stat-label">Pending Approval</div>
          <div className="stat-sub">Completed bookings waiting for manager review</div>
        </div>
      </section>

      <nav className="admin-tabs" aria-label="Maintenance sections">
        <button
          type="button"
          className={`admin-tab ${activeTab === "overview" ? "admin-tab--active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === "centers" ? "admin-tab--active" : ""}`}
          onClick={() => setActiveTab("centers")}
        >
          Service Centers
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === "workflow" ? "admin-tab--active" : ""}`}
          onClick={() => setActiveTab("workflow")}
        >
          Booking Workflow
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === "history" ? "admin-tab--active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          History
        </button>
      </nav>

      {activeTab === "overview" && (
      <div className="maintenance-workspace">
        <section className="card maintenance-panel maintenance-panel--review">
          <div className="maintenance-panel__header">
            <div>
              <span className="maintenance-panel__eyebrow">Booking review</span>
              <h3>Review Queue</h3>
              <p>Completed workshop jobs waiting for manager approval before vehicle updates are applied.</p>
            </div>
            <button className="btn btn--secondary btn--compact" type="button" onClick={() => setActiveTab("workflow")}>
              View Workflow
            </button>
          </div>
          {reviewQueue.length === 0 ? (
            <div className="maintenance-empty-state">
              <ClipboardList aria-hidden="true" />
              <div>
                <strong>No bookings waiting for approval</strong>
                <span>Completed service jobs will appear here for final review.</span>
              </div>
            </div>
          ) : (
            <div className="maintenance-review-list">
              {reviewQueue.map((booking) => (
                <button
                  className="maintenance-review-item"
                  type="button"
                  key={booking.id}
                  onClick={() => setSelectedBooking(booking)}
                >
                  <div>
                    <strong>{vehicleLabelMap[booking.vehicle_id || ""] || "Vehicle"}</strong>
                    <span>{centerLabelMap[booking.center_id || ""] || "Service center"} • {formatCurrency(booking.final_cost_lkr)}</span>
                  </div>
                  <span className="pill pill--warning">Pending approval</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="maintenance-side-stack">
          <section className="card maintenance-panel">
            <div className="maintenance-panel__header maintenance-panel__header--compact">
              <div>
                <span className="maintenance-panel__eyebrow">Actions</span>
                <h3>Service Actions</h3>
              </div>
            </div>
            <div className="maintenance-action-stack">
              <button
                className="btn"
                type="button"
                onClick={() => {
                  props.onCancelMaintenanceEdit();
                  setShowMaintenanceModal(true);
                }}
              >
                Log Maintenance
              </button>
              <button
                className="btn btn--secondary"
                type="button"
                onClick={() => {
                  props.onCancelBookingEdit();
                  setShowBookingModal(true);
                }}
              >
                Book Service
              </button>
              <button
                className="btn btn--secondary"
                type="button"
                onClick={() => {
                  props.onCancelCenterEdit();
                  setShowCenterModal(true);
                }}
              >
                Add Workshop
              </button>
            </div>
          </section>

          <section className="card maintenance-panel">
            <div className="maintenance-panel__header maintenance-panel__header--compact">
              <div>
                <span className="maintenance-panel__eyebrow">Workload</span>
                <h3>Service Snapshot</h3>
              </div>
            </div>
            <div className="maintenance-snapshot-grid">
              <div><span>Active bookings</span><strong>{workflowBookings.length}</strong></div>
              <div><span>Pending review</span><strong>{pendingApprovalCount}</strong></div>
              <div><span>Workshops</span><strong>{props.centers.length}</strong></div>
              <div><span>Portal linked</span><strong>{linkedCentersCount}</strong></div>
            </div>
          </section>
        </aside>

        <section className="card maintenance-panel">
          <div className="maintenance-panel__header">
            <div>
              <span className="maintenance-panel__eyebrow">Schedule</span>
              <h3>Upcoming Service</h3>
              <p>Confirmed and pending appointments ordered by service date.</p>
            </div>
          </div>
          {upcomingBookings.length === 0 ? (
            <div className="maintenance-empty-state">
              <CalendarClock aria-hidden="true" />
              <div>
                <strong>No upcoming service bookings</strong>
                <span>Book service work when a vehicle needs workshop attention.</span>
              </div>
            </div>
          ) : (
            <div className="maintenance-card-list">
              {upcomingBookings.map((booking) => (
                <button className="maintenance-card-row" type="button" key={booking.id} onClick={() => setSelectedBooking(booking)}>
                  <div>
                    <strong>{vehicleLabelMap[booking.vehicle_id || ""] || "Vehicle"}</strong>
                    <span>{booking.requested_date} • {centerLabelMap[booking.center_id || ""] || "Service center"}</span>
                  </div>
                  <span className={`pill pill--${bookingStatusTone(booking)}`}>{bookingStatusLabel(booking)}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card maintenance-panel">
          <div className="maintenance-panel__header">
            <div>
              <span className="maintenance-panel__eyebrow">Service history</span>
              <h3>Recent Maintenance</h3>
              <p>Latest service records by vehicle, source, and cost.</p>
            </div>
          </div>
          {recentMaintenance.length === 0 ? (
            <div className="maintenance-empty-state">
              <FileText aria-hidden="true" />
              <div>
                <strong>No maintenance history yet</strong>
                <span>Logged records will appear here after service work is completed.</span>
              </div>
            </div>
          ) : (
            <div className="maintenance-card-list">
              {recentMaintenance.map((record) => (
                <button className="maintenance-card-row" type="button" key={record.id} onClick={() => setSelectedRecord(record)}>
                  <div>
                    <strong>{vehicleLabelMap[record.vehicle_id || ""] || "Vehicle"} • {record.service_type || "Service"}</strong>
                    <span>{record.service_date} • {record.service_booking_id ? "Service booking" : "Manual record"}</span>
                  </div>
                  <span>{formatCurrency(record.cost_lkr)}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
      )}

      {activeTab === "centers" && (
      <section className="card admin-table-section admin-panel">
        <div className="card__header">
          <div>
            <h3>Registered Centers</h3>
            <p className="muted admin-card__subtitle">Search and maintain the service-center network used for workshop bookings and portal coordination.</p>
          </div>
        </div>
        {props.centers.length === 0 ? (
          <p className="empty">No service centers added yet.</p>
        ) : (
          <>
            <div className="table-controls">
              <div className="table-controls__filters">
                <label className="table-controls__label table-controls__label--search">
                  Search
                  <input
                    type="search"
                    placeholder="Center, phone, address..."
                    value={centerSearch}
                    onChange={(e) => setCenterSearch(e.target.value)}
                  />
                </label>
                <label className="table-controls__label">
                  Rows
                  <select
                    value={centerRowsPerPage}
                    onChange={(e) => setCenterRowsPerPage(Number(e.target.value))}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>
              <div className="table-pagination">
                <span className="table-pagination__meta">
                  Page {currentCenterPage} of {centerTotalPages}
                </span>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setCenterPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentCenterPage === 1}
                >
                  Prev
                </button>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setCenterPage((prev) => Math.min(centerTotalPages, prev + 1))}
                  disabled={currentCenterPage === centerTotalPages}
                >
                  Next
                </button>
              </div>
            </div>
            {filteredCenters.length === 0 ? (
              <p className="empty">No service centers match the search.</p>
            ) : (
              <div className="table centers-table" style={{ ["--table-columns" as any]: 4 }}>
                <div className="table__head centers-table__head">
                  <span>Center</span>
                  <span>Phone</span>
                  <span>Portal</span>
                  <span>Actions</span>
                </div>
                {paginatedCenters.map((center) => (
                  <div className="table__row centers-table__row" key={center.id}>
                    <span className="centers-table__cell" data-label="Center">{center.name}</span>
                    <span className="centers-table__cell" data-label="Phone">{center.phone || "--"}</span>
                    <span className="centers-table__cell" data-label="Portal">
                      <span className={`pill pill--${center.profile_id ? "success" : "warning"}`}>
                        {center.profile_id ? "Linked" : "Not Linked"}
                      </span>
                    </span>
                    <span className="table__actions centers-table__actions" data-label="Actions">
                      <button
                        className="icon-action"
                        type="button"
                        onClick={() => setSelectedCenter(center)}
                        aria-label={`View center ${center.name}`}
                        title="View center"
                      >
                        <Eye className="icon-action__svg icon-action__svg--view" aria-hidden="true" />
                      </button>
                      <button
                        className="icon-action"
                        type="button"
                        onClick={() => {
                          props.onEditCenter(center);
                          setShowCenterModal(true);
                        }}
                        aria-label={`Edit center ${center.name}`}
                        title="Edit center"
                      >
                        <Pencil className="icon-action__svg icon-action__svg--edit" aria-hidden="true" />
                      </button>
                      <button
                        className="icon-action icon-action--danger"
                        type="button"
                        onClick={() => setDeleteCenterTarget(center)}
                        disabled={props.loading}
                        aria-label={`Delete center ${center.name}`}
                        title="Delete center"
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

      {activeTab === "workflow" && (
      <section className="card admin-table-section admin-panel">
        <div className="card__header">
          <div>
            <h3>Booking Workflow</h3>
            <p className="muted admin-card__subtitle">Track active bookings, review completion updates, and approve or reject proposed vehicle changes.</p>
          </div>
        </div>
        {workflowBookings.length === 0 ? (
          <p className="empty">No active or in-review service bookings.</p>
        ) : (
          <>
            <div className="table-controls">
              <div className="table-controls__filters">
                <label className="table-controls__label table-controls__label--search">
                  Search
                  <input
                    type="search"
                    placeholder="Date, vehicle, center, status..."
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                  />
                </label>
                <label className="table-controls__label">
                  Rows
                  <select
                    value={bookingRowsPerPage}
                    onChange={(e) => setBookingRowsPerPage(Number(e.target.value))}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>
              <div className="table-pagination">
                <span className="table-pagination__meta">
                  Page {currentBookingPage} of {bookingTotalPages}
                </span>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setBookingPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentBookingPage === 1}
                >
                  Prev
                </button>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setBookingPage((prev) => Math.min(bookingTotalPages, prev + 1))}
                  disabled={currentBookingPage === bookingTotalPages}
                >
                  Next
                </button>
              </div>
            </div>
            {filteredBookings.length === 0 ? (
              <p className="empty">No workflow bookings match the search.</p>
            ) : (
              <div className="table bookings-table" style={{ ["--table-columns" as any]: 5 }}>
                <div className="table__head bookings-table__head">
                  <span>Date</span>
                  <span>Vehicle</span>
                  <span>Center</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
                {paginatedBookings.map((booking) => (
                  <div className="table__row bookings-table__row" key={booking.id}>
                    <span className="bookings-table__cell" data-label="Date">{booking.requested_date}</span>
                    <span className="bookings-table__cell" data-label="Vehicle">
                      {vehicleLabelMap[booking.vehicle_id || ""] || "--"}
                    </span>
                    <span className="bookings-table__cell" data-label="Center">
                      {centerLabelMap[booking.center_id || ""] || "--"}
                    </span>
                    <span className="bookings-table__cell" data-label="Status">
                      <span className={`pill pill--${bookingStatusTone(booking)}`}>
                        {bookingStatusLabel(booking)}
                      </span>
                    </span>
                    <span className="table__actions bookings-table__actions" data-label="Actions">
                      <button
                        className="icon-action"
                        type="button"
                        onClick={() => setSelectedBooking(booking)}
                        aria-label={`View booking ${booking.id}`}
                        title="View booking"
                      >
                        <Eye className="icon-action__svg icon-action__svg--view" aria-hidden="true" />
                      </button>
                      <button
                        className="icon-action"
                        type="button"
                        onClick={() => {
                          props.onEditBooking(booking);
                          setShowBookingModal(true);
                        }}
                        disabled={(booking.status || "pending") !== "pending"}
                        aria-label={`Edit booking ${booking.id}`}
                        title="Edit booking"
                      >
                        <Pencil className="icon-action__svg icon-action__svg--edit" aria-hidden="true" />
                      </button>
                      <button
                        className="icon-action icon-action--danger"
                        type="button"
                        onClick={() => setDeleteBookingTarget(booking)}
                        disabled={props.loading || (booking.status || "pending") !== "pending"}
                        aria-label={`Delete booking ${booking.id}`}
                        title="Delete booking"
                      >
                        <Trash2 className="icon-action__svg icon-action__svg--delete" aria-hidden="true" />
                      </button>
                      {isPendingCompletionReview(booking) && (
                        <button
                          className="btn btn--danger btn--compact booking-review-btn"
                          type="button"
                          onClick={() => {
                            setRejectBookingTarget(booking);
                            setRejectBookingNote(booking.completion_review_notes || "");
                          }}
                          disabled={props.loading}
                          aria-label={`Reject completion ${booking.id}`}
                          title="Reject completion updates"
                        >
                          Reject
                        </button>
                      )}
                      {isPendingCompletionReview(booking) && (
                        <button
                          className="btn btn--compact booking-review-btn"
                          type="button"
                          onClick={() => setApproveBookingTarget(booking)}
                          disabled={props.loading}
                          aria-label={`Approve completion ${booking.id}`}
                          title="Approve completion updates"
                        >
                          Approve
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
      )}

      {activeTab === "history" && (
      <section className="card admin-table-section admin-panel">
        <div className="card__header">
          <div>
            <h3>Maintenance History</h3>
            <p className="muted admin-card__subtitle">Review logged service records, their source, and related cost history.</p>
          </div>
        </div>
        {props.maintenance.length === 0 ? (
          <p className="empty">No maintenance records yet.</p>
        ) : (
          <>
            <div className="table-controls">
              <div className="table-controls__filters">
                <label className="table-controls__label table-controls__label--search">
                  Search
                  <input
                    type="search"
                    placeholder="Date, type, vehicle..."
                    value={maintenanceSearch}
                    onChange={(e) => setMaintenanceSearch(e.target.value)}
                  />
                </label>
                <label className="table-controls__label">
                  Rows
                  <select
                    value={maintenanceRowsPerPage}
                    onChange={(e) => setMaintenanceRowsPerPage(Number(e.target.value))}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>
              <div className="table-pagination">
                <span className="table-pagination__meta">
                  Page {currentMaintenancePage} of {maintenanceTotalPages}
                </span>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setMaintenancePage((prev) => Math.max(1, prev - 1))}
                  disabled={currentMaintenancePage === 1}
                >
                  Prev
                </button>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setMaintenancePage((prev) => Math.min(maintenanceTotalPages, prev + 1))}
                  disabled={currentMaintenancePage === maintenanceTotalPages}
                >
                  Next
                </button>
              </div>
            </div>
            {filteredMaintenance.length === 0 ? (
              <p className="empty">No maintenance records match the search.</p>
            ) : (
              <div className="table maintenance-table" style={{ ["--table-columns" as any]: 6 }}>
                <div className="table__head maintenance-table__head">
                  <span>Date</span>
                  <span>Vehicle</span>
                  <span>Service</span>
                  <span>Source</span>
                  <span>Cost</span>
                  <span>Actions</span>
                </div>
                {paginatedMaintenance.map((record) => (
                  <div className="table__row maintenance-table__row" key={record.id}>
                    <span className="maintenance-table__cell" data-label="Date">{record.service_date}</span>
                    <span className="maintenance-table__cell" data-label="Vehicle">
                      {vehicleLabelMap[record.vehicle_id || ""] || "--"}
                    </span>
                    <span className="maintenance-table__cell maintenance-table__cell--service" data-label="Service">
                      <strong>{record.service_type || "Service"}</strong>
                      <small>{[formatReadable(record.event_type), formatReadable(record.severity)].filter((value) => value !== "Not recorded").join(" • ") || "General service"}</small>
                    </span>
                    <span className="maintenance-table__cell" data-label="Source">
                      <span className={`pill ${record.service_booking_id ? "pill--info" : "pill--warning"}`}>
                        {record.service_booking_id ? "Service Booking" : "Manual"}
                      </span>
                    </span>
                    <span className="maintenance-table__cell" data-label="Cost">
                      {typeof record.cost_lkr === "number" ? `Rs.${record.cost_lkr.toLocaleString()}` : "--"}
                    </span>
                    <span className="table__actions maintenance-table__actions" data-label="Actions">
                      <button
                        className="icon-action"
                        type="button"
                        onClick={() => setSelectedRecord(record)}
                        aria-label={`View maintenance ${record.id}`}
                        title="View record"
                      >
                        <Eye className="icon-action__svg icon-action__svg--view" aria-hidden="true" />
                      </button>
                      <button
                        className="icon-action"
                        type="button"
                        onClick={() => {
                          props.onEditMaintenance(record);
                          setShowMaintenanceModal(true);
                        }}
                        aria-label={`Edit maintenance ${record.id}`}
                        title="Edit record"
                      >
                        <Pencil className="icon-action__svg icon-action__svg--edit" aria-hidden="true" />
                      </button>
                      <button
                        className="icon-action icon-action--danger"
                        type="button"
                        onClick={() => setDeleteTarget(record)}
                        disabled={props.loading}
                        aria-label={`Delete maintenance ${record.id}`}
                        title="Delete record"
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

      {showMaintenanceModal && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--wide modal--form" role="dialog" aria-modal="true" aria-label="Maintenance form">
            <div className="modal__header">
              <div>
                <h3>{props.editingMaintenanceId ? "Edit Maintenance" : "Log Maintenance"}</h3>
                <p className="modal__subtle">
                  {props.editingMaintenanceId
                    ? "Update the selected service record."
                    : "Record completed workshop work and service readings."}
                </p>
              </div>
              <button className="modal__close" type="button" onClick={closeMaintenanceModal} aria-label="Close maintenance form">
                ✕
              </button>
            </div>
            <form id="maintenance-form" className="form form--two-col form--scroll" onSubmit={props.onAddMaintenance}>
              <div className="form-section-title">
                <Wrench aria-hidden="true" />
                <div>
                  <h4>Service Details</h4>
                  <p>Select the vehicle, service date, and type of maintenance completed.</p>
                </div>
              </div>
              <label>
                Vehicle
                <select
                  value={props.maintVehicle}
                  onChange={(e) => props.setMaintVehicle(e.target.value)}
                  required
                >
                  <option value="">Select a vehicle</option>
                  {props.vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.plate_no}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Service Date
                <input
                  type="date"
                  value={props.maintDate}
                  onChange={(e) => props.setMaintDate(e.target.value)}
                  required
                />
              </label>
              <label>
                Service Type
                <input placeholder="e.g., Oil Change" value={props.maintType} onChange={(e) => props.setMaintType(e.target.value)} />
              </label>
              <label>
                Event Type
                <select value={props.maintEventType} onChange={(e) => props.setMaintEventType(e.target.value)}>
                  <option value="">Select event</option>
                  <option value="regular_service">Regular Service</option>
                  <option value="oil_change">Oil Change</option>
                  <option value="tyre_change">Tyre Change</option>
                  <option value="brake_service">Brake Service</option>
                  <option value="battery_service">Battery Service</option>
                  <option value="fuel_system_service">Fuel System Service</option>
                  <option value="repair">Repair</option>
                </select>
              </label>
              <div className="form-section-title">
                <ClipboardList aria-hidden="true" />
                <div>
                  <h4>Vehicle Condition</h4>
                  <p>Classify the service event so the vehicle history remains easy to review.</p>
                </div>
              </div>
              <label>
                Event Category
                <select value={props.maintEventCategory} onChange={(e) => props.setMaintEventCategory(e.target.value)}>
                  <option value="">Select category</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="component">Component</option>
                  <option value="repair">Repair</option>
                  <option value="inspection">Inspection</option>
                </select>
              </label>
              <label>
                Severity
                <select value={props.maintSeverity} onChange={(e) => props.setMaintSeverity(e.target.value)}>
                  <option value="">Select severity</option>
                  <option value="routine">Routine</option>
                  <option value="minor">Minor</option>
                  <option value="moderate">Moderate</option>
                  <option value="major">Major</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <div className="form-section-title">
                <CircleDollarSign aria-hidden="true" />
                <div>
                  <h4>Cost & Odometer</h4>
                  <p>Record the workshop cost and odometer readings for future service planning.</p>
                </div>
              </div>
              <label>
                Cost (LKR)
                <input
                  type="number"
                  placeholder="e.g., 25000"
                  value={props.maintCost}
                  onChange={(e) => props.setMaintCost(e.target.value)}
                />
              </label>
              <label>
                Odometer (km)
                <input
                  type="number"
                  placeholder="Current reading"
                  value={props.maintOdometer}
                  onChange={(e) => props.setMaintOdometer(e.target.value)}
                />
              </label>
              <label>
                Next Service Due (km)
                <input
                  type="number"
                  placeholder="e.g., 55000"
                  value={props.maintNextDue}
                  onChange={(e) => props.setMaintNextDue(e.target.value)}
                />
              </label>
              <div className="form-section-title">
                <FileText aria-hidden="true" />
                <div>
                  <h4>Notes</h4>
                  <p>Add any workshop findings, replaced parts, or follow-up reminders.</p>
                </div>
              </div>
              <label className="form__field--full">
                Notes
                <textarea
                  placeholder="Additional details..."
                  value={props.maintNotes}
                  onChange={(e) => props.setMaintNotes(e.target.value)}
                />
              </label>
            </form>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={closeMaintenanceModal}>
                Cancel
              </button>
              <button className="btn" type="submit" form="maintenance-form" disabled={props.loading}>
                {props.loading ? "Saving..." : props.editingMaintenanceId ? "Save Changes" : "Add Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCenterModal && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--form" role="dialog" aria-modal="true" aria-label="Service center form">
            <div className="modal__header">
              <div>
                <h3>{props.editingCenterId ? "Edit Service Center" : "Add Service Center"}</h3>
                <p className="modal__subtle">
                  {props.editingCenterId
                    ? "Update workshop details and optional portal credentials."
                    : "Register a workshop or service partner."}
                </p>
              </div>
              <button className="modal__close" type="button" onClick={closeCenterModal} aria-label="Close center form">
                ✕
              </button>
            </div>
            <form id="center-form" className="form form--scroll" onSubmit={props.onAddCenter}>
              <div className="form-section-title">
                <Building2 aria-hidden="true" />
                <div>
                  <h4>Workshop Details</h4>
                  <p>Keep the service-center contact record available for bookings and reviews.</p>
                </div>
              </div>
              <label>
                Center Name
                <input
                  placeholder="e.g., Toyota Lanka - Colombo"
                  value={props.centerName}
                  onChange={(e) => props.setCenterName(e.target.value)}
                  required
                />
              </label>
              <label>
                Phone Number
                <input
                  placeholder="e.g., 011-2345678"
                  value={props.centerPhone}
                  onChange={(e) => props.setCenterPhone(e.target.value)}
                />
              </label>
              <label>
                Address
                <input
                  placeholder="e.g., 123 Galle Road, Colombo 03"
                  value={props.centerAddress}
                  onChange={(e) => props.setCenterAddress(e.target.value)}
                />
              </label>
              <div className="form-section-title">
                <ClipboardList aria-hidden="true" />
                <div>
                  <h4>Portal Access</h4>
                  <p>Optional login details for service partners that update booking completion status.</p>
                </div>
              </div>
              <label>
                Portal Email
                <input
                  type="email"
                  placeholder={props.editingCenterId ? "Leave blank to keep current email" : "Optional service portal login"}
                  value={props.centerPortalEmail}
                  onChange={(e) => props.setCenterPortalEmail(e.target.value)}
                />
              </label>
              <label>
                Portal Password
                <input
                  type="password"
                  placeholder={props.editingCenterId ? "Leave blank to keep current password" : "Optional initial password"}
                  value={props.centerPortalPassword}
                  onChange={(e) => props.setCenterPortalPassword(e.target.value)}
                />
              </label>
            </form>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={closeCenterModal}>
                Cancel
              </button>
              <button className="btn" type="submit" form="center-form" disabled={props.loading}>
                {props.loading ? "Saving..." : props.editingCenterId ? "Save Changes" : "Add Center"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBookingModal && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--form" role="dialog" aria-modal="true" aria-label="Service booking form">
            <div className="modal__header">
              <div>
                <h3>{props.editingBookingId ? "Edit Service Booking" : "Book Service"}</h3>
                <p className="modal__subtle">
                  {props.editingBookingId
                    ? "Update the selected service appointment."
                    : "Schedule a vehicle with a registered center."}
                </p>
              </div>
              <button className="modal__close" type="button" onClick={closeBookingModal} aria-label="Close booking form">
                ✕
              </button>
            </div>
            <form id="service-booking-form" className="form form--scroll" onSubmit={props.onAddBooking}>
              <div className="form-section-title">
                <Wrench aria-hidden="true" />
                <div>
                  <h4>Vehicle</h4>
                  <p>Select the vehicle that needs workshop attention.</p>
                </div>
              </div>
              <label>
                Vehicle
                <select
                  value={props.bookingVehicle}
                  onChange={(e) => props.setBookingVehicle(e.target.value)}
                  required
                >
                  <option value="">Select a vehicle</option>
                  {props.vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.plate_no}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-section-title">
                <Building2 aria-hidden="true" />
                <div>
                  <h4>Workshop</h4>
                  <p>Choose the service center responsible for the booking.</p>
                </div>
              </div>
              <label>
                Service Center
                <select
                  value={props.bookingCenter}
                  onChange={(e) => props.setBookingCenter(e.target.value)}
                  required
                >
                  <option value="">Select a center</option>
                  {props.centers.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-section-title">
                <CalendarClock aria-hidden="true" />
                <div>
                  <h4>Schedule</h4>
                  <p>Set the preferred service date.</p>
                </div>
              </div>
              <label>
                Preferred Date
                <input
                  type="date"
                  value={props.bookingDate}
                  onChange={(e) => props.setBookingDate(e.target.value)}
                  required
                />
              </label>
              <div className="form-section-title">
                <FileText aria-hidden="true" />
                <div>
                  <h4>Request Notes</h4>
                  <p>Share the requested work or symptoms with the workshop.</p>
                </div>
              </div>
              <label>
                Notes
                <input
                  placeholder="Any special requests..."
                  value={props.bookingNotes}
                  onChange={(e) => props.setBookingNotes(e.target.value)}
                />
              </label>
            </form>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={closeBookingModal}>
                Cancel
              </button>
              <button className="btn" type="submit" form="service-booking-form" disabled={props.loading}>
                {props.loading ? "Saving..." : props.editingBookingId ? "Save Changes" : "Book Service"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedRecord && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Maintenance record details">
            <div className="modal__header">
              <div>
                <h3>Maintenance Record</h3>
                <p className="modal__subtle">Service record, cost, source, and vehicle readings.</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setSelectedRecord(null)} aria-label="Close maintenance details">
                ✕
              </button>
            </div>
            <div className="details-grid">
              <div className="detail-item"><span>Date</span><strong>{selectedRecord.service_date}</strong></div>
              <div className="detail-item"><span>Vehicle</span><strong>{vehicleLabelMap[selectedRecord.vehicle_id || ""] || "--"}</strong></div>
              <div className="detail-item"><span>Service</span><strong>{selectedRecord.service_type || "--"}</strong></div>
              <div className="detail-item"><span>Source</span><strong>{selectedRecord.service_booking_id ? "Service Booking" : "Manual"}</strong></div>
              <div className="detail-item"><span>Event Type</span><strong>{formatReadable(selectedRecord.event_type)}</strong></div>
              <div className="detail-item"><span>Category</span><strong>{formatReadable(selectedRecord.event_category)}</strong></div>
              <div className="detail-item"><span>Severity</span><strong>{formatReadable(selectedRecord.severity)}</strong></div>
              <div className="detail-item"><span>Cost</span><strong>{typeof selectedRecord.cost_lkr === "number" ? `Rs.${selectedRecord.cost_lkr.toLocaleString()}` : "--"}</strong></div>
              <div className="detail-item"><span>Service Center</span><strong>{selectedRecord.service_center_id ? centerLabelMap[selectedRecord.service_center_id] || "--" : "--"}</strong></div>
              <div className="detail-item"><span>Odometer</span><strong>{selectedRecord.odometer_km ?? "--"}</strong></div>
              <div className="detail-item"><span>Next Due (km)</span><strong>{selectedRecord.next_service_due_km ?? "--"}</strong></div>
              <div className="detail-item"><span>Linked Booking</span><strong>{selectedRecord.service_booking_id || "--"}</strong></div>
              <div className="detail-item detail-item--full"><span>Notes</span><strong>{selectedRecord.notes || "--"}</strong></div>
            </div>
          </div>
        </div>
      )}

      {selectedCenter && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Service center details">
            <div className="modal__header">
              <div>
                <h3>Service Center</h3>
                <p className="modal__subtle">Workshop contact details and portal access status.</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setSelectedCenter(null)} aria-label="Close center details">
                ✕
              </button>
            </div>
            <div className="details-grid">
              <div className="detail-item"><span>Name</span><strong>{selectedCenter.name}</strong></div>
              <div className="detail-item"><span>Phone</span><strong>{selectedCenter.phone || "--"}</strong></div>
              <div className="detail-item detail-item--full"><span>Address</span><strong>{selectedCenter.address || "--"}</strong></div>
              <div className="detail-item"><span>Portal Status</span><strong>{selectedCenter.profile_id ? "Linked" : "Not Linked"}</strong></div>
              <div className="detail-item"><span>Center ID</span><strong>{selectedCenter.id}</strong></div>
            </div>
          </div>
        </div>
      )}

      {selectedBooking && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--wide modal--details" role="dialog" aria-modal="true" aria-label="Service booking details">
            <div className="modal__header">
              <div>
                <h3>Service Booking</h3>
                <p className="modal__subtle">Booking request, workshop completion details, and review status.</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setSelectedBooking(null)} aria-label="Close booking details">
                ✕
              </button>
            </div>
            <div className="details-grid details-grid--scroll">
              <div className="detail-item"><span>Date</span><strong>{selectedBooking.requested_date}</strong></div>
              <div className="detail-item"><span>Status</span><strong>{(selectedBooking.status || "pending") === "completed" && (selectedBooking.completion_review_status || "pending") !== "approved" ? "Completed. Pending Approval" : selectedBooking.status || "pending"}</strong></div>
              <div className="detail-item"><span>Work Type</span><strong>{selectedBooking.work_type || "--"}</strong></div>
              <div className="detail-item"><span>Review Status</span><strong>{selectedBooking.completion_review_status || "--"}</strong></div>
              <div className="detail-item"><span>Vehicle</span><strong>{vehicleLabelMap[selectedBooking.vehicle_id || ""] || "--"}</strong></div>
              <div className="detail-item"><span>Center</span><strong>{centerLabelMap[selectedBooking.center_id || ""] || "--"}</strong></div>
              <div className="detail-item detail-item--full"><span>Booking Notes</span><strong>{selectedBooking.notes || "--"}</strong></div>
              <div className="detail-item detail-item--full"><span>Service Notes</span><strong>{selectedBooking.service_notes || "--"}</strong></div>
              <div className="detail-item"><span>Final Cost</span><strong>{typeof selectedBooking.final_cost_lkr === "number" ? `Rs.${selectedBooking.final_cost_lkr.toLocaleString()}` : "--"}</strong></div>
              <div className="detail-item"><span>Next Due (km)</span><strong>{typeof selectedBooking.next_service_due_km === "number" ? selectedBooking.next_service_due_km.toLocaleString() : "--"}</strong></div>
              <div className="detail-item"><span>Completed At</span><strong>{selectedBooking.completed_at || "--"}</strong></div>
              <div className="detail-item"><span>Tire Condition</span><strong>{selectedBooking.proposed_tire_condition || "--"}</strong></div>
              <div className="detail-item"><span>Brake Condition</span><strong>{selectedBooking.proposed_brake_condition || "--"}</strong></div>
              <div className="detail-item"><span>Battery Status</span><strong>{selectedBooking.proposed_battery_status || "--"}</strong></div>
              <div className="detail-item detail-item--full"><span>Review Notes</span><strong>{selectedBooking.completion_review_notes || "--"}</strong></div>
            </div>
            {isPendingCompletionReview(selectedBooking) && (
              <div className="modal__actions">
                <button
                  className="btn btn--danger"
                  type="button"
                  disabled={props.loading}
                  onClick={() => {
                    setRejectBookingTarget(selectedBooking);
                    setRejectBookingNote(selectedBooking.completion_review_notes || "");
                  }}
                >
                  Reject Updates
                </button>
                <button className="btn" type="button" disabled={props.loading} onClick={() => setApproveBookingTarget(selectedBooking)}>
                  {props.loading ? "Approving..." : "Approve Vehicle Updates"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {approveBookingTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Confirm booking approval">
            <div className="modal__header">
              <h3>Approve Vehicle Updates?</h3>
              <button className="modal__close" type="button" onClick={() => setApproveBookingTarget(null)} aria-label="Close approval dialog">
                ✕
              </button>
            </div>
            <p className="muted">
              Approving this completed booking will write the linked maintenance record and apply the proposed vehicle updates for{" "}
              <strong>{vehicleLabelMap[approveBookingTarget.vehicle_id || ""] || "Vehicle"}</strong>.
            </p>
            <div className="details-grid maintenance-review-summary">
              <div className="detail-item"><span>Vehicle</span><strong>{vehicleLabelMap[approveBookingTarget.vehicle_id || ""] || "Vehicle"}</strong></div>
              <div className="detail-item"><span>Workshop</span><strong>{centerLabelMap[approveBookingTarget.center_id || ""] || "Service center"}</strong></div>
              <div className="detail-item"><span>Final Cost</span><strong>{formatCurrency(approveBookingTarget.final_cost_lkr)}</strong></div>
              <div className="detail-item"><span>Next Due</span><strong>{typeof approveBookingTarget.next_service_due_km === "number" ? `${approveBookingTarget.next_service_due_km.toLocaleString()} km` : "Not recorded"}</strong></div>
              <div className="detail-item"><span>Tyres</span><strong>{approveBookingTarget.proposed_tire_condition || "Not recorded"}</strong></div>
              <div className="detail-item"><span>Brakes</span><strong>{approveBookingTarget.proposed_brake_condition || "Not recorded"}</strong></div>
              <div className="detail-item detail-item--full"><span>Service Notes</span><strong>{approveBookingTarget.service_notes || "Not recorded"}</strong></div>
            </div>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={() => setApproveBookingTarget(null)}>
                Cancel
              </button>
              <button className="btn" type="button" onClick={confirmBookingApproval} disabled={props.loading}>
                {props.loading ? "Approving..." : "Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectBookingTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Reject booking approval">
            <div className="modal__header">
              <h3>Reject Vehicle Updates?</h3>
              <button className="modal__close" type="button" onClick={() => {
                setRejectBookingTarget(null);
                setRejectBookingNote("");
              }} aria-label="Close rejection dialog">
                ✕
              </button>
            </div>
            <label>
              Rejection Reason
              <textarea
                placeholder="Explain what needs to be corrected before approval..."
                value={rejectBookingNote}
                onChange={(e) => setRejectBookingNote(e.target.value)}
              />
            </label>
            <div className="details-grid maintenance-review-summary">
              <div className="detail-item"><span>Vehicle</span><strong>{vehicleLabelMap[rejectBookingTarget.vehicle_id || ""] || "Vehicle"}</strong></div>
              <div className="detail-item"><span>Workshop</span><strong>{centerLabelMap[rejectBookingTarget.center_id || ""] || "Service center"}</strong></div>
              <div className="detail-item"><span>Final Cost</span><strong>{formatCurrency(rejectBookingTarget.final_cost_lkr)}</strong></div>
              <div className="detail-item"><span>Next Due</span><strong>{typeof rejectBookingTarget.next_service_due_km === "number" ? `${rejectBookingTarget.next_service_due_km.toLocaleString()} km` : "Not recorded"}</strong></div>
              <div className="detail-item detail-item--full"><span>Service Notes</span><strong>{rejectBookingTarget.service_notes || "Not recorded"}</strong></div>
            </div>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={() => {
                setRejectBookingTarget(null);
                setRejectBookingNote("");
              }}>
                Cancel
              </button>
              <button className="btn btn--danger" type="button" onClick={confirmBookingRejection} disabled={props.loading || !rejectBookingNote.trim()}>
                {props.loading ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Confirm delete">
            <div className="modal__header">
              <h3>Delete Maintenance Record?</h3>
              <button className="modal__close" type="button" onClick={() => setDeleteTarget(null)} aria-label="Close delete dialog">
                ✕
              </button>
            </div>
            <p className="muted">
              Are you sure you want to delete this maintenance record for <strong>{vehicleLabelMap[deleteTarget.vehicle_id || ""] || "Vehicle"}</strong>? This action cannot be undone.
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

      {deleteCenterTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Confirm center delete">
            <div className="modal__header">
              <h3>Delete Service Center?</h3>
              <button className="modal__close" type="button" onClick={() => setDeleteCenterTarget(null)} aria-label="Close center delete dialog">
                ✕
              </button>
            </div>
            <p className="muted">
              Are you sure you want to delete <strong>{deleteCenterTarget.name}</strong>? Any linked service-center login will also be removed.
            </p>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={() => setDeleteCenterTarget(null)}>
                Cancel
              </button>
              <button className="btn btn--danger" type="button" onClick={confirmCenterDelete} disabled={props.loading}>
                {props.loading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteBookingTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Confirm booking delete">
            <div className="modal__header">
              <h3>Delete Service Booking?</h3>
              <button className="modal__close" type="button" onClick={() => setDeleteBookingTarget(null)} aria-label="Close booking delete dialog">
                ✕
              </button>
            </div>
            <p className="muted">
              Are you sure you want to delete this service booking for <strong>{vehicleLabelMap[deleteBookingTarget.vehicle_id || ""] || "Vehicle"}</strong>?
            </p>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={() => setDeleteBookingTarget(null)}>
                Cancel
              </button>
              <button className="btn btn--danger" type="button" onClick={confirmBookingDelete} disabled={props.loading}>
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
