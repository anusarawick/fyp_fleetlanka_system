import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BatteryCharging,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Eye,
  FileText,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Target,
  Trash2,
  WalletCards,
  Wrench,
  XCircle,
} from "lucide-react";

type Vehicle = {
  id: string;
  plate_no: string;
  tire_condition?: string;
  brake_condition?: string;
  battery_status?: string;
  odometer_km?: number;
  next_service_due_km?: number;
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
  payment_access_enabled?: boolean;
  stripe_account_id?: string;
  stripe_onboarding_status?: string;
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
  payment_status?: string;
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
  centerPaymentAccess: boolean;
  setCenterPaymentAccess: (v: boolean) => void;
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
  onCreateBookingCheckout: (bookingId: string) => Promise<void>;
};

type MaintenanceTab = "records" | "bookings" | "centers" | "approvals";

export default function Maintenance(props: MaintenanceProps) {
  const [activeTab, setActiveTab] = useState<MaintenanceTab>("records");
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showCenterModal, setShowCenterModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [maintenanceSearch, setMaintenanceSearch] = useState("");
  const [maintenanceSeverityFilter, setMaintenanceSeverityFilter] = useState("all");
  const [maintenanceTypeFilter, setMaintenanceTypeFilter] = useState("all");
  const [maintenanceRowsPerPage, setMaintenanceRowsPerPage] = useState(10);
  const [maintenancePage, setMaintenancePage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceRecord | null>(null);
  const [centerSearch, setCenterSearch] = useState("");
  const [centerLocationFilter, setCenterLocationFilter] = useState("all");
  const [centerPortalFilter, setCenterPortalFilter] = useState("all");
  const [centerRowsPerPage, setCenterRowsPerPage] = useState(10);
  const [centerPage, setCenterPage] = useState(1);
  const [selectedCenter, setSelectedCenter] = useState<ServiceCenter | null>(null);
  const [deleteCenterTarget, setDeleteCenterTarget] = useState<ServiceCenter | null>(null);
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("all");
  const [bookingReviewFilter, setBookingReviewFilter] = useState("all");
  const [bookingRowsPerPage, setBookingRowsPerPage] = useState(10);
  const [bookingPage, setBookingPage] = useState(1);
  const [approvalSearch, setApprovalSearch] = useState("");
  const [approvalReviewFilter, setApprovalReviewFilter] = useState("all");
  const [approvalCenterFilter, setApprovalCenterFilter] = useState("all");
  const [approvalRowsPerPage, setApprovalRowsPerPage] = useState(10);
  const [approvalPage, setApprovalPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<ServiceBooking | null>(null);
  const [deleteBookingTarget, setDeleteBookingTarget] = useState<ServiceBooking | null>(null);
  const [approveBookingTarget, setApproveBookingTarget] = useState<ServiceBooking | null>(null);
  const [rejectBookingTarget, setRejectBookingTarget] = useState<ServiceBooking | null>(null);
  const [rejectBookingNote, setRejectBookingNote] = useState("");

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

  const currentMonth = new Date().toISOString().slice(0, 7);
  const openBookings = props.bookings.filter((booking) =>
    ["pending", "confirmed", "in_progress"].includes(booking.status || "pending")
  );
  const pendingApprovalCount = props.bookings.filter((booking) => isPendingCompletionReview(booking)).length;
  const maintenanceThisMonth = props.maintenance.filter((record) => isSameMonth(record.service_date, currentMonth));
  const bookingIdsWithRecords = new Set(props.maintenance.map((record) => record.service_booking_id).filter(Boolean));
  const completedBookingsThisMonth = props.bookings.filter((booking) =>
    (booking.status || "pending") === "completed" &&
    isSameMonth(booking.completed_at || booking.requested_date, currentMonth) &&
    !bookingIdsWithRecords.has(booking.id)
  );
  const completedThisMonth = maintenanceThisMonth.length + completedBookingsThisMonth.length;
  const maintenanceSpendThisMonth =
    maintenanceThisMonth.reduce((sum, record) => sum + (record.cost_lkr || 0), 0) +
    completedBookingsThisMonth.reduce((sum, booking) => sum + (booking.final_cost_lkr || 0), 0);
  const highSeverityRecords = props.maintenance.filter((record) => severityBucket(record) === "high");
  const linkedCentersCount = props.centers.filter((center) => Boolean(center.profile_id)).length;

  const maintenanceTypeOptions = Array.from(
    new Set(props.maintenance.map((record) => serviceTypeLabel(record)).filter(Boolean))
  ).sort();

  const filteredMaintenance = props.maintenance.filter((record) => {
    const query = maintenanceSearch.trim().toLowerCase();
    const matchesQuery =
      !query ||
      [
        record.service_date,
        record.service_type,
        record.event_type,
        record.severity,
        record.notes,
        record.service_booking_id ? "service booking" : "manual",
        record.service_center_id ? centerLabelMap[record.service_center_id] : "",
        record.vehicle_id ? vehicleLabelMap[record.vehicle_id] : "",
        typeof record.cost_lkr === "number" ? String(record.cost_lkr) : "",
        typeof record.odometer_km === "number" ? String(record.odometer_km) : "",
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    const matchesSeverity =
      maintenanceSeverityFilter === "all" || severityBucket(record) === maintenanceSeverityFilter;
    const matchesType =
      maintenanceTypeFilter === "all" || serviceTypeLabel(record) === maintenanceTypeFilter;
    return matchesQuery && matchesSeverity && matchesType;
  });

  const filteredCenters = props.centers.filter((center) => {
    const query = centerSearch.trim().toLowerCase();
    const portalState = getPortalState(center);
    const location = getCenterLocation(center);
    const matchesQuery =
      !query ||
      [center.name, center.phone, center.address, portalState.label, location]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    const matchesLocation = centerLocationFilter === "all" || location === centerLocationFilter;
    const matchesPortal = centerPortalFilter === "all" || portalState.key === centerPortalFilter;
    return matchesQuery && matchesLocation && matchesPortal;
  });

  const centerLocationOptions = Array.from(
    new Set(props.centers.map((center) => getCenterLocation(center)).filter(Boolean))
  ).sort();

  const filteredBookings = props.bookings.filter((booking) => {
    const query = bookingSearch.trim().toLowerCase();
    const review = reviewState(booking);
    const status = bookingWorkflowStatus(booking);
    const matchesQuery =
      !query ||
      [
        booking.requested_date,
        booking.status,
        booking.notes,
        booking.work_type,
        booking.service_notes,
        review.label,
        status.label,
        booking.vehicle_id ? vehicleLabelMap[booking.vehicle_id] : "",
        booking.center_id ? centerLabelMap[booking.center_id] : "",
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    const matchesStatus = bookingStatusFilter === "all" || status.key === bookingStatusFilter;
    const matchesReview = bookingReviewFilter === "all" || review.key === bookingReviewFilter;
    return matchesQuery && matchesStatus && matchesReview;
  });

  const approvalBookings = props.bookings.filter((booking) => (booking.status || "pending") === "completed");
  const filteredApprovals = approvalBookings.filter((booking) => {
    const query = approvalSearch.trim().toLowerCase();
    const review = reviewState(booking);
    const updates = proposedUpdates(booking).join(" ");
    const matchesQuery =
      !query ||
      [
        booking.work_type,
        booking.completed_at,
        booking.requested_date,
        updates,
        review.label,
        booking.vehicle_id ? vehicleLabelMap[booking.vehicle_id] : "",
        booking.center_id ? centerLabelMap[booking.center_id] : "",
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    const matchesReview = approvalReviewFilter === "all" || review.key === approvalReviewFilter;
    const matchesCenter = approvalCenterFilter === "all" || booking.center_id === approvalCenterFilter;
    return matchesQuery && matchesReview && matchesCenter;
  });

  const upcomingBookings = props.bookings
    .filter((booking) => ["pending", "confirmed", "in_progress"].includes(booking.status || "pending"))
    .sort((a, b) => a.requested_date.localeCompare(b.requested_date))
    .slice(0, 5);
  const componentHealth = buildComponentHealth();
  const activePortalCenters = props.centers.filter((center) => getPortalState(center).key === "active");
  const missingContactCenters = props.centers.filter((center) => getPortalState(center).key === "missing_contacts");
  const pendingSetupCenters = props.centers.filter((center) => getPortalState(center).key === "pending_setup");
  const approvedReviews = props.bookings.filter((booking) => reviewState(booking).key === "approved").length;
  const rejectedReviews = props.bookings.filter((booking) => reviewState(booking).key === "rejected").length;

  const maintenanceTotalPages = Math.max(
    1,
    Math.ceil(filteredMaintenance.length / maintenanceRowsPerPage)
  );
  const currentMaintenancePage = Math.min(maintenancePage, maintenanceTotalPages);
  const paginatedMaintenance = filteredMaintenance.slice(
    (currentMaintenancePage - 1) * maintenanceRowsPerPage,
    currentMaintenancePage * maintenanceRowsPerPage
  );

  const centerTotalPages = Math.max(1, Math.ceil(filteredCenters.length / centerRowsPerPage));
  const currentCenterPage = Math.min(centerPage, centerTotalPages);
  const paginatedCenters = filteredCenters.slice(
    (currentCenterPage - 1) * centerRowsPerPage,
    currentCenterPage * centerRowsPerPage
  );

  const bookingTotalPages = Math.max(1, Math.ceil(filteredBookings.length / bookingRowsPerPage));
  const currentBookingPage = Math.min(bookingPage, bookingTotalPages);
  const paginatedBookings = filteredBookings.slice(
    (currentBookingPage - 1) * bookingRowsPerPage,
    currentBookingPage * bookingRowsPerPage
  );

  const approvalTotalPages = Math.max(1, Math.ceil(filteredApprovals.length / approvalRowsPerPage));
  const currentApprovalPage = Math.min(approvalPage, approvalTotalPages);
  const paginatedApprovals = filteredApprovals.slice(
    (currentApprovalPage - 1) * approvalRowsPerPage,
    currentApprovalPage * approvalRowsPerPage
  );

  useEffect(() => {
    setMaintenancePage(1);
  }, [
    maintenanceRowsPerPage,
    maintenanceSearch,
    maintenanceSeverityFilter,
    maintenanceTypeFilter,
    props.maintenance.length,
  ]);

  useEffect(() => {
    setCenterPage(1);
  }, [centerRowsPerPage, centerSearch, centerLocationFilter, centerPortalFilter, props.centers.length]);

  useEffect(() => {
    setBookingPage(1);
  }, [bookingRowsPerPage, bookingSearch, bookingStatusFilter, bookingReviewFilter, props.bookings.length]);

  useEffect(() => {
    setApprovalPage(1);
  }, [approvalRowsPerPage, approvalSearch, approvalReviewFilter, approvalCenterFilter, approvalBookings.length]);

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

  function isSameMonth(value: string | undefined, monthKey: string) {
    if (!value) return false;
    return value.slice(0, 7) === monthKey;
  }

  function formatDate(value?: string) {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  function formatLkr(value?: number) {
    return typeof value === "number" ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "--";
  }

  function formatOdometer(value?: number) {
    return typeof value === "number" ? value.toLocaleString() : "--";
  }

  function serviceTypeLabel(record: MaintenanceRecord) {
    return record.service_type || formatReadable(record.event_type) || "General Service";
  }

  function severityBucket(record: MaintenanceRecord) {
    const severity = (record.severity || "").toLowerCase();
    if (["critical", "major", "high"].includes(severity)) return "high";
    if (["moderate", "medium"].includes(severity)) return "medium";
    return "low";
  }

  function severityLabel(record: MaintenanceRecord) {
    const bucket = severityBucket(record);
    return bucket === "high" ? "High" : bucket === "medium" ? "Medium" : "Low";
  }

  function bookingWorkflowStatus(booking: ServiceBooking) {
    const status = booking.status || "pending";
    if (status === "completed" && isPendingCompletionReview(booking)) {
      return { key: "awaiting_review", label: "Awaiting Review", tone: "info" };
    }
    if (status === "confirmed" || status === "in_progress") {
      return { key: "in_progress", label: "In Progress", tone: "info" };
    }
    if (status === "completed") return { key: "completed", label: "Completed", tone: "success" };
    if (status === "cancelled") return { key: "cancelled", label: "Cancelled", tone: "neutral" };
    return { key: "scheduled", label: "Scheduled", tone: "info" };
  }

  function reviewState(booking: ServiceBooking) {
    if ((booking.status || "pending") !== "completed") {
      return { key: "not_required", label: "Not Required", tone: "neutral" };
    }
    const status = booking.completion_review_status || "pending";
    if (status === "approved") return { key: "approved", label: "Approved", tone: "success" };
    if (status === "rejected") return { key: "rejected", label: "Needs Clarification", tone: "danger" };
    return { key: "pending", label: "Pending Review", tone: "warning" };
  }

  function proposedUpdates(booking: ServiceBooking) {
    const updates: string[] = [];
    if (booking.proposed_tire_condition) updates.push("Tire");
    if (booking.proposed_brake_condition) updates.push("Brake");
    if (booking.proposed_battery_status) updates.push("Battery");
    return updates;
  }

  function getPortalState(center: ServiceCenter) {
    if (!center.phone || !center.address) {
      return { key: "missing_contacts", label: "Missing Contacts", tone: "warning" };
    }
    if (!center.profile_id) {
      return { key: "pending_setup", label: "Pending Setup", tone: "info" };
    }
    return { key: "active", label: "Active", tone: "success" };
  }

  function getPaymentAccessState(center: ServiceCenter) {
    if (!center.payment_access_enabled) {
      return { label: "Disabled", tone: "neutral" };
    }
    if (center.stripe_onboarding_status === "connected") {
      return { label: "Connected", tone: "success" };
    }
    if (center.stripe_account_id) {
      return { label: "Setup Pending", tone: "warning" };
    }
    return { label: "Enabled", tone: "info" };
  }

  function getBookingCenter(booking: ServiceBooking) {
    return props.centers.find((center) => center.id === booking.center_id);
  }

  function getBookingPaymentState(booking: ServiceBooking) {
    const status = booking.payment_status || "unpaid";
    if (status === "paid") return { label: "Paid", tone: "success", payable: false };
    if ((booking.status || "pending") !== "completed" || (booking.completion_review_status || "pending") !== "approved") {
      return { label: "Not Ready", tone: "neutral", payable: false };
    }
    if (!booking.final_cost_lkr || booking.final_cost_lkr <= 0) {
      return { label: "Missing Cost", tone: "warning", payable: false };
    }
    const center = getBookingCenter(booking);
    if (!center?.payment_access_enabled) return { label: "Payments Off", tone: "warning", payable: false };
    if (center.stripe_onboarding_status !== "connected") return { label: "Center Setup Needed", tone: "warning", payable: false };
    return { label: "Payable", tone: "info", payable: true };
  }

  function getCenterLocation(center: ServiceCenter) {
    const parts = (center.address || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : "Unspecified";
  }

  function serviceUrgency(booking: ServiceBooking) {
    const requested = new Date(booking.requested_date);
    if (Number.isNaN(requested.getTime())) return { label: "Low", tone: "success" };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((requested.getTime() - today.getTime()) / 86400000);
    if (diffDays <= 0) return { label: "High", tone: "danger" };
    if (diffDays <= 7) return { label: "Medium", tone: "warning" };
    return { label: "Low", tone: "success" };
  }

  function conditionIsHealthy(value?: string) {
    const normalized = (value || "").toLowerCase();
    return ["good", "new", "ok", "healthy", "normal"].some((term) => normalized.includes(term));
  }

  function buildComponentHealth() {
    const tireRecorded = props.vehicles.filter((vehicle) => Boolean(vehicle.tire_condition));
    const brakeRecorded = props.vehicles.filter((vehicle) => Boolean(vehicle.brake_condition));
    const batteryRecorded = props.vehicles.filter((vehicle) => Boolean(vehicle.battery_status));
    const serviceRecorded = props.vehicles.filter(
      (vehicle) => typeof vehicle.odometer_km === "number" && typeof vehicle.next_service_due_km === "number"
    );
    return [
      {
        label: "Tires",
        icon: Target,
        healthy: tireRecorded.filter((vehicle) => conditionIsHealthy(vehicle.tire_condition)).length,
        total: tireRecorded.length,
        tone: "warning",
      },
      {
        label: "Brakes",
        icon: ShieldCheck,
        healthy: brakeRecorded.filter((vehicle) => conditionIsHealthy(vehicle.brake_condition)).length,
        total: brakeRecorded.length,
        tone: "success",
      },
      {
        label: "Battery",
        icon: BatteryCharging,
        healthy: batteryRecorded.filter((vehicle) => conditionIsHealthy(vehicle.battery_status)).length,
        total: batteryRecorded.length,
        tone: "success",
      },
      {
        label: "Engine Service",
        icon: Settings,
        healthy: serviceRecorded.filter((vehicle) => {
          const remaining = (vehicle.next_service_due_km || 0) - (vehicle.odometer_km || 0);
          return remaining > 1000;
        }).length,
        total: serviceRecorded.length,
        tone: "warning",
      },
    ];
  }

  return (
    <section className="section">
      <section className="admin-page maintenance-page">
        <section className="dashboard-kpis maintenance-kpi-grid">
          <article className="dashboard-kpi-card dashboard-kpi-card--orange maintenance-kpi-card">
            <div className="dashboard-kpi-card__icon"><CalendarClock aria-hidden="true" /></div>
            <div><span className="dashboard-kpi-card__label">Open Bookings</span><strong>{openBookings.length}</strong><small className="dashboard-trend dashboard-trend--warning">{pendingApprovalCount} awaiting action</small></div>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card--red maintenance-kpi-card">
            <div className="dashboard-kpi-card__icon"><ClipboardList aria-hidden="true" /></div>
            <div><span className="dashboard-kpi-card__label">Pending Approval</span><strong>{pendingApprovalCount}</strong><small className="dashboard-trend dashboard-trend--danger">completion reviews pending</small></div>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card--green maintenance-kpi-card">
            <div className="dashboard-kpi-card__icon"><CheckCircle2 aria-hidden="true" /></div>
            <div><span className="dashboard-kpi-card__label">Completed This Month</span><strong>{completedThisMonth}</strong><small className="dashboard-trend dashboard-trend--positive">from current records</small></div>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card--teal maintenance-kpi-card">
            <div className="dashboard-kpi-card__icon"><WalletCards aria-hidden="true" /></div>
            <div><span className="dashboard-kpi-card__label">Maintenance Spend</span><strong>LKR {maintenanceSpendThisMonth >= 1000000 ? `${(maintenanceSpendThisMonth / 1000000).toFixed(2)}M` : maintenanceSpendThisMonth.toLocaleString()}</strong><small className="dashboard-trend dashboard-trend--live">month to date</small></div>
          </article>
        </section>

        <div className="maintenance-workspace maintenance-workspace--redesign">
          <section className="maintenance-board-card maintenance-main-card">
            <nav className="maintenance-tabs" aria-label="Maintenance sections">
              {[
                ["records", "Records"],
                ["bookings", "Service Bookings"],
                ["centers", "Service Centers"],
                ["approvals", "Approval Queue"],
              ].map(([tab, label]) => (
                <button key={tab} type="button" className={`maintenance-tab ${activeTab === tab ? "maintenance-tab--active" : ""}`} onClick={() => setActiveTab(tab as MaintenanceTab)}>
                  {label}
                  {tab === "approvals" && pendingApprovalCount > 0 && <span className="maintenance-tab-count">{pendingApprovalCount}</span>}
                </button>
              ))}
            </nav>

            {activeTab === "records" && (
              <>
                <div className="maintenance-table-controls maintenance-table-controls--records">
                  <label className="maintenance-search-control"><Search aria-hidden="true" /><input type="search" placeholder="Search by vehicle, type, or notes..." value={maintenanceSearch} onChange={(event) => setMaintenanceSearch(event.target.value)} /></label>
                  <label className="maintenance-select-control"><span>Severity</span><select value={maintenanceSeverityFilter} onChange={(event) => setMaintenanceSeverityFilter(event.target.value)}><option value="all">All Severities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
                  <label className="maintenance-select-control"><span>Type</span><select value={maintenanceTypeFilter} onChange={(event) => setMaintenanceTypeFilter(event.target.value)}><option value="all">All Types</option>{maintenanceTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
                  <label className="maintenance-select-control maintenance-select-control--rows"><span>Rows</span><select value={maintenanceRowsPerPage} onChange={(event) => setMaintenanceRowsPerPage(Number(event.target.value))}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
                  <button className="maintenance-table-action" type="button" onClick={() => { props.onCancelMaintenanceEdit(); setShowMaintenanceModal(true); }}><Plus aria-hidden="true" /> Log Service</button>
                </div>
                {filteredMaintenance.length === 0 ? <div className="maintenance-empty-state"><FileText aria-hidden="true" /><div><strong>No service records found</strong><span>Log completed service work when vehicles return from maintenance.</span></div></div> : (
                  <div className="maintenance-register-table maintenance-records-table">
                    <div className="maintenance-table__head"><span>Vehicle</span><span>Date</span><span>Type</span><span>Severity</span><span>Cost (LKR)</span><span>Odometer (km)</span><span>Actions</span></div>
                    {paginatedMaintenance.map((record) => (
                      <div className="maintenance-table__row" key={record.id}>
                        <span data-label="Vehicle"><strong>{vehicleLabelMap[record.vehicle_id] || "--"}</strong></span>
                        <span data-label="Date">{formatDate(record.service_date)}</span>
                        <span data-label="Type">{serviceTypeLabel(record)}</span>
                        <span data-label="Severity"><span className={`maintenance-badge maintenance-badge--${severityBucket(record)}`}>{severityLabel(record)}</span></span>
                        <span data-label="Cost (LKR)">{formatLkr(record.cost_lkr)}</span>
                        <span data-label="Odometer (km)">{formatOdometer(record.odometer_km)}</span>
                        <span className="maintenance-row-actions" data-label="Actions">
                          <button className="icon-action" type="button" onClick={() => setSelectedRecord(record)} title="View record" aria-label={`View maintenance ${record.id}`}><Eye className="icon-action__svg icon-action__svg--view" aria-hidden="true" /></button>
                          <button className="icon-action" type="button" onClick={() => { props.onEditMaintenance(record); setShowMaintenanceModal(true); }} title="Edit record" aria-label={`Edit maintenance ${record.id}`}><Pencil className="icon-action__svg icon-action__svg--edit" aria-hidden="true" /></button>
                          <button className="icon-action icon-action--danger" type="button" onClick={() => setDeleteTarget(record)} disabled={props.loading} title="Delete record" aria-label={`Delete maintenance ${record.id}`}><Trash2 className="icon-action__svg icon-action__svg--delete" aria-hidden="true" /></button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="maintenance-table-footer"><span>Showing {filteredMaintenance.length === 0 ? 0 : (currentMaintenancePage - 1) * maintenanceRowsPerPage + 1} to {Math.min(currentMaintenancePage * maintenanceRowsPerPage, filteredMaintenance.length)} of {filteredMaintenance.length} records</span><div><button type="button" onClick={() => setMaintenancePage((prev) => Math.max(1, prev - 1))} disabled={currentMaintenancePage === 1}>Prev</button><strong>{currentMaintenancePage}</strong><button type="button" onClick={() => setMaintenancePage((prev) => Math.min(maintenanceTotalPages, prev + 1))} disabled={currentMaintenancePage === maintenanceTotalPages}>Next</button></div></div>
              </>
            )}

            {activeTab === "bookings" && (
              <>
                {pendingApprovalCount > 0 && <div className="maintenance-alert-banner"><AlertTriangle aria-hidden="true" /><strong>{pendingApprovalCount} completion reviews require manager action</strong><button type="button" onClick={() => setActiveTab("approvals")}>Go to Approval Queue</button></div>}
                <div className="maintenance-table-controls maintenance-table-controls--bookings">
                  <label className="maintenance-search-control"><Search aria-hidden="true" /><input type="search" placeholder="Search by vehicle, center, or work type..." value={bookingSearch} onChange={(event) => setBookingSearch(event.target.value)} /></label>
                  <label className="maintenance-select-control"><span>Status</span><select value={bookingStatusFilter} onChange={(event) => setBookingStatusFilter(event.target.value)}><option value="all">All Statuses</option><option value="scheduled">Scheduled</option><option value="in_progress">In Progress</option><option value="awaiting_review">Awaiting Review</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
                  <label className="maintenance-select-control"><span>Review</span><select value={bookingReviewFilter} onChange={(event) => setBookingReviewFilter(event.target.value)}><option value="all">All Reviews</option><option value="pending">Pending Review</option><option value="approved">Approved</option><option value="rejected">Needs Clarification</option><option value="not_required">Not Required</option></select></label>
                  <label className="maintenance-select-control maintenance-select-control--rows"><span>Rows</span><select value={bookingRowsPerPage} onChange={(event) => setBookingRowsPerPage(Number(event.target.value))}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
                  <button className="maintenance-table-action" type="button" onClick={() => { props.onCancelBookingEdit(); setShowBookingModal(true); }}><Plus aria-hidden="true" /> Create Booking</button>
                </div>
                {filteredBookings.length === 0 ? <div className="maintenance-empty-state"><CalendarClock aria-hidden="true" /><div><strong>No service bookings found</strong><span>Create bookings for vehicles that need workshop attention.</span></div></div> : (
                  <div className="maintenance-register-table maintenance-bookings-table">
                    <div className="maintenance-table__head"><span>Vehicle</span><span>Service Center</span><span>Requested Date</span><span>Work Type</span><span>Status</span><span>Review</span><span>Payment</span><span>Actions</span></div>
                    {paginatedBookings.map((booking) => {
                      const status = bookingWorkflowStatus(booking);
                      const review = reviewState(booking);
                      const payment = getBookingPaymentState(booking);
                      const canChange = (booking.status || "pending") === "pending";
                      return (
                        <div className="maintenance-table__row" key={booking.id}>
                          <span data-label="Vehicle"><strong>{vehicleLabelMap[booking.vehicle_id || ""] || "--"}</strong></span>
                          <span data-label="Service Center">{centerLabelMap[booking.center_id || ""] || "--"}</span>
                          <span data-label="Requested Date">{formatDate(booking.requested_date)}</span>
                          <span data-label="Work Type">{booking.work_type || booking.notes || "General Service"}</span>
                          <span data-label="Status"><span className={`maintenance-badge maintenance-badge--${status.tone}`}>{status.label}</span></span>
                          <span data-label="Review"><span className={`maintenance-badge maintenance-badge--${review.tone}`}>{review.label}</span></span>
                          <span data-label="Payment"><span className={`maintenance-badge maintenance-badge--${payment.tone}`}>{payment.label}</span></span>
                          <span className="maintenance-row-actions" data-label="Actions">
                            <button className="icon-action" type="button" onClick={() => setSelectedBooking(booking)} title="View booking" aria-label={`View booking ${booking.id}`}><Eye className="icon-action__svg icon-action__svg--view" aria-hidden="true" /></button>
                            {isPendingCompletionReview(booking) && <button className="icon-action" type="button" onClick={() => setApproveBookingTarget(booking)} disabled={props.loading} title="Approve completion" aria-label={`Approve completion ${booking.id}`}><CheckCircle2 className="icon-action__svg icon-action__svg--view" aria-hidden="true" /></button>}
                            {payment.payable && <button className="icon-action" type="button" onClick={() => props.onCreateBookingCheckout(booking.id)} disabled={props.loading} title="Pay service center" aria-label={`Pay service center for booking ${booking.id}`}><WalletCards className="icon-action__svg icon-action__svg--view" aria-hidden="true" /></button>}
                            <button className="icon-action" type="button" onClick={() => { props.onEditBooking(booking); setShowBookingModal(true); }} disabled={!canChange} title="Edit booking" aria-label={`Edit booking ${booking.id}`}><Pencil className="icon-action__svg icon-action__svg--edit" aria-hidden="true" /></button>
                            <button className="icon-action icon-action--danger" type="button" onClick={() => setDeleteBookingTarget(booking)} disabled={props.loading || !canChange} title="Delete booking" aria-label={`Delete booking ${booking.id}`}><Trash2 className="icon-action__svg icon-action__svg--delete" aria-hidden="true" /></button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="maintenance-table-footer"><span>Showing {filteredBookings.length === 0 ? 0 : (currentBookingPage - 1) * bookingRowsPerPage + 1} to {Math.min(currentBookingPage * bookingRowsPerPage, filteredBookings.length)} of {filteredBookings.length} bookings</span><div><button type="button" onClick={() => setBookingPage((prev) => Math.max(1, prev - 1))} disabled={currentBookingPage === 1}>Prev</button><strong>{currentBookingPage}</strong><button type="button" onClick={() => setBookingPage((prev) => Math.min(bookingTotalPages, prev + 1))} disabled={currentBookingPage === bookingTotalPages}>Next</button></div></div>
              </>
            )}

            {activeTab === "centers" && (
              <>
                <div className="maintenance-portal-strip">
                  <div className="maintenance-strip-title"><CalendarClock aria-hidden="true" /><div><strong>Portal Readiness Overview</strong><span>Status of service centers on FleetLanka portal</span></div></div>
                  <div><strong>{activePortalCenters.length}</strong><span>Active Portal Accounts</span></div>
                  <div><strong>{missingContactCenters.length}</strong><span>Centers Missing Contacts</span></div>
                  <div><strong>{pendingSetupCenters.length}</strong><span>Pending Account Setup</span></div>
                </div>
                <div className="maintenance-table-controls maintenance-table-controls--centers">
                  <label className="maintenance-search-control"><Search aria-hidden="true" /><input type="search" placeholder="Search by center name, contact, city..." value={centerSearch} onChange={(event) => setCenterSearch(event.target.value)} /></label>
                  <label className="maintenance-select-control"><span>Location</span><select value={centerLocationFilter} onChange={(event) => setCenterLocationFilter(event.target.value)}><option value="all">All Locations</option>{centerLocationOptions.map((location) => <option key={location} value={location}>{location}</option>)}</select></label>
                  <label className="maintenance-select-control"><span>Portal</span><select value={centerPortalFilter} onChange={(event) => setCenterPortalFilter(event.target.value)}><option value="all">All Portal Status</option><option value="active">Active</option><option value="pending_setup">Pending Setup</option><option value="missing_contacts">Missing Contacts</option></select></label>
                  <label className="maintenance-select-control maintenance-select-control--rows"><span>Rows</span><select value={centerRowsPerPage} onChange={(event) => setCenterRowsPerPage(Number(event.target.value))}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
                  <button className="maintenance-table-action" type="button" onClick={() => { props.onCancelCenterEdit(); setShowCenterModal(true); }}><Plus aria-hidden="true" /> Add Service Center</button>
                </div>
                {filteredCenters.length === 0 ? <div className="maintenance-empty-state"><Building2 aria-hidden="true" /><div><strong>No service centers found</strong><span>Add workshop partners to schedule and review maintenance work.</span></div></div> : (
                  <div className="maintenance-register-table maintenance-centers-table">
                    <div className="maintenance-table__head"><span>Center</span><span>Portal Account</span><span>Payment Access</span><span>Phone</span><span>Address</span><span>Actions</span></div>
                    {paginatedCenters.map((center) => {
                      const portal = getPortalState(center);
                      const paymentAccess = getPaymentAccessState(center);
                      return (
                        <div className="maintenance-table__row" key={center.id}>
                          <span data-label="Center"><strong>{center.name}</strong><small>{getCenterLocation(center)}</small></span>
                          <span data-label="Portal Account"><span className={`maintenance-badge maintenance-badge--${portal.tone}`}>{portal.label}</span></span>
                          <span data-label="Payment Access"><span className={`maintenance-badge maintenance-badge--${paymentAccess.tone}`}>{paymentAccess.label}</span></span>
                          <span data-label="Phone">{center.phone || "--"}</span>
                          <span data-label="Address">{center.address || "--"}</span>
                          <span className="maintenance-row-actions" data-label="Actions">
                            <button className="icon-action" type="button" onClick={() => setSelectedCenter(center)} title="View center" aria-label={`View center ${center.name}`}><Eye className="icon-action__svg icon-action__svg--view" aria-hidden="true" /></button>
                            <button className="icon-action" type="button" onClick={() => { props.onEditCenter(center); setShowCenterModal(true); }} title="Edit center" aria-label={`Edit center ${center.name}`}><Pencil className="icon-action__svg icon-action__svg--edit" aria-hidden="true" /></button>
                            <button className="icon-action icon-action--danger" type="button" onClick={() => setDeleteCenterTarget(center)} disabled={props.loading} title="Delete center" aria-label={`Delete center ${center.name}`}><Trash2 className="icon-action__svg icon-action__svg--delete" aria-hidden="true" /></button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="maintenance-table-footer"><span>Showing {filteredCenters.length === 0 ? 0 : (currentCenterPage - 1) * centerRowsPerPage + 1} to {Math.min(currentCenterPage * centerRowsPerPage, filteredCenters.length)} of {filteredCenters.length} service centers</span><div><button type="button" onClick={() => setCenterPage((prev) => Math.max(1, prev - 1))} disabled={currentCenterPage === 1}>Prev</button><strong>{currentCenterPage}</strong><button type="button" onClick={() => setCenterPage((prev) => Math.min(centerTotalPages, prev + 1))} disabled={currentCenterPage === centerTotalPages}>Next</button></div></div>
              </>
            )}

            {activeTab === "approvals" && (
              <>
                {pendingApprovalCount > 0 && <div className="maintenance-alert-banner maintenance-alert-banner--strong"><AlertTriangle aria-hidden="true" /><strong>Several completion reviews require your action.</strong><span>Please review and approve, reject, or request changes to proceed.</span></div>}
                <div className="maintenance-table-controls maintenance-table-controls--approvals">
                  <label className="maintenance-search-control"><Search aria-hidden="true" /><input type="search" placeholder="Search by vehicle, center, or work type..." value={approvalSearch} onChange={(event) => setApprovalSearch(event.target.value)} /></label>
                  <label className="maintenance-select-control"><span>Review</span><select value={approvalReviewFilter} onChange={(event) => setApprovalReviewFilter(event.target.value)}><option value="all">All Review Statuses</option><option value="pending">Pending Review</option><option value="approved">Approved</option><option value="rejected">Needs Clarification</option></select></label>
                  <label className="maintenance-select-control"><span>Center</span><select value={approvalCenterFilter} onChange={(event) => setApprovalCenterFilter(event.target.value)}><option value="all">All Service Centers</option>{props.centers.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}</select></label>
                  <label className="maintenance-select-control maintenance-select-control--rows"><span>Rows</span><select value={approvalRowsPerPage} onChange={(event) => setApprovalRowsPerPage(Number(event.target.value))}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
                </div>
                {filteredApprovals.length === 0 ? <div className="maintenance-empty-state"><ClipboardList aria-hidden="true" /><div><strong>No completion reviews found</strong><span>Completed bookings will appear here for manager review.</span></div></div> : (
                  <div className="maintenance-register-table maintenance-approvals-table">
                    <div className="maintenance-table__head"><span>Vehicle</span><span>Service Center</span><span>Work Type</span><span>Completed On</span><span>Proposed Updates</span><span>Review Status</span><span>Payment</span><span>Actions</span></div>
                    {paginatedApprovals.map((booking) => {
                      const review = reviewState(booking);
                      const updates = proposedUpdates(booking);
                      const payment = getBookingPaymentState(booking);
                      return (
                        <div className="maintenance-table__row" key={booking.id}>
                          <span data-label="Vehicle"><strong>{vehicleLabelMap[booking.vehicle_id || ""] || "--"}</strong></span>
                          <span data-label="Service Center">{centerLabelMap[booking.center_id || ""] || "--"}</span>
                          <span data-label="Work Type">{booking.work_type || booking.notes || "General Service"}</span>
                          <span data-label="Completed On">{formatDate(booking.completed_at || booking.requested_date)}</span>
                          <span data-label="Proposed Updates" className="maintenance-update-list">{updates.length ? updates.map((update) => <em key={update}>{update}</em>) : "--"}</span>
                          <span data-label="Review Status"><span className={`maintenance-badge maintenance-badge--${review.tone}`}>{review.label}</span></span>
                          <span data-label="Payment"><span className={`maintenance-badge maintenance-badge--${payment.tone}`}>{payment.label}</span></span>
                          <span className="maintenance-row-actions" data-label="Actions">
                            <button className="icon-action" type="button" onClick={() => setSelectedBooking(booking)} title="View review" aria-label={`View review ${booking.id}`}><Eye className="icon-action__svg icon-action__svg--view" aria-hidden="true" /></button>
                            {isPendingCompletionReview(booking) && <button className="icon-action" type="button" onClick={() => setApproveBookingTarget(booking)} disabled={props.loading} title="Approve completion" aria-label={`Approve completion ${booking.id}`}><CheckCircle2 className="icon-action__svg icon-action__svg--view" aria-hidden="true" /></button>}
                            {payment.payable && <button className="icon-action" type="button" onClick={() => props.onCreateBookingCheckout(booking.id)} disabled={props.loading} title="Pay service center" aria-label={`Pay service center for booking ${booking.id}`}><WalletCards className="icon-action__svg icon-action__svg--view" aria-hidden="true" /></button>}
                            {isPendingCompletionReview(booking) && <button className="icon-action icon-action--danger" type="button" onClick={() => { setRejectBookingTarget(booking); setRejectBookingNote(booking.completion_review_notes || ""); }} disabled={props.loading} title="Reject completion" aria-label={`Reject completion ${booking.id}`}><XCircle className="icon-action__svg icon-action__svg--delete" aria-hidden="true" /></button>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="maintenance-table-footer"><span>Showing {filteredApprovals.length === 0 ? 0 : (currentApprovalPage - 1) * approvalRowsPerPage + 1} to {Math.min(currentApprovalPage * approvalRowsPerPage, filteredApprovals.length)} of {filteredApprovals.length} reviews</span><div><button type="button" onClick={() => setApprovalPage((prev) => Math.max(1, prev - 1))} disabled={currentApprovalPage === 1}>Prev</button><strong>{currentApprovalPage}</strong><button type="button" onClick={() => setApprovalPage((prev) => Math.min(approvalTotalPages, prev + 1))} disabled={currentApprovalPage === approvalTotalPages}>Next</button></div></div>
              </>
            )}
          </section>

          <aside className="maintenance-side-column">
            <section className="maintenance-side-card">
              <div className="maintenance-side-header"><h3>Upcoming Service</h3><button type="button" onClick={() => setActiveTab("bookings")}>View all</button></div>
              {upcomingBookings.length === 0 ? <div className="maintenance-empty-state maintenance-empty-state--compact"><CalendarClock aria-hidden="true" /><div><strong>No upcoming bookings</strong><span>Scheduled service work will appear here.</span></div></div> : upcomingBookings.map((booking) => {
                const urgency = serviceUrgency(booking);
                return (
                  <button className="maintenance-side-row" type="button" key={booking.id} onClick={() => setSelectedBooking(booking)}>
                    <span className="maintenance-side-icon"><Target aria-hidden="true" /></span>
                    <span><strong>{vehicleLabelMap[booking.vehicle_id || ""] || "Vehicle"}</strong><small>{booking.work_type || booking.notes || "General Service"}</small></span>
                    <time>{formatDate(booking.requested_date)}</time>
                    <span className={`maintenance-badge maintenance-badge--${urgency.tone}`}>{urgency.label}</span>
                    <ChevronRight aria-hidden="true" />
                  </button>
                );
              })}
            </section>
            <section className="maintenance-side-card">
              <div className="maintenance-side-header"><h3>Vehicle Component Health</h3><button type="button" onClick={() => setActiveTab("records")}>View all</button></div>
              <div className="maintenance-health-list">{componentHealth.map((item) => {
                const percentage = item.total ? Math.round((item.healthy / item.total) * 100) : 0;
                const Icon = item.icon;
                return <div className="maintenance-health-row" key={item.label}><span className="maintenance-side-icon"><Icon aria-hidden="true" /></span><div><strong>{item.label}</strong><small>{item.total ? `${item.healthy} / ${item.total} Vehicles` : "No readings recorded"}</small><span className={`maintenance-health-bar maintenance-health-bar--${item.tone}`}><em style={{ width: `${percentage}%` }} /></span></div><span>{item.total ? `${percentage}%` : "--"}</span></div>;
              })}</div>
            </section>
            <section className="maintenance-side-card">
              <div className="maintenance-side-header"><h3>{activeTab === "centers" ? "Service Center Snapshot" : activeTab === "records" ? "Maintenance Performance" : "Monthly Snapshot"}</h3></div>
              {activeTab === "centers" ? (
                <div className="maintenance-performance-grid"><div><span>Active Portal Accounts</span><strong>{activePortalCenters.length}</strong></div><div><span>Centers Missing Contacts</span><strong>{missingContactCenters.length}</strong></div><div><span>Pending Account Setup</span><strong>{pendingSetupCenters.length}</strong></div><div><span>Total Service Centers</span><strong>{props.centers.length}</strong></div></div>
              ) : activeTab === "records" ? (
                <div className="maintenance-performance-grid"><div><span>Services This Month</span><strong>{maintenanceThisMonth.length}</strong></div><div><span>High Severity Records</span><strong>{highSeverityRecords.length}</strong></div><div><span>Avg. Service Cost</span><strong>{maintenanceThisMonth.length ? Math.round(maintenanceSpendThisMonth / maintenanceThisMonth.length).toLocaleString() : "--"}</strong></div><div><span>Month Spend</span><strong>{maintenanceSpendThisMonth.toLocaleString()}</strong></div></div>
              ) : (
                <div className="maintenance-performance-grid"><div><span>Approved Reviews</span><strong>{approvedReviews}</strong></div><div><span>Rejected Reviews</span><strong>{rejectedReviews}</strong></div><div><span>Active Service Centers</span><strong>{linkedCentersCount}</strong></div><div><span>High Severity Records</span><strong>{highSeverityRecords.length}</strong></div></div>
              )}
            </section>
          </aside>
        </div>
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
              <div className="form-toggle-row form-toggle-row--full">
                <label className="toggle-switch">
                  <span className="toggle-switch__label">Payment Access</span>
                  <input
                    className="toggle-switch__input"
                    type="checkbox"
                    checked={props.centerPaymentAccess}
                    onChange={(e) => props.setCenterPaymentAccess(e.target.checked)}
                  />
                  <span className="toggle-switch__track" aria-hidden="true">
                    <span className="toggle-switch__thumb" />
                  </span>
                </label>
                <small>Allow this service center to connect Stripe and receive booking payments.</small>
              </div>
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
              <div className="detail-item"><span>Payment Access</span><strong>{getPaymentAccessState(selectedCenter).label}</strong></div>
              <div className="detail-item"><span>Stripe Account</span><strong>{selectedCenter.stripe_account_id || "--"}</strong></div>
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
              <div className="detail-item"><span>Payment Status</span><strong>{getBookingPaymentState(selectedBooking).label}</strong></div>
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
            {!isPendingCompletionReview(selectedBooking) && getBookingPaymentState(selectedBooking).payable && (
              <div className="modal__actions">
                <button className="btn" type="button" disabled={props.loading} onClick={() => props.onCreateBookingCheckout(selectedBooking.id)}>
                  {props.loading ? "Opening Checkout..." : "Pay Service Center"}
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
