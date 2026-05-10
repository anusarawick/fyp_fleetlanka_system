import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Eye,
  Hourglass,
  Pencil,
  RotateCcw,
  WalletCards,
  Wrench,
} from "lucide-react";
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
  payment_status?: string;
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
  return `LKR ${number.toLocaleString()}`;
}

function formatOdometer(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "Not recorded";
  return `${number.toLocaleString()} km`;
}

function formatDate(value?: string) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(value?: string) {
  if (!value) return "Time not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Time not set";
  return parsed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
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
  const [workTypeFilter, setWorkTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week">("week");
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
  }, [search, statusFilter, workTypeFilter, dateFilter, rowsPerPage, bookings.length]);

  const filteredBookings = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
    return bookings.filter((booking) => {
      const statusMatches = statusFilter === "all" ? true : (booking.status || "pending") === statusFilter;
      if (!statusMatches) return false;
      if (workTypeFilter !== "all" && bookingWork(booking) !== workTypeFilter) return false;
      if (dateFilter !== "all") {
        const requestedDate = new Date(booking.requested_date);
        if (Number.isNaN(requestedDate.getTime())) return false;
        const dateMatches =
          dateFilter === "today"
            ? requestedDate >= startOfToday && requestedDate < endOfToday
            : requestedDate >= startOfToday && requestedDate < endOfWeek;
        if (!dateMatches) return false;
      }
      if (!query) return true;
      return [
        booking.id,
        booking.requested_date,
        booking.status,
        booking.completion_review_status,
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
  }, [bookings, search, statusFilter, workTypeFilter, dateFilter]);

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
  const cancelledBookings = useMemo(
    () => bookings.filter((booking) => booking.status === "cancelled"),
    [bookings]
  );
  const approvedCompletedBookings = useMemo(
    () =>
      completedBookings.filter(
        (booking) => (booking.completion_review_status || "pending") === "approved"
      ),
    [completedBookings]
  );
  const rejectedCompletedBookings = useMemo(
    () =>
      completedBookings.filter(
        (booking) => (booking.completion_review_status || "pending") === "rejected"
      ),
    [completedBookings]
  );
  const awaitingPaymentTotal = useMemo(
    () =>
      approvedCompletedBookings.reduce(
        (sum, booking) =>
          (booking.payment_status || "unpaid") === "paid"
            ? sum
            : sum + (Number.isFinite(Number(booking.final_cost_lkr)) ? Number(booking.final_cost_lkr) : 0),
        0
      ),
    [approvedCompletedBookings]
  );
  const blockedPaymentTotal = useMemo(
    () =>
      rejectedCompletedBookings.reduce(
        (sum, booking) => sum + (Number.isFinite(Number(booking.final_cost_lkr)) ? Number(booking.final_cost_lkr) : 0),
        0
      ),
    [rejectedCompletedBookings]
  );
  const todayScheduleRows = useMemo(
    () =>
      bookings
        .filter((booking) => (booking.status || "pending") !== "cancelled")
        .sort((a, b) => String(a.requested_date).localeCompare(String(b.requested_date)))
        .slice(0, 5),
    [bookings]
  );
  const attentionQueue = useMemo(() => {
    const rows: Array<{
      booking: ServicePortalBooking;
      title: string;
      action: string;
      tone: "blue" | "green" | "amber" | "red";
      icon: "calendar" | "check" | "hourglass" | "reopen";
      onClick: () => void;
    }> = [];

    pendingBookings.slice(0, 2).forEach((booking) => {
      rows.push({
        booking,
        title: "New booking waiting for confirmation",
        action: "Confirm",
        tone: "blue",
        icon: "calendar",
        onClick: () => openActionModal(booking, "confirmed"),
      });
    });
    confirmedBookings.slice(0, 2).forEach((booking) => {
      rows.push({
        booking,
        title: "Confirmed job ready for completion review",
        action: "Review",
        tone: "green",
        icon: "check",
        onClick: () => openActionModal(booking, "completed"),
      });
    });
    completedAwaitingReview.slice(0, 2).forEach((booking) => {
      const isRejected = (booking.completion_review_status || "pending") === "rejected";
      rows.push({
        booking,
        title: isRejected ? "Reopened job needs correction" : "Completion review submitted",
        action: isRejected ? "Fix & Resubmit" : "Track Approval",
        tone: isRejected ? "red" : "amber",
        icon: isRejected ? "reopen" : "hourglass",
        onClick: () => openDetailsModal(booking),
      });
    });

    return rows.slice(0, 4);
  }, [pendingBookings, confirmedBookings, completedAwaitingReview]);
  const paymentRows = useMemo(
    () =>
      [...completedBookings]
        .sort((a, b) => String(b.completed_at || b.requested_date).localeCompare(String(a.completed_at || a.requested_date)))
        .slice(0, 4)
        .map((booking) => {
          const reviewStatus = booking.completion_review_status || "pending";
          if (reviewStatus === "approved") {
            const paid = (booking.payment_status || "unpaid") === "paid";
            return {
              booking,
              label: paid ? "Paid" : "Awaiting Payment",
              tone: paid ? "green" : "blue",
              status: paid ? "Payment received." : "Approved, payment pending.",
            };
          }
          if (reviewStatus === "rejected") {
            return {
              booking,
              label: "Blocked",
              tone: "red",
              status: "Review reopened, fix required.",
            };
          }
          return {
            booking,
            label: "Approval Pending",
            tone: "amber",
            status: "Waiting for manager approval.",
          };
        }),
    [completedBookings]
  );
  const statusBreakdown = useMemo(
    () => [
      { label: "New", value: pendingBookings.length, tone: "blue" },
      { label: "Confirmed", value: confirmedBookings.length, tone: "sky" },
      { label: "Awaiting Approval", value: needsManagerReviewCount, tone: "amber" },
      { label: "Completed", value: approvedCompletedBookings.length, tone: "green" },
      { label: "Reopened", value: rejectedCompletedBookings.length + cancelledBookings.length, tone: "red" },
    ],
    [
      pendingBookings.length,
      confirmedBookings.length,
      needsManagerReviewCount,
      approvedCompletedBookings.length,
      rejectedCompletedBookings.length,
      cancelledBookings.length,
    ]
  );
  const totalStatusCount = statusBreakdown.reduce((sum, item) => sum + item.value, 0);
  const availableWorkTypes = useMemo(
    () =>
      Array.from(new Set(bookings.map((booking) => bookingWork(booking)).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [bookings]
  );
  const paymentReadyRows = useMemo(
    () =>
      [...approvedCompletedBookings]
        .filter((booking) => (booking.payment_status || "unpaid") !== "paid")
        .sort((a, b) => String(b.completed_at || b.requested_date).localeCompare(String(a.completed_at || a.requested_date)))
        .slice(0, 3),
    [approvedCompletedBookings]
  );
  const approvalQueueRows = useMemo(
    () =>
      [...completedAwaitingReview]
        .filter((booking) => (booking.completion_review_status || "pending") !== "rejected")
        .slice(0, 3),
    [completedAwaitingReview]
  );
  const reopenedReviewRows = useMemo(
    () =>
      [...rejectedCompletedBookings, ...cancelledBookings]
        .sort((a, b) => String(b.completed_at || b.requested_date).localeCompare(String(a.completed_at || a.requested_date)))
        .slice(0, 3),
    [rejectedCompletedBookings, cancelledBookings]
  );
  const todayBookings = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return bookings.filter((booking) => {
      const requestedDate = new Date(booking.requested_date);
      return !Number.isNaN(requestedDate.getTime()) && requestedDate >= startOfToday && requestedDate < endOfToday;
    });
  }, [bookings]);
  const stillPendingToday = todayBookings.filter((booking) =>
    ["pending", "confirmed"].includes(booking.status || "pending")
  ).length;
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

  function reviewStateLabel(booking: ServicePortalBooking) {
    const status = booking.status || "pending";
    if (status === "pending") return "Not Started";
    if (status === "confirmed") return "Ready to complete";
    if (status === "cancelled") return "Correction Required";
    if ((booking.completion_review_status || "pending") === "approved") return "Awaiting Payment";
    if ((booking.completion_review_status || "pending") === "rejected") return "Correction Required";
    return "Awaiting Approval";
  }

  function reviewStateTone(booking: ServicePortalBooking) {
    const label = reviewStateLabel(booking);
    if (label === "Ready to complete") return "green";
    if (label === "Awaiting Payment") return "blue";
    if (label === "Correction Required") return "red";
    if (label === "Awaiting Approval") return "amber";
    return "muted";
  }

  function statusTone(booking: ServicePortalBooking) {
    const status = booking.status || "pending";
    if (status === "pending") return "blue";
    if (status === "confirmed") return "green";
    if (status === "completed") {
      const reviewStatus = booking.completion_review_status || "pending";
      if (reviewStatus === "approved") return "green";
      if (reviewStatus === "rejected") return "red";
      return "blue";
    }
    return "red";
  }

  function renderBookingTableAction(booking: ServicePortalBooking) {
    const status = booking.status || "pending";
    const reviewStatus = booking.completion_review_status || "pending";

    if (status === "pending") {
      return (
        <span className="service-bookings-row-actions service-bookings-row-actions--pair">
          <button className="service-bookings-action service-bookings-action--primary" type="button" onClick={() => openActionModal(booking, "confirmed")}>
            Confirm
          </button>
          <button className="service-bookings-action service-bookings-action--danger" type="button" onClick={() => openActionModal(booking, "cancelled")}>
            Reject
          </button>
        </span>
      );
    }

    if (status === "confirmed") {
      return (
        <button className="service-bookings-action service-bookings-action--primary" type="button" onClick={() => openActionModal(booking, "completed")}>
          Complete Job
        </button>
      );
    }

    if (status === "completed" && reviewStatus === "rejected") {
      return (
        <button className="service-bookings-action service-bookings-action--danger" type="button" onClick={() => openDetailsModal(booking)}>
          Fix & Resubmit
        </button>
      );
    }

    if (status === "completed" && reviewStatus === "approved") {
      return (
        <button className="service-bookings-action service-bookings-action--secondary" type="button" onClick={() => setSelectedBooking(booking)}>
          View Details
        </button>
      );
    }

    if (status === "completed") {
      return (
        <button className="service-bookings-action service-bookings-action--secondary" type="button" onClick={() => openDetailsModal(booking)}>
          Track Approval
        </button>
      );
    }

    return (
      <button className="service-bookings-action service-bookings-action--secondary" type="button" onClick={() => setSelectedBooking(booking)}>
        View Details
      </button>
    );
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
          <section className="service-dashboard-kpis" aria-label="Service dashboard summary">
            <article className="service-dashboard-kpi service-dashboard-kpi--blue">
              <span className="service-dashboard-kpi__icon"><CalendarDays aria-hidden="true" /></span>
              <div><strong>{pendingBookings.length}</strong><span>New Bookings</span><small>Waiting for confirmation</small></div>
            </article>
            <article className="service-dashboard-kpi service-dashboard-kpi--indigo">
              <span className="service-dashboard-kpi__icon"><CheckCircle2 aria-hidden="true" /></span>
              <div><strong>{confirmedBookings.length}</strong><span>Confirmed Jobs</span><small>Scheduled & in progress</small></div>
            </article>
            <article className="service-dashboard-kpi service-dashboard-kpi--amber">
              <span className="service-dashboard-kpi__icon"><Clock3 aria-hidden="true" /></span>
              <div><strong>{needsManagerReviewCount}</strong><span>Awaiting Manager Approval</span><small>Pending manager review</small></div>
            </article>
            <article className="service-dashboard-kpi service-dashboard-kpi--green">
              <span className="service-dashboard-kpi__icon"><ClipboardCheck aria-hidden="true" /></span>
              <div><strong>{completedBookings.length}</strong><span>Completed Jobs</span><small>Ready for settlement and history</small></div>
            </article>
            <article className="service-dashboard-kpi service-dashboard-kpi--purple">
              <span className="service-dashboard-kpi__icon"><WalletCards aria-hidden="true" /></span>
              <div><strong>{formatCurrency(awaitingPaymentTotal)}</strong><span>Awaiting Payment</span><small>Payment support coming soon</small></div>
            </article>
          </section>

          <section className="service-dashboard-main-grid">
            <article className="service-dashboard-card service-dashboard-card--schedule">
              <div className="service-dashboard-card__header">
                <div><CalendarDays aria-hidden="true" /><h3>Today&apos;s Schedule</h3></div>
                <div className="service-dashboard-controls">
                  <span>{new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                  <span>All Work Types</span>
                </div>
              </div>
              {todayScheduleRows.length === 0 ? (
                <p className="service-dashboard-empty">No service bookings scheduled.</p>
              ) : (
                <div className="service-schedule-table">
                  <div className="service-schedule-table__head">
                    <span>Vehicle (Plate)</span><span>Make / Model</span><span>Scheduled Time</span><span>Work Type</span><span>Status</span>
                  </div>
                  {todayScheduleRows.map((booking) => (
                    <button className="service-schedule-table__row" type="button" key={booking.id} onClick={() => setSelectedBooking(booking)}>
                      <span data-label="Vehicle (Plate)">{vehiclePlate(booking)}</span>
                      <span data-label="Make / Model">{vehicleName(booking)}</span>
                      <span data-label="Scheduled Time">{formatTime(booking.requested_date)}</span>
                      <span data-label="Work Type">{bookingWork(booking)}</span>
                      <span data-label="Status"><span className={`service-status-badge service-status-badge--${booking.status || "pending"}`}>{formatStatus(booking.status)}</span></span>
                    </button>
                  ))}
                </div>
              )}
              <Link className="service-dashboard-link" to="/service/bookings">View Full Schedule</Link>
            </article>

            <article className="service-dashboard-card service-dashboard-card--attention">
              <div className="service-dashboard-card__header">
                <div><AlertTriangle aria-hidden="true" /><h3>Attention Queue</h3><span className="service-dashboard-count">{attentionQueue.length}</span></div>
                <Link to="/service/bookings">View All Queue</Link>
              </div>
              {attentionQueue.length === 0 ? (
                <p className="service-dashboard-empty">No urgent service actions. Great! All clear for now.</p>
              ) : (
                <div className="service-attention-list">
                  {attentionQueue.map((item) => {
                    const Icon = item.icon === "calendar" ? CalendarDays : item.icon === "check" ? CheckCircle2 : item.icon === "hourglass" ? Hourglass : RotateCcw;
                    return (
                      <article className={`service-attention-item service-attention-item--${item.tone}`} key={`${item.booking.id}-${item.title}`}>
                        <span className="service-attention-item__icon"><Icon aria-hidden="true" /></span>
                        <div>
                          <strong>{item.title}</strong>
                          <span>{vehiclePlate(item.booking)} · {vehicleName(item.booking)}</span>
                          <small>{bookingWork(item.booking)} · Scheduled {formatTime(item.booking.requested_date)}</small>
                        </div>
                        <button className="service-attention-item__action" type="button" onClick={item.onClick}>{item.action}</button>
                      </article>
                    );
                  })}
                </div>
              )}
            </article>
          </section>

          <section className="service-dashboard-bottom-grid">
            <article className="service-dashboard-card">
              <div className="service-dashboard-card__header">
                <div><ClipboardCheck aria-hidden="true" /><h3>Recent Completed Work</h3></div>
                <Link to="/service/bookings">View All</Link>
              </div>
              {latestCompleted.length === 0 ? (
                <p className="service-dashboard-empty">No completed service jobs recorded yet.</p>
              ) : (
                <div className="service-mini-table">
                  <div className="service-mini-table__head"><span>Vehicle (Plate)</span><span>Work Type</span><span>Completed At</span><span>Amount (LKR)</span></div>
                  {latestCompleted.slice(0, 5).map((booking) => (
                    <button className="service-mini-table__row" type="button" key={booking.id} onClick={() => setSelectedBooking(booking)}>
                      <span>{vehiclePlate(booking)}</span><span>{bookingWork(booking)}</span><span>{formatTime(booking.completed_at || booking.requested_date)}</span><span>{formatCurrency(booking.final_cost_lkr)}</span>
                    </button>
                  ))}
                </div>
              )}
              <Link className="service-dashboard-link" to="/service/bookings">View All Completed Work</Link>
            </article>

            <article className="service-dashboard-card">
              <div className="service-dashboard-card__header">
                <div><ClipboardList aria-hidden="true" /><h3>Booking Status Breakdown</h3></div>
                <Link to="/service/bookings">View Report</Link>
              </div>
              <div className="service-breakdown">
                <div className="service-breakdown-donut" aria-label="Booking status breakdown"><strong>{totalStatusCount}</strong><span>Total</span></div>
                <div className="service-breakdown-list">
                  {statusBreakdown.map((item) => (
                    <div className="service-breakdown-row" key={item.label}>
                      <span><i className={`service-breakdown-dot service-breakdown-dot--${item.tone}`} />{item.label}</span>
                      <strong>{item.value} {totalStatusCount > 0 ? `(${Math.round((item.value / totalStatusCount) * 100)}%)` : "(0%)"}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="service-clear-state"><CheckCircle2 aria-hidden="true" /><div><strong>{attentionQueue.length === 0 ? "No urgent escalations. Great!" : `${attentionQueue.length} queue item${attentionQueue.length === 1 ? "" : "s"} need attention`}</strong><span>{attentionQueue.length === 0 ? "All clear for now." : "Open the queue to complete the next actions."}</span></div></div>
            </article>

            <article className="service-dashboard-card service-dashboard-card--payments">
              <div className="service-dashboard-card__header">
                <div><WalletCards aria-hidden="true" /><h3>Payment Settlement Queue</h3></div>
                <button type="button" disabled title="Payment support coming soon">View Payments</button>
              </div>
              <div className="service-payment-summary">
                <div><span>Awaiting Payment</span><strong>{formatCurrency(awaitingPaymentTotal)}</strong></div>
                <div><span>Paid Today</span><strong>LKR 0</strong></div>
                <div><span>Blocked</span><strong>{formatCurrency(blockedPaymentTotal)}</strong></div>
              </div>
              {paymentRows.length === 0 ? (
                <p className="service-dashboard-empty">Approved service payments will appear here once in-app payments are enabled.</p>
              ) : (
                <div className="service-payment-table">
                  <div className="service-payment-table__head"><span>Vehicle (Plate)</span><span>Make / Model</span><span>Work Type</span><span>Amount</span><span>Payment State</span><span>Status</span></div>
                  {paymentRows.map((item) => (
                    <button className="service-payment-table__row" type="button" key={item.booking.id} onClick={() => setSelectedBooking(item.booking)}>
                      <span>{vehiclePlate(item.booking)}</span><span>{vehicleName(item.booking)}</span><span>{bookingWork(item.booking)}</span><span>{formatCurrency(item.booking.final_cost_lkr)}</span><span><span className={`service-payment-badge service-payment-badge--${item.tone}`}>{item.label}</span></span><span>{item.status}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="service-payment-note">Payment actions are disabled until in-app payments are implemented.</p>
            </article>
          </section>
        </>
      ) : (
        <>
          <section className="service-dashboard-kpis service-bookings-kpis" aria-label="Service bookings summary">
            <article className="service-dashboard-kpi service-dashboard-kpi--blue">
              <span className="service-dashboard-kpi__icon"><ClipboardList aria-hidden="true" /></span>
              <div><strong>{pendingBookings.length}</strong><span>New Requests</span><small>Waiting for confirmation</small></div>
            </article>
            <article className="service-dashboard-kpi service-dashboard-kpi--green">
              <span className="service-dashboard-kpi__icon"><CheckCircle2 aria-hidden="true" /></span>
              <div><strong>{confirmedBookings.length}</strong><span>Confirmed Jobs</span><small>Ready to complete</small></div>
            </article>
            <article className="service-dashboard-kpi service-dashboard-kpi--amber">
              <span className="service-dashboard-kpi__icon"><Clock3 aria-hidden="true" /></span>
              <div><strong>{needsManagerReviewCount}</strong><span>Awaiting Approval</span><small>Manager review pending</small></div>
            </article>
            <article className="service-dashboard-kpi service-dashboard-kpi--red">
              <span className="service-dashboard-kpi__icon"><AlertTriangle aria-hidden="true" /></span>
              <div><strong>{reopenedReviewRows.length}</strong><span>Reopened Reviews</span><small>Correction in progress</small></div>
            </article>
            <article className="service-dashboard-kpi service-dashboard-kpi--indigo">
              <span className="service-dashboard-kpi__icon"><WalletCards aria-hidden="true" /></span>
              <div><strong>{formatCurrency(awaitingPaymentTotal)}</strong><span>Payment Ready</span><small>Approved, awaiting payment</small></div>
            </article>
          </section>

          <section className="service-bookings-grid">
            <article className="service-bookings-card service-bookings-table-card">
              <div className="service-bookings-card__header">
                <h3>Booking Queue</h3>
              </div>

              <div className="service-bookings-controls">
                <label className="service-bookings-control service-bookings-control--search">
                  <span>Search</span>
                  <input
                    type="search"
                    placeholder="Search by plate, vehicle, or work type..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label className="service-bookings-control">
                  <span>Status</span>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
                <label className="service-bookings-control">
                  <span>Work Type</span>
                  <select value={workTypeFilter} onChange={(e) => setWorkTypeFilter(e.target.value)}>
                    <option value="all">All Work Types</option>
                    {availableWorkTypes.map((workType) => (
                      <option key={workType} value={workType}>{workType}</option>
                    ))}
                  </select>
                </label>
                <label className="service-bookings-control">
                  <span>Date</span>
                  <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}>
                    <option value="week">Next 7 Days</option>
                    <option value="today">Today</option>
                    <option value="all">All Dates</option>
                  </select>
                </label>
                <label className="service-bookings-control service-bookings-control--rows">
                  <span>Rows</span>
                  <select value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))}>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>

              {loading ? (
                <p className="service-bookings-empty">Loading bookings...</p>
              ) : filteredBookings.length === 0 ? (
                <p className="service-bookings-empty">No bookings match the current search/filter.</p>
              ) : (
                <div className="service-bookings-table">
                  <div className="service-bookings-table__head">
                    <span>Vehicle</span>
                    <span>Scheduled Date</span>
                    <span>Work Type</span>
                    <span>Status</span>
                    <span>Review State</span>
                    <span>Amount</span>
                    <span>Actions</span>
                  </div>
                  {visibleBookings.map((booking) => (
                    <div key={booking.id} className="service-bookings-table__row">
                      <span className="service-bookings-table__booking" data-label="Vehicle">
                        <strong>{vehiclePlate(booking)}</strong>
                        <small>{vehicleName(booking)}</small>
                      </span>
                      <span data-label="Scheduled Date">
                        <strong>{formatDate(booking.requested_date)}</strong>
                        <small>{formatTime(booking.requested_date)}</small>
                      </span>
                      <span data-label="Work Type">{bookingWork(booking)}</span>
                      <span data-label="Status">
                        <span className={`service-bookings-badge service-bookings-badge--${statusTone(booking)}`}>
                          {(booking.status || "pending") === "pending" ? "New" : formatStatus(booking.status)}
                        </span>
                      </span>
                      <span data-label="Review State">
                        <span className={`service-bookings-review service-bookings-review--${reviewStateTone(booking)}`}>
                          {reviewStateLabel(booking)}
                        </span>
                      </span>
                      <span data-label="Amount">{formatCurrency(booking.final_cost_lkr)}</span>
                      <span className="service-bookings-table__actions" data-label="Actions">
                        {renderBookingTableAction(booking)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="service-bookings-footer">
                <span>
                  Showing {filteredBookings.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1} to{" "}
                  {Math.min(currentPage * rowsPerPage, filteredBookings.length)} of {filteredBookings.length} bookings
                </span>
                <div className="service-bookings-pagination">
                  <label>
                    Rows per page:
                    <select value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))}>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                  <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                    Prev
                  </button>
                  <strong>{currentPage}</strong>
                  <button type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
                    Next
                  </button>
                </div>
              </div>
            </article>

            <aside className="service-bookings-side">
              <article className="service-bookings-side-card">
                <div className="service-bookings-side-card__header">
                  <h3>Today&apos;s Workload</h3>
                </div>
                <div className="service-bookings-workload">
                  <div><CalendarDays aria-hidden="true" /><span>Total Assigned Today</span><strong>{todayBookings.length}</strong></div>
                  <div><ClipboardList aria-hidden="true" /><span>New Requests</span><strong>{pendingBookings.length}</strong></div>
                  <div><CheckCircle2 aria-hidden="true" /><span>Completed Today</span><strong>{me?.summary.completed_today_count ?? 0}</strong></div>
                  <div><Clock3 aria-hidden="true" /><span>Still Pending</span><strong>{stillPendingToday}</strong></div>
                </div>
              </article>

              <article className="service-bookings-side-card">
                <div className="service-bookings-side-card__header">
                  <h3>Approval Queue</h3>
                  <button type="button" onClick={() => setStatusFilter("completed")}>View all</button>
                </div>
                {approvalQueueRows.length === 0 ? (
                  <p className="service-bookings-side-empty">No bookings waiting for manager approval.</p>
                ) : (
                  <div className="service-bookings-mini-list">
                    {approvalQueueRows.map((booking) => (
                      <button type="button" key={booking.id} onClick={() => openDetailsModal(booking)}>
                        <span><strong>{vehiclePlate(booking)}</strong><small>{bookingWork(booking)}</small></span>
                        <span>{formatCurrency(booking.final_cost_lkr)}</span>
                        <em>Awaiting Approval</em>
                      </button>
                    ))}
                  </div>
                )}
              </article>

              <article className="service-bookings-side-card">
                <div className="service-bookings-side-card__header">
                  <h3>Reopened Reviews</h3>
                  <button type="button" onClick={() => setStatusFilter("completed")}>View all</button>
                </div>
                {reopenedReviewRows.length === 0 ? (
                  <p className="service-bookings-side-empty">No correction requests right now.</p>
                ) : (
                  <div className="service-bookings-mini-list service-bookings-mini-list--reopened">
                    {reopenedReviewRows.map((booking) => (
                      <button type="button" key={booking.id} onClick={() => openDetailsModal(booking)}>
                        <span><strong>{vehiclePlate(booking)}</strong><small>{bookingWork(booking)}</small></span>
                        <span>{formatCurrency(booking.final_cost_lkr)}</span>
                        <em>Correction Required</em>
                      </button>
                    ))}
                  </div>
                )}
              </article>

              <article className="service-bookings-side-card">
                <div className="service-bookings-side-card__header">
                  <h3>Payment Preview</h3>
                </div>
                <div className="service-bookings-payment-callout">
                  <WalletCards aria-hidden="true" />
                  <div>
                    <strong>Awaiting Payment: {formatCurrency(awaitingPaymentTotal)}</strong>
                    <span>In-app payments coming soon.</span>
                  </div>
                </div>
                {paymentReadyRows.length === 0 ? (
                  <p className="service-bookings-side-empty">Approved service payments will appear here.</p>
                ) : (
                  <div className="service-bookings-payment-list">
                    {paymentReadyRows.map((booking) => (
                      <button type="button" key={booking.id} onClick={() => setSelectedBooking(booking)}>
                        <span><strong>{vehiclePlate(booking)}</strong><small>{bookingWork(booking)}</small></span>
                        <span>{formatCurrency(booking.final_cost_lkr)}</span>
                        <em>Approved</em>
                      </button>
                    ))}
                  </div>
                )}
              </article>
            </aside>
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
