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
  return [booking.vehicle_make, booking.vehicle_model].filter(Boolean).join(" ") || "--";
}

function vehiclePlate(booking: ServicePortalBooking) {
  return booking.vehicle_plate_no || "--";
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
          <div className="stats service-portal-stats admin-stats">
            <div className="stat-card stat-card--amber">
              <div className="stat-icon"><ServicePortalIcon name="pending" /></div>
              <div className="stat-value">{me?.summary.pending_count ?? 0}</div>
              <div className="stat-label">Pending Bookings</div>
              <div className="stat-sub">Waiting for center action</div>
            </div>
            <div className="stat-card stat-card--blue">
              <div className="stat-icon"><ServicePortalIcon name="confirmed" /></div>
              <div className="stat-value">{me?.summary.confirmed_count ?? 0}</div>
              <div className="stat-label">Confirmed Jobs</div>
              <div className="stat-sub">Accepted service work</div>
            </div>
            <div className="stat-card stat-card--green">
              <div className="stat-icon"><ServicePortalIcon name="completedToday" /></div>
              <div className="stat-value">{me?.summary.completed_today_count ?? 0}</div>
              <div className="stat-label">Completed Today</div>
              <div className="stat-sub">Closed out this day</div>
            </div>
            <div className="stat-card stat-card--purple">
              <div className="stat-icon"><ServicePortalIcon name="completedTotal" /></div>
              <div className="stat-value">{me?.summary.total_completed_count ?? 0}</div>
              <div className="stat-label">Total Completed</div>
              <div className="stat-sub">Closed service jobs</div>
            </div>
          </div>

          <div className="grid service-portal-overview-grid admin-panel">
            <section className="card admin-card--summary service-portal-summary">
              <div className="card__header">
                <div>
                  <h3>Center Overview</h3>
                  <p className="muted admin-card__subtitle">Center details, assigned workload, and the next service action.</p>
                </div>
              </div>
              <div className="service-portal-summary__grid">
                <div className="service-portal-summary__item">
                  <span>Center</span>
                  <strong>{me?.center.name || "--"}</strong>
                </div>
                <div className="service-portal-summary__item">
                  <span>Phone</span>
                  <strong>{me?.center.phone || "--"}</strong>
                </div>
                <div className="service-portal-summary__item">
                  <span>Portal</span>
                  <strong>{me?.center.profile_id ? "Linked" : "Not Linked"}</strong>
                </div>
                <div className="service-portal-summary__item">
                  <span>Assigned Bookings</span>
                  <strong>{bookings.length}</strong>
                </div>
                <div className="service-portal-summary__item">
                  <span>Next Action</span>
                  <strong>{nextActionLabel}</strong>
                </div>
              </div>
            </section>

            <section className="card admin-card--summary">
              <div className="card__header">
                <div>
                  <h3>Workload Snapshot</h3>
                  <p className="muted admin-card__subtitle">Pending decisions, active jobs, and completed work waiting for manager review.</p>
                </div>
              </div>
              <ul className="list service-portal-list">
                <li>
                  <div className="list__title">Pending Reviews</div>
                  <div className="list__meta">{me?.summary.pending_count ?? 0} bookings still need a center decision.</div>
                </li>
                <li>
                  <div className="list__title">Confirmed Work</div>
                  <div className="list__meta">{me?.summary.confirmed_count ?? 0} jobs are currently accepted and in progress.</div>
                </li>
                <li>
                  <div className="list__title">Total Completed</div>
                  <div className="list__meta">{me?.summary.total_completed_count ?? 0} bookings have been completed through this portal.</div>
                </li>
                <li>
                  <div className="list__title">Manager Review Waiting</div>
                  <div className="list__meta">{needsManagerReviewCount} completed bookings are still waiting for manager verification.</div>
                </li>
              </ul>
            </section>
          </div>

          <div className="grid service-portal-overview-grid admin-panel">
            <section className="card admin-card--summary">
              <div className="card__header">
                <div>
                  <h3>Attention Now</h3>
                  <p className="muted admin-card__subtitle">Nearest pending or confirmed jobs that need action from the workshop team.</p>
                </div>
              </div>
              {upcomingQueue.length === 0 ? (
                <p className="empty">No pending or confirmed jobs in the current queue.</p>
              ) : (
                <ul className="list service-portal-list">
                  {upcomingQueue.map((booking) => (
                    <li key={booking.id}>
                      <div className="list__title">{vehicleLabel(booking)}</div>
                      <div className="list__meta">
                        {booking.requested_date} • {(booking.status || "pending").replace("_", " ")}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card admin-card--summary">
              <div className="card__header">
                <div>
                  <h3>Recently Closed Jobs</h3>
                  <p className="muted admin-card__subtitle">Recently completed jobs and their manager review status.</p>
                </div>
              </div>
              {latestCompleted.length === 0 ? (
                <p className="empty">No completed bookings recorded yet.</p>
              ) : (
                <ul className="list service-portal-list">
                  {latestCompleted.map((booking) => (
                    <li key={booking.id}>
                      <div className="list__title">{vehicleLabel(booking)}</div>
                      <div className="list__meta">
                        {(booking.completed_at || booking.requested_date)} • review {(booking.completion_review_status || "pending").replace("_", " ")}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : (
        <>
          <div className="stats stats--three admin-stats">
            <div className="stat-card stat-card--blue">
              <div className="stat-value">{filteredBookings.length}</div>
              <div className="stat-label">Filtered Queue</div>
              <div className="stat-sub">Bookings in the current working set</div>
            </div>
            <div className="stat-card stat-card--amber">
              <div className="stat-value">{me?.summary.pending_count ?? 0}</div>
              <div className="stat-label">Pending Decisions</div>
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
                <h3>Service Bookings</h3>
                <p className="muted admin-card__subtitle">Confirm, cancel, complete, and update assigned service jobs.</p>
              </div>
            </div>

            <div className="table-controls">
              <div className="table-controls__filters">
                <label className="table-controls__label table-controls__label--search">
                  Search
                  <input
                    type="search"
                    placeholder="Vehicle, date, notes..."
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
                        {booking.status || "pending"}
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
                        "--"
                      )}
                    </span>
                    <span className="table__actions service-portal-table__actions" data-label="Actions">
                      <span className="service-portal-table__icon-group">
                        <button className="icon-action" type="button" onClick={() => setSelectedBooking(booking)} title="View booking" aria-label="View booking">
                          <Eye className="icon-action__svg icon-action__svg--view" aria-hidden="true" />
                        </button>
                        {(booking.status === "confirmed" || (booking.status === "completed" && booking.completion_review_status !== "approved")) && (
                          <button className="icon-action" type="button" onClick={() => openDetailsModal(booking)} title="Edit details" aria-label="Edit details">
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
                            Complete
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
                <h3>Booking Details</h3>
                <p className="modal__subtle">Vehicle, booking notes, service outcome, and manager review status.</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setSelectedBooking(null)} aria-label="Close booking details">
                ✕
              </button>
            </div>
            <div className="details-grid details-grid--scroll">
              <div className="detail-item"><span>Vehicle</span><strong>{vehicleLabel(selectedBooking)}</strong></div>
              <div className="detail-item"><span>Requested Date</span><strong>{selectedBooking.requested_date}</strong></div>
              <div className="detail-item"><span>Status</span><strong>{selectedBooking.status || "pending"}</strong></div>
              <div className="detail-item"><span>Work Type</span><strong>{selectedBooking.work_type || "--"}</strong></div>
              <div className="detail-item"><span>Completed At</span><strong>{selectedBooking.completed_at || "--"}</strong></div>
              <div className="detail-item detail-item--full"><span>Booking Notes</span><strong>{selectedBooking.notes || "--"}</strong></div>
              <div className="detail-item detail-item--full"><span>Service Notes</span><strong>{selectedBooking.service_notes || "--"}</strong></div>
              <div className="detail-item"><span>Final Cost (LKR)</span><strong>{typeof selectedBooking.final_cost_lkr === "number" ? `Rs.${selectedBooking.final_cost_lkr.toLocaleString()}` : "--"}</strong></div>
              <div className="detail-item"><span>Next Due (km)</span><strong>{typeof selectedBooking.next_service_due_km === "number" ? selectedBooking.next_service_due_km.toLocaleString() : "--"}</strong></div>
              <div className="detail-item"><span>Tire Condition</span><strong>{selectedBooking.proposed_tire_condition || "--"}</strong></div>
              <div className="detail-item"><span>Brake Condition</span><strong>{selectedBooking.proposed_brake_condition || "--"}</strong></div>
              <div className="detail-item"><span>Battery Status</span><strong>{selectedBooking.proposed_battery_status || "--"}</strong></div>
              <div className="detail-item"><span>Review Status</span><strong>{selectedBooking.completion_review_status || "--"}</strong></div>
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
            <div className="form form--two-col form--scroll">
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
              {(editMode === "details" && editingBooking.status === "completed") || nextStatus === "completed" ? (
                <>
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
