import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Clock3, Eye, Pencil, RotateCcw, Wrench } from "lucide-react";
import { apiGet, apiPatch } from "../services/api";

type ServicePortalProps = {
  token?: string;
  initialTab?: "dashboard" | "bookings";
};

type ServicePortalMe = {
  center: {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    profile_id?: string;
  };
  summary: {
    pending_count: number;
    confirmed_count: number;
    completed_today_count: number;
    total_completed_count: number;
  };
};

type ServicePortalBooking = {
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
  completed_at?: string;
  final_cost_lkr?: number;
  next_service_due_km?: number;
  vehicle_plate_no?: string;
  vehicle_make?: string;
  vehicle_model?: string;
};

const statusBadgeClass: Record<string, string> = {
  pending: "warning",
  confirmed: "info",
  completed: "success",
  cancelled: "danger",
};

const workTypeOptions = [
  "Full Service",
  "Oil Change",
  "Brake Repair",
  "Tire Replacement",
  "Battery Replacement",
  "Engine Check",
  "AC Service",
];

function vehicleLabel(booking: ServicePortalBooking) {
  const displayName = [booking.vehicle_make, booking.vehicle_model].filter(Boolean).join(" ");
  if (displayName && booking.vehicle_plate_no) return `${displayName} • ${booking.vehicle_plate_no}`;
  return displayName || booking.vehicle_plate_no || "Vehicle";
}

function vehicleName(booking: ServicePortalBooking) {
  return [booking.vehicle_make, booking.vehicle_model].filter(Boolean).join(" ") || "Vehicle details not recorded";
}

function vehiclePlate(booking: ServicePortalBooking) {
  return booking.vehicle_plate_no || "Plate not recorded";
}

function displayText(value: unknown, fallback = "Not recorded") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function formatStatus(value?: string) {
  return displayText(value || "pending").replace(/_/g, " ");
}

function formatReviewStatus(value?: string) {
  return value ? value.replace(/_/g, " ") : "Review pending";
}

function formatCurrency(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "Not recorded";
  return `Rs. ${number.toLocaleString()}`;
}

function formatOdometer(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "Not recorded";
  return `${number.toLocaleString()} km`;
}

function resolveWorkTypeSelection(value?: string) {
  const normalized = (value || "").trim();
  if (!normalized) {
    return { selected: "", custom: "" };
  }
  if (workTypeOptions.includes(normalized)) {
    return { selected: normalized, custom: "" };
  }
  return { selected: "Other", custom: normalized };
}

type ServicePortalIconName = "pending" | "confirmed" | "completedToday" | "completedTotal";

function ServicePortalIcon({ name }: { name: ServicePortalIconName }) {
  const icons = {
    pending: Clock3,
    confirmed: ClipboardCheck,
    completedToday: CheckCircle2,
    completedTotal: Wrench,
  };
  const Icon = icons[name];
  return <Icon aria-hidden="true" />;
}

export default function ServicePortal({ token, initialTab = "dashboard" }: ServicePortalProps) {
  const [me, setMe] = useState<ServicePortalMe | null>(null);
  const [bookings, setBookings] = useState<ServicePortalBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "confirmed" | "completed" | "cancelled">("all");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<ServicePortalBooking | null>(null);
  const [editingBooking, setEditingBooking] = useState<ServicePortalBooking | null>(null);
  const [editMode, setEditMode] = useState<"transition" | "details">("transition");
  const [nextStatus, setNextStatus] = useState<"pending" | "confirmed" | "cancelled" | "completed">("confirmed");
  const [selectedWorkType, setSelectedWorkType] = useState("");
  const [customWorkType, setCustomWorkType] = useState("");
  const [serviceNotes, setServiceNotes] = useState("");
  const [finalCost, setFinalCost] = useState("");
  const [nextServiceDueKm, setNextServiceDueKm] = useState("");
  const [proposedTireCondition, setProposedTireCondition] = useState("");
  const [proposedBrakeCondition, setProposedBrakeCondition] = useState("");
  const [proposedBatteryStatus, setProposedBatteryStatus] = useState("");

  async function loadPortal() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [meData, bookingData] = await Promise.all([
        apiGet<ServicePortalMe>("/service-portal/me", token),
        apiGet<ServicePortalBooking[]>("/service-portal/bookings", token),
      ]);
      setMe(meData);
      setBookings(bookingData);
    } catch (err: any) {
      setError(err.message || "Failed to load service portal");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPortal();
  }, [token]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, rowsPerPage, bookings.length]);

  const filteredBookings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return bookings.filter((booking) => {
      const statusMatches = statusFilter === "all" ? true : (booking.status || "pending") === statusFilter;
      if (!statusMatches) return false;
      if (!query) return true;
      return [
        booking.requested_date,
        booking.status,
        booking.notes,
        booking.work_type,
        booking.service_notes,
        vehicleLabel(booking),
        typeof booking.final_cost_lkr === "number" ? String(booking.final_cost_lkr) : "",
        typeof booking.next_service_due_km === "number" ? String(booking.next_service_due_km) : "",
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [bookings, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const visibleBookings = filteredBookings.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );
  const effectiveWorkType = selectedWorkType === "Other" ? customWorkType.trim() : selectedWorkType;
  const isOverviewTab = initialTab === "dashboard";
  const pendingBookings = useMemo(
    () => bookings.filter((booking) => (booking.status || "pending") === "pending"),
    [bookings]
  );
  const confirmedBookings = useMemo(
    () => bookings.filter((booking) => booking.status === "confirmed"),
    [bookings]
  );
  const completedBookings = useMemo(
    () => bookings.filter((booking) => booking.status === "completed"),
    [bookings]
  );
  const needsManagerReviewCount = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          (booking.status || "pending") === "completed" &&
          (booking.completion_review_status || "pending") !== "approved"
      ).length,
    [bookings]
  );
  const upcomingQueue = useMemo(
    () =>
      [...pendingBookings, ...confirmedBookings]
        .sort((a, b) => String(a.requested_date).localeCompare(String(b.requested_date)))
        .slice(0, 5),
    [pendingBookings, confirmedBookings]
  );
  const latestCompleted = useMemo(
    () =>
      [...completedBookings]
        .sort((a, b) => String(b.completed_at || b.requested_date).localeCompare(String(a.completed_at || a.requested_date)))
        .slice(0, 4),
    [completedBookings]
  );
  const completedAwaitingReview = useMemo(
    () =>
      completedBookings
        .filter((booking) => (booking.completion_review_status || "pending") !== "approved")
        .sort((a, b) => String(b.completed_at || b.requested_date).localeCompare(String(a.completed_at || a.requested_date)))
        .slice(0, 5),
    [completedBookings]
  );
  const sortedPendingBookings = useMemo(
    () => [...pendingBookings].sort((a, b) => String(a.requested_date).localeCompare(String(b.requested_date))).slice(0, 5),
    [pendingBookings]
  );
  const sortedConfirmedBookings = useMemo(
    () => [...confirmedBookings].sort((a, b) => String(a.requested_date).localeCompare(String(b.requested_date))).slice(0, 5),
    [confirmedBookings]
  );
  const nextActionLabel =
    (me?.summary.pending_count ?? 0) > 0
      ? "Review pending bookings"
      : (me?.summary.confirmed_count ?? 0) > 0
        ? "Close active jobs"
        : "Queue is clear";

  function openActionModal(booking: ServicePortalBooking, status: "pending" | "confirmed" | "cancelled" | "completed") {
    const workTypeState = resolveWorkTypeSelection(booking.work_type);
    setEditingBooking(booking);
    setEditMode("transition");
    setNextStatus(status);
    setSelectedWorkType(workTypeState.selected);
    setCustomWorkType(workTypeState.custom);
    setServiceNotes(booking.service_notes || "");
    setFinalCost(typeof booking.final_cost_lkr === "number" ? String(booking.final_cost_lkr) : "");
    setNextServiceDueKm(typeof booking.next_service_due_km === "number" ? String(booking.next_service_due_km) : "");
    setProposedTireCondition(booking.proposed_tire_condition || "");
    setProposedBrakeCondition(booking.proposed_brake_condition || "");
    setProposedBatteryStatus(booking.proposed_battery_status || "");
  }

  function openDetailsModal(booking: ServicePortalBooking) {
    const workTypeState = resolveWorkTypeSelection(booking.work_type);
    setEditingBooking(booking);
    setEditMode("details");
    setNextStatus((booking.status as "confirmed" | "cancelled" | "completed") || "confirmed");
    setSelectedWorkType(workTypeState.selected);
    setCustomWorkType(workTypeState.custom);
    setServiceNotes(booking.service_notes || "");
    setFinalCost(typeof booking.final_cost_lkr === "number" ? String(booking.final_cost_lkr) : "");
    setNextServiceDueKm(typeof booking.next_service_due_km === "number" ? String(booking.next_service_due_km) : "");
    setProposedTireCondition(booking.proposed_tire_condition || "");
    setProposedBrakeCondition(booking.proposed_brake_condition || "");
    setProposedBatteryStatus(booking.proposed_battery_status || "");
  }

  function closeActionModal() {
    setEditingBooking(null);
    setEditMode("transition");
    setSelectedWorkType("");
    setCustomWorkType("");
    setServiceNotes("");
    setFinalCost("");
    setNextServiceDueKm("");
    setProposedTireCondition("");
    setProposedBrakeCondition("");
    setProposedBatteryStatus("");
  }

  async function submitBookingUpdate() {
    if (!token || !editingBooking) return;
    const currentStatus = editingBooking.status || "pending";
    const requiresFinalCost =
      (editMode === "transition" && nextStatus === "completed") ||
      (editMode === "details" && currentStatus === "completed");

    if (requiresFinalCost && !finalCost.trim()) {
      setError("Final cost is required when marking a booking as completed.");
      return;
    }
    if (
      (((editMode === "transition" && nextStatus === "completed") ||
        (editMode === "details" && currentStatus === "completed")) &&
        !effectiveWorkType)
    ) {
      setError("Work type is required for completed bookings.");
      return;
    }
    if (editMode === "transition" && currentStatus === "confirmed" && nextStatus === "pending" && !serviceNotes.trim()) {
      setError("A service note is required when moving a confirmed booking back to pending.");
      return;
    }
    if (editMode === "transition" && currentStatus === "completed" && nextStatus === "confirmed" && !serviceNotes.trim()) {
      setError("A service note is required when reopening a completed booking.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload =
        editMode === "details"
          ? {
              work_type: effectiveWorkType || undefined,
              service_notes: serviceNotes || undefined,
              final_cost_lkr: currentStatus === "completed" && finalCost ? Number(finalCost) : undefined,
              next_service_due_km:
                currentStatus === "completed" && nextServiceDueKm ? Number(nextServiceDueKm) : undefined,
              proposed_tire_condition: currentStatus === "completed" ? proposedTireCondition || undefined : undefined,
              proposed_brake_condition: currentStatus === "completed" ? proposedBrakeCondition || undefined : undefined,
              proposed_battery_status: currentStatus === "completed" ? proposedBatteryStatus || undefined : undefined,
            }
          : {
              status: nextStatus,
              work_type: nextStatus === "completed" ? effectiveWorkType || undefined : undefined,
              service_notes: serviceNotes || undefined,
              proposed_tire_condition: nextStatus === "completed" ? proposedTireCondition || undefined : undefined,
              proposed_brake_condition: nextStatus === "completed" ? proposedBrakeCondition || undefined : undefined,
              proposed_battery_status: nextStatus === "completed" ? proposedBatteryStatus || undefined : undefined,
              final_cost_lkr: nextStatus === "completed" && finalCost ? Number(finalCost) : undefined,
              next_service_due_km: nextStatus === "completed" && nextServiceDueKm ? Number(nextServiceDueKm) : undefined,
            };
      const updated = await apiPatch<ServicePortalBooking>(
        `/service-portal/bookings/${editingBooking.id}`,
        payload,
        token
      );
      setBookings((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      closeActionModal();
      await loadPortal();
    } catch (err: any) {
      setError(err.message || "Failed to update booking");
    } finally {
      setSaving(false);
    }
  }

  function bookingNote(booking: ServicePortalBooking) {
    return displayText(booking.service_notes || booking.notes, "No notes recorded");
  }

  function bookingWork(booking: ServicePortalBooking) {
    return displayText(booking.work_type, "Work type not recorded");
  }

  function renderBookingActions(booking: ServicePortalBooking, compact = false) {
    const status = booking.status || "pending";
    return (
      <span className={`service-job-actions${compact ? " service-job-actions--compact" : ""}`}>
        {status === "pending" && (
          <>
            <button className="btn btn--secondary btn--compact" type="button" onClick={() => openActionModal(booking, "confirmed")}>
              Accept
            </button>
            <button className="btn btn--danger btn--compact" type="button" onClick={() => openActionModal(booking, "cancelled")}>
              Cancel
            </button>
          </>
        )}
        {status === "confirmed" && (
          <>
            <button className="btn btn--compact" type="button" onClick={() => openActionModal(booking, "completed")}>
              Complete Job
            </button>
            <button className="btn btn--secondary btn--compact" type="button" onClick={() => openActionModal(booking, "pending")}>
              Mark Pending
            </button>
          </>
        )}
        {status === "completed" && (
          <>
            <button className="btn btn--secondary btn--compact" type="button" onClick={() => openDetailsModal(booking)}>
              Update Details
            </button>
            <button className="btn btn--secondary btn--compact" type="button" onClick={() => openActionModal(booking, "confirmed")}>
              Reopen
            </button>
          </>
        )}
      </span>
    );
  }

  function renderJobCard(booking: ServicePortalBooking) {
    return (
      <li className="service-job-card" key={booking.id}>
        <div className="service-job-card__main">
          <div>
            <span className="service-job-card__plate">{vehiclePlate(booking)}</span>
            <strong>{vehicleName(booking)}</strong>
          </div>
          <span className={`pill pill--${statusBadgeClass[booking.status || "pending"] || "warning"}`}>
            {formatStatus(booking.status)}
          </span>
        </div>
        <div className="service-job-card__meta">
          <span>{booking.requested_date}</span>
          <span>{bookingWork(booking)}</span>
        </div>
        <p>{bookingNote(booking)}</p>
        {renderBookingActions(booking)}
      </li>
    );
  }

  return (
    <section className="section">
      {error && (
        <div className="alert alert--error">
          <span>{error}</span>
          <button className="alert__close" type="button" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}

      <section className="service-portal-page admin-page service-workspace">
      {isOverviewTab ? (
        <>
          <section className="service-command-panel">
            <div className="service-command-panel__header">
              <div>
                <span className="service-command-panel__eyebrow">Workshop operations</span>
                <h3>Today&apos;s Workshop Queue</h3>
                <p>Accept incoming requests, complete active jobs, and keep finished work ready for manager review.</p>
              </div>
              <div className="service-command-panel__status">
                <strong>{nextActionLabel}</strong>
                <span>Next action</span>
              </div>
            </div>
            <div className="service-command-panel__metrics" aria-label="Workshop queue summary">
              <div className="service-command-metric service-command-metric--amber">
                <ServicePortalIcon name="pending" />
                <span>New Requests</span>
                <strong>{me?.summary.pending_count ?? 0}</strong>
              </div>
              <div className="service-command-metric service-command-metric--blue">
                <ServicePortalIcon name="confirmed" />
                <span>Accepted Jobs</span>
                <strong>{me?.summary.confirmed_count ?? 0}</strong>
              </div>
              <div className="service-command-metric service-command-metric--green">
                <ServicePortalIcon name="completedToday" />
                <span>Closed Today</span>
                <strong>{me?.summary.completed_today_count ?? 0}</strong>
              </div>
              <div className="service-command-metric service-command-metric--purple">
                <ServicePortalIcon name="completedTotal" />
                <span>Manager Review</span>
                <strong>{needsManagerReviewCount}</strong>
              </div>
            </div>
          </section>

          <section className="card service-pipeline-card">
            <div className="card__header">
              <div>
                <h3>Job Pipeline</h3>
                <p className="muted admin-card__subtitle">Bookings grouped by the action the workshop team needs to take next.</p>
              </div>
            </div>
            <div className="service-pipeline-grid">
              <div className="service-pipeline-column">
                <div className="service-pipeline-column__header">
                  <span>New Requests</span>
                  <strong>{pendingBookings.length}</strong>
                </div>
                {sortedPendingBookings.length === 0 ? (
                  <p className="empty">No new service requests waiting.</p>
                ) : (
                  <ul className="service-job-list">{sortedPendingBookings.map(renderJobCard)}</ul>
                )}
              </div>
              <div className="service-pipeline-column">
                <div className="service-pipeline-column__header">
                  <span>Accepted Jobs</span>
                  <strong>{confirmedBookings.length}</strong>
                </div>
                {sortedConfirmedBookings.length === 0 ? (
                  <p className="empty">No accepted jobs in progress.</p>
                ) : (
                  <ul className="service-job-list">{sortedConfirmedBookings.map(renderJobCard)}</ul>
                )}
              </div>
              <div className="service-pipeline-column">
                <div className="service-pipeline-column__header">
                  <span>Completed Awaiting Review</span>
                  <strong>{needsManagerReviewCount}</strong>
                </div>
                {completedAwaitingReview.length === 0 ? (
                  <p className="empty">No completed jobs waiting for review.</p>
                ) : (
                  <ul className="service-job-list">{completedAwaitingReview.map(renderJobCard)}</ul>
                )}
              </div>
            </div>
          </section>

          <section className="card service-recent-card">
            <div className="card__header">
              <div>
                <h3>Recently Completed</h3>
                <p className="muted admin-card__subtitle">Latest closed jobs with cost and manager-review status.</p>
              </div>
            </div>
            {latestCompleted.length === 0 ? (
              <p className="empty">No completed service jobs recorded yet.</p>
            ) : (
              <ul className="service-recent-list">
                {latestCompleted.map((booking) => (
                  <li className="service-recent-row" key={booking.id}>
                    <div>
                      <strong>{vehicleLabel(booking)}</strong>
                      <span>{booking.completed_at || booking.requested_date}</span>
                    </div>
                    <div>
                      <strong>{formatCurrency(booking.final_cost_lkr)}</strong>
                      <span>{formatReviewStatus(booking.completion_review_status)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <>
          <div className="stats stats--three admin-stats">
            <div className="stat-card stat-card--blue">
              <div className="stat-value">{filteredBookings.length}</div>
              <div className="stat-label">Current View</div>
              <div className="stat-sub">Bookings in the current working set</div>
            </div>
            <div className="stat-card stat-card--amber">
              <div className="stat-value">{me?.summary.pending_count ?? 0}</div>
              <div className="stat-label">New Requests</div>
              <div className="stat-sub">Still need accept or cancel action</div>
            </div>
            <div className="stat-card stat-card--purple">
              <div className="stat-value">{needsManagerReviewCount}</div>
              <div className="stat-label">Awaiting Review</div>
              <div className="stat-sub">Completed bookings still pending manager approval</div>
            </div>
          </div>

          <section className="card service-portal-table-card">
            <div className="card__header">
              <div>
                <h3>Booking Queue</h3>
                <p className="muted admin-card__subtitle">Accept requests, close completed work, and update assigned service jobs.</p>
              </div>
            </div>

            <div className="table-controls">
              <div className="table-controls__filters">
                <label className="table-controls__label table-controls__label--search">
                  Search
                  <input
                    type="search"
                    placeholder="Vehicle, date, work, notes..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label className="table-controls__label">
                  Status
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
                <label className="table-controls__label">
                  Rows
                  <select value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))}>
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

            {loading ? (
              <p className="empty">Loading bookings...</p>
            ) : filteredBookings.length === 0 ? (
              <p className="empty">No bookings match the current search/filter.</p>
            ) : (
              <div className="table service-portal-table" style={{ ["--table-columns" as any]: 6 }}>
                <div className="table__head service-portal-table__head">
                  <span>Date</span>
                  <span>Vehicle</span>
                  <span>Plate</span>
                  <span>Status</span>
                  <span>Notes</span>
                  <span>Actions</span>
                </div>
                {visibleBookings.map((booking) => (
                  <div key={booking.id} className="table__row service-portal-table__row">
                    <span className="service-portal-table__cell" data-label="Date">{booking.requested_date}</span>
                    <span className="service-portal-table__cell" data-label="Vehicle">{vehicleName(booking)}</span>
                    <span className="service-portal-table__cell" data-label="Plate">{vehiclePlate(booking)}</span>
                    <span className="service-portal-table__cell" data-label="Status">
                      <span className={`pill pill--${statusBadgeClass[booking.status || "pending"] || "warning"}`}>
                        {formatStatus(booking.status)}
                      </span>
                    </span>
                    <span className="service-portal-table__cell" data-label="Notes">
                      {booking.service_notes || booking.notes ? (
                        <span className="service-portal-table__notes">
                          {String(booking.service_notes || booking.notes).length > 48
                            ? `${String(booking.service_notes || booking.notes).slice(0, 48)}...`
                            : String(booking.service_notes || booking.notes)}
                        </span>
                      ) : (
                        <span className="service-portal-table__empty">No notes recorded</span>
                      )}
                    </span>
                    <span className="table__actions service-portal-table__actions" data-label="Actions">
                      <span className="service-portal-table__icon-group">
                        <button className="icon-action" type="button" onClick={() => setSelectedBooking(booking)} title="View booking" aria-label="View booking">
                          <Eye className="icon-action__svg icon-action__svg--view" aria-hidden="true" />
                        </button>
                        {(booking.status === "confirmed" || (booking.status === "completed" && booking.completion_review_status !== "approved")) && (
                          <button className="icon-action" type="button" onClick={() => openDetailsModal(booking)} title="Update details" aria-label="Update details">
                            <Pencil className="icon-action__svg icon-action__svg--edit" aria-hidden="true" />
                          </button>
                        )}
                        {booking.status === "confirmed" && (
                          <button className="icon-action" type="button" onClick={() => openActionModal(booking, "pending")} title="Mark pending" aria-label="Mark pending">
                            <RotateCcw className="icon-action__svg icon-action__svg--undo" aria-hidden="true" />
                          </button>
                        )}
                      </span>
                      {(booking.status || "pending") === "pending" && (
                        <span className="service-portal-table__action-group service-portal-table__action-group--pending">
                          <button className="btn btn--secondary btn--compact service-portal-table__action-btn service-portal-table__action-btn--pending" type="button" onClick={() => openActionModal(booking, "confirmed")}>
                            Accept
                          </button>
                          <button className="btn btn--danger btn--compact service-portal-table__action-btn service-portal-table__action-btn--pending" type="button" onClick={() => openActionModal(booking, "cancelled")}>
                            Cancel
                          </button>
                        </span>
                      )}
                      {booking.status === "confirmed" && (
                        <span className="service-portal-table__action-group service-portal-table__action-group--single">
                          <button className="btn btn--compact service-portal-table__action-btn" type="button" onClick={() => openActionModal(booking, "completed")}>
                            Complete Job
                          </button>
                        </span>
                      )}
                      {booking.status === "completed" && (
                        <span className="service-portal-table__action-group service-portal-table__action-group--single">
                          <button className="btn btn--secondary btn--compact service-portal-table__action-btn" type="button" onClick={() => openActionModal(booking, "confirmed")}>
                            Reopen
                          </button>
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      </section>

      {selectedBooking && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--wide modal--details" role="dialog" aria-modal="true" aria-label="Service booking details">
            <div className="modal__header">
              <div>
                <h3>Service Record Summary</h3>
                <p className="modal__subtle">Vehicle request, workshop notes, service outcome, and manager review state.</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setSelectedBooking(null)} aria-label="Close booking details">
                ✕
              </button>
            </div>
            <div className="details-grid details-grid--scroll">
              <div className="detail-item"><span>Vehicle</span><strong>{vehicleLabel(selectedBooking)}</strong></div>
              <div className="detail-item"><span>Requested Date</span><strong>{selectedBooking.requested_date}</strong></div>
              <div className="detail-item"><span>Status</span><strong>{formatStatus(selectedBooking.status)}</strong></div>
              <div className="detail-item"><span>Work Type</span><strong>{displayText(selectedBooking.work_type)}</strong></div>
              <div className="detail-item"><span>Completed At</span><strong>{displayText(selectedBooking.completed_at)}</strong></div>
              <div className="detail-item detail-item--full"><span>Booking Notes</span><strong>{displayText(selectedBooking.notes, "No notes recorded")}</strong></div>
              <div className="detail-item detail-item--full"><span>Service Notes</span><strong>{displayText(selectedBooking.service_notes, "No service notes recorded")}</strong></div>
              <div className="detail-item"><span>Final Cost</span><strong>{formatCurrency(selectedBooking.final_cost_lkr)}</strong></div>
              <div className="detail-item"><span>Next Due</span><strong>{formatOdometer(selectedBooking.next_service_due_km)}</strong></div>
              <div className="detail-item"><span>Tire Condition</span><strong>{displayText(selectedBooking.proposed_tire_condition)}</strong></div>
              <div className="detail-item"><span>Brake Condition</span><strong>{displayText(selectedBooking.proposed_brake_condition)}</strong></div>
              <div className="detail-item"><span>Battery Status</span><strong>{displayText(selectedBooking.proposed_battery_status)}</strong></div>
              <div className="detail-item"><span>Review Status</span><strong>{formatReviewStatus(selectedBooking.completion_review_status)}</strong></div>
            </div>
          </div>
        </div>
      )}

      {editingBooking && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--wide modal--form" role="dialog" aria-modal="true" aria-label="Update booking">
            <div className="modal__header">
              <div>
                <h3>
                  {editMode === "details"
                    ? "Edit Service Details"
                    : nextStatus === "pending"
                      ? "Move Back to Pending"
                    : nextStatus === "confirmed"
                      ? editingBooking.status === "completed"
                        ? "Reopen Booking"
                        : "Confirm Booking"
                      : nextStatus === "cancelled"
                        ? "Cancel Booking"
                        : "Complete Booking"}
                </h3>
                <p className="modal__subtle">{vehicleLabel(editingBooking)}</p>
              </div>
              <button className="modal__close" type="button" onClick={closeActionModal} aria-label="Close update booking">
                ✕
              </button>
            </div>
            <div className="form form--two-col form--scroll service-update-form">
              <div className="service-form-section service-form-section--full">
                <div className="service-form-section__header">
                  <span>Service Outcome</span>
                  <strong>{formatStatus(editMode === "transition" ? nextStatus : editingBooking.status)}</strong>
                </div>
                <div className="service-form-section__grid">
                  {((editMode === "details" && editingBooking.status === "completed") || nextStatus === "completed") && (
                    <label>
                      Work Type
                      <select
                        value={selectedWorkType}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedWorkType(value);
                          if (value !== "Other") {
                            setCustomWorkType("");
                          }
                        }}
                      >
                        <option value="">Select work type</option>
                        {workTypeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                        <option value="Other">Other</option>
                      </select>
                    </label>
                  )}
                  {((editMode === "details" && editingBooking.status === "completed") || nextStatus === "completed") &&
                  selectedWorkType === "Other" ? (
                    <label>
                      Other Work Type
                      <input
                        type="text"
                        placeholder="Enter work type"
                        value={customWorkType}
                        onChange={(e) => setCustomWorkType(e.target.value)}
                      />
                    </label>
                  ) : null}
                  <label className="form__field--full">
                    Service Notes
                    <textarea
                      placeholder={
                        editMode === "details"
                          ? "Update service notes for this booking..."
                          : nextStatus === "pending"
                            ? "Explain why this confirmed booking is being marked pending again..."
                            : nextStatus === "completed"
                              ? "Summarize completed service work..."
                            : nextStatus === "confirmed" && editingBooking.status === "completed"
                              ? "Explain why this completed booking is being reopened..."
                            : nextStatus === "cancelled"
                              ? "Explain why this booking is being cancelled..."
                              : "Add confirmation notes for this booking..."
                      }
                      value={serviceNotes}
                      onChange={(e) => setServiceNotes(e.target.value)}
                    />
                  </label>
                </div>
              </div>
              {(editMode === "details" && editingBooking.status === "completed") || nextStatus === "completed" ? (
                <>
                  <div className="service-form-section">
                    <div className="service-form-section__header">
                      <span>Cost & Next Service</span>
                    </div>
                    <div className="service-form-section__grid">
                      <label>
                        Final Cost (LKR)
                        <input
                          type="number"
                          placeholder="Enter final cost"
                          value={finalCost}
                          onChange={(e) => setFinalCost(e.target.value)}
                        />
                      </label>
                      <label>
                        Next Service Due (km)
                        <input
                          type="number"
                          placeholder="Enter next due odometer"
                          value={nextServiceDueKm}
                          onChange={(e) => setNextServiceDueKm(e.target.value)}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="service-form-section">
                    <div className="service-form-section__header">
                      <span>Vehicle Condition</span>
                    </div>
                    <div className="service-form-section__grid">
                      <label>
                        Tire Condition
                        <select value={proposedTireCondition} onChange={(e) => setProposedTireCondition(e.target.value)}>
                          <option value="">Select tire condition</option>
                          <option value="New">New</option>
                          <option value="Good">Good</option>
                          <option value="Worn Out">Worn Out</option>
                        </select>
                      </label>
                      <label>
                        Brake Condition
                        <select value={proposedBrakeCondition} onChange={(e) => setProposedBrakeCondition(e.target.value)}>
                          <option value="">Select brake condition</option>
                          <option value="New">New</option>
                          <option value="Good">Good</option>
                          <option value="Worn Out">Worn Out</option>
                        </select>
                      </label>
                      <label>
                        Battery Status
                        <select value={proposedBatteryStatus} onChange={(e) => setProposedBatteryStatus(e.target.value)}>
                          <option value="">Select battery status</option>
                          <option value="Good">Good</option>
                          <option value="Weak">Weak</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={closeActionModal}>
                Cancel
              </button>
              <button className={`btn${nextStatus === "cancelled" ? " btn--danger" : ""}`} type="button" onClick={submitBookingUpdate} disabled={saving}>
                {saving
                  ? "Saving..."
                  : editMode === "details"
                    ? "Save Details"
                    : nextStatus === "pending"
                      ? "Mark Pending"
                      : nextStatus === "confirmed"
                      ? editingBooking.status === "completed"
                        ? "Reopen Booking"
                        : "Confirm Booking"
                      : nextStatus === "cancelled"
                        ? "Cancel Booking"
                        : "Mark Completed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
