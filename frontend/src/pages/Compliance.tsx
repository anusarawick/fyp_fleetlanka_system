import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";

type Document = {
  id: string;
  vehicle_id?: string;
  driver_id?: string;
  doc_type: string;
  expiry_date?: string;
};

type MaintenanceRecord = {
  id: string;
  vehicle_id?: string;
  service_type?: string;
  service_date: string;
};

type Vehicle = {
  id: string;
  plate_no: string;
  make?: string;
  model?: string;
  status?: string;
  odometer_km?: number;
  next_service_due_km?: number;
  service_interval_km?: number;
  oil_interval_km?: number;
  tyre_life_km?: number;
  brake_life_km?: number;
  fuel_filter_interval_km?: number;
  last_service_odometer_km?: number;
  last_oil_change_odometer_km?: number;
  last_tyre_change_odometer_km?: number;
  last_brake_service_odometer_km?: number;
  last_fuel_filter_change_odometer_km?: number;
};

type ServiceBooking = {
  id: string;
  vehicle_id?: string;
  requested_date: string;
  status?: string;
  completion_review_status?: string;
};

type MaintenancePrediction = {
  vehicle_id: string;
  probability: number;
  risk_level: "low" | "medium" | "high";
  predicted_at?: string;
  input_features?: Record<string, unknown>;
};

type ComplianceProps = {
  documents: Document[];
  maintenance: MaintenanceRecord[];
  vehicles: Vehicle[];
  serviceBookings: ServiceBooking[];
  maintenancePredictionMap: Record<string, MaintenancePrediction>;
};

type RegisterCategory = "documents" | "maintenance" | "bookings";
type RegisterPriority = "critical" | "high" | "medium" | "low";
type RegisterTab = "all" | "critical" | RegisterCategory;
type RegisterStatus =
  | "all"
  | "expired"
  | "due-soon"
  | "overdue"
  | "at-risk"
  | "pending-review";
type DateRangeMode = "next7" | "next30" | "custom";
type ComplianceReportModal = "health" | "issues" | "calendar" | null;

type ComplianceRegisterRow = {
  id: string;
  category: RegisterCategory;
  priority: RegisterPriority;
  issue: string;
  asset: string;
  assetKey: string;
  dueDate: string;
  dueSort: number;
  status: Exclude<RegisterStatus, "all">;
  statusLabel: string;
  actionLabel: string;
  actionTo: string;
  searchText: string;
};

type TimelineItem = {
  id: string;
  title: string;
  asset: string;
  date: string;
  dueText: string;
  sort: number;
  category: RegisterCategory;
};

type MaintenanceRiskRow = {
  vehicle: Vehicle;
  prediction?: MaintenancePrediction;
  remainingKm?: number;
  priority: Extract<RegisterPriority, "high" | "medium">;
  status: Extract<ComplianceRegisterRow["status"], "overdue" | "at-risk">;
  statusLabel: "High Risk" | "At Risk" | "Overdue";
  issue: string;
  component: string;
  dueSort: number;
  dueDate: string;
  sortScore: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * DAY_MS;
const SERVICE_DUE_SOON_KM = 1200;

function startOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? undefined : parsed;
}

function formatDate(value?: string) {
  if (!value) return "Not recorded";
  const parsed = parseDate(value);
  if (!parsed) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(parsed));
}

function compactDate(value?: string) {
  const parsed = parseDate(value);
  if (!parsed) return { month: "--", day: "--" };
  const date = new Date(parsed);
  return {
    month: new Intl.DateTimeFormat(undefined, { month: "short" }).format(date).toUpperCase(),
    day: new Intl.DateTimeFormat(undefined, { day: "2-digit" }).format(date),
  };
}

function relativeDueText(value?: string) {
  const parsed = parseDate(value);
  if (!parsed) return "Date missing";
  const deltaDays = Math.ceil((startOfLocalDay(new Date(parsed)) - startOfLocalDay()) / DAY_MS);
  if (deltaDays < 0) return "Overdue";
  if (deltaDays === 0) return "Due today";
  if (deltaDays === 1) return "Due tomorrow";
  return `Due in ${deltaDays} days`;
}

function vehicleLabel(vehicle?: Vehicle) {
  if (!vehicle) return "Vehicle not found";
  return vehicle.plate_no || [vehicle.make, vehicle.model].filter(Boolean).join(" ").trim() || "Vehicle not found";
}

function bookingLabel(booking: ServiceBooking) {
  return `Booking #${booking.id.slice(0, 6).toUpperCase()}`;
}

function statusLabel(value?: string) {
  const normalized = (value || "pending").replace(/_/g, " ");
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function priorityRank(priority: RegisterPriority) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[priority];
}

function priorityBadgeClass(priority: RegisterPriority) {
  if (priority === "critical") return "documents-badge documents-badge--danger";
  if (priority === "high") return "documents-badge documents-badge--warning";
  if (priority === "medium") return "documents-badge documents-badge--info";
  return "documents-badge documents-badge--success";
}

function statusBadgeClass(status: ComplianceRegisterRow["status"]) {
  if (status === "expired" || status === "overdue") return "documents-status-badge documents-status-badge--danger";
  if (status === "due-soon" || status === "at-risk") return "documents-status-badge documents-status-badge--warning";
  if (status === "pending-review") return "documents-status-badge documents-status-badge--info";
  return "documents-status-badge documents-status-badge--neutral";
}

function countByType(items: string[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = item || "Not classified";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function topGroups(groups: Record<string, number>, fallback: string) {
  const entries = Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 4);
  return entries.length ? entries : [[fallback, 0] as [string, number]];
}

function formatDateInput(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getFeatureNumber(prediction: MaintenancePrediction | undefined, key: string, fallback = 0) {
  const raw = prediction?.input_features?.[key];
  const parsed = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ratioFromVehicle(current?: number, last?: number, interval?: number) {
  if (!current || !last || !interval) return 0;
  return Math.max(0, (Number(current) - Number(last)) / Number(interval));
}

function componentRisk(vehicle: Vehicle, prediction?: MaintenancePrediction) {
  const rows = [
    { label: "Engine Service", ratio: getFeatureNumber(prediction, "service_due_ratio", ratioFromVehicle(vehicle.odometer_km, vehicle.last_service_odometer_km, vehicle.service_interval_km)) },
    { label: "Oil Service", ratio: getFeatureNumber(prediction, "oil_due_ratio", ratioFromVehicle(vehicle.odometer_km, vehicle.last_oil_change_odometer_km, vehicle.oil_interval_km)) },
    { label: "Tyres", ratio: getFeatureNumber(prediction, "tyre_wear_ratio", ratioFromVehicle(vehicle.odometer_km, vehicle.last_tyre_change_odometer_km, vehicle.tyre_life_km)) },
    { label: "Brake System", ratio: getFeatureNumber(prediction, "brake_wear_ratio", ratioFromVehicle(vehicle.odometer_km, vehicle.last_brake_service_odometer_km, vehicle.brake_life_km)) },
    { label: "Fuel Filter", ratio: getFeatureNumber(prediction, "fuel_filter_due_ratio", ratioFromVehicle(vehicle.odometer_km, vehicle.last_fuel_filter_change_odometer_km, vehicle.fuel_filter_interval_km)) },
  ].sort((a, b) => b.ratio - a.ratio);
  return rows[0]?.ratio > 0 ? rows[0] : { label: "Service Due", ratio: 0 };
}

export default function Compliance(props: ComplianceProps) {
  const [activeTab, setActiveTab] = useState<RegisterTab>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RegisterStatus>("all");
  const [assetFilter, setAssetFilter] = useState("all");
  const [dateRangeMode, setDateRangeMode] = useState<DateRangeMode>("next30");
  const [customDateFrom, setCustomDateFrom] = useState(formatDateInput(startOfLocalDay()));
  const [customDateTo, setCustomDateTo] = useState(formatDateInput(startOfLocalDay() + THIRTY_DAYS_MS));
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [complianceReportModal, setComplianceReportModal] = useState<ComplianceReportModal>(null);

  const today = startOfLocalDay();

  const vehicleMap = useMemo(
    () =>
      props.vehicles.reduce<Record<string, Vehicle>>((acc, vehicle) => {
        acc[vehicle.id] = vehicle;
        return acc;
      }, {}),
    [props.vehicles]
  );

  const expiredDocuments = useMemo(
    () =>
      props.documents.filter((doc) => {
        const expiry = parseDate(doc.expiry_date);
        return typeof expiry === "number" && expiry < today;
      }),
    [props.documents, today]
  );

  const expiringSoonDocuments = useMemo(
    () =>
      props.documents.filter((doc) => {
        const expiry = parseDate(doc.expiry_date);
        return typeof expiry === "number" && expiry >= today && expiry <= today + THIRTY_DAYS_MS;
      }),
    [props.documents, today]
  );

  const maintenanceRiskRows = useMemo<MaintenanceRiskRow[]>(
    () =>
      props.vehicles
        .map((vehicle) => {
          const prediction = props.maintenancePredictionMap[vehicle.id];
          const hasPrediction = !!prediction;
          const component = componentRisk(vehicle, prediction);
          const remainingKm =
            typeof vehicle.odometer_km === "number" && typeof vehicle.next_service_due_km === "number"
              ? vehicle.next_service_due_km - vehicle.odometer_km
              : undefined;

          if (prediction?.risk_level === "high") {
            return {
              vehicle,
              prediction,
              remainingKm,
              priority: "high" as const,
              status: "overdue" as const,
              statusLabel: "High Risk" as const,
              issue: `${component.label} High Risk`,
              component: component.label,
              dueSort: today,
              dueDate: "ML high risk",
              sortScore: prediction.probability,
            };
          }

          if (prediction?.risk_level === "medium") {
            return {
              vehicle,
              prediction,
              remainingKm,
              priority: "medium" as const,
              status: "at-risk" as const,
              statusLabel: "At Risk" as const,
              issue: `${component.label} At Risk`,
              component: component.label,
              dueSort: today + DAY_MS * 6,
              dueDate: "Within 7 days",
              sortScore: prediction.probability,
            };
          }

          if (!hasPrediction && typeof remainingKm === "number" && remainingKm <= SERVICE_DUE_SOON_KM) {
            const overdue = remainingKm <= 0;
            return {
              vehicle,
              remainingKm,
              priority: overdue ? "high" as const : "medium" as const,
              status: overdue ? "overdue" as const : "at-risk" as const,
              statusLabel: overdue ? "Overdue" as const : "At Risk" as const,
              issue: overdue ? "Service Overdue" : "Service Due Soon",
              component: "Service Due",
              dueSort: overdue ? today : today + DAY_MS * 6,
              dueDate: `${Math.round(vehicle.next_service_due_km || 0).toLocaleString()} km`,
              sortScore: overdue ? 0.85 : 0.65,
            };
          }

          return null;
        })
        .filter(Boolean)
        .sort((a, b) => (b?.sortScore || 0) - (a?.sortScore || 0)) as MaintenanceRiskRow[],
    [props.maintenancePredictionMap, props.vehicles, today]
  );

  const overdueMaintenance = maintenanceRiskRows.filter((row) => row.priority === "high");
  const dueSoonMaintenance = maintenanceRiskRows.filter((row) => row.priority === "medium");

  const pendingBookings = useMemo(
    () =>
      props.serviceBookings.filter(
        (booking) =>
          (booking.status || "pending").toLowerCase() === "completed" &&
          (booking.completion_review_status || "pending").toLowerCase() !== "approved"
      ),
    [props.serviceBookings]
  );

  const overdueBookingReviews = pendingBookings.filter((booking) => {
    const requested = parseDate(booking.requested_date);
    return typeof requested === "number" && requested < today;
  });

  const registerRows = useMemo<ComplianceRegisterRow[]>(() => {
    const documentRows = [
      ...expiredDocuments.map((doc): ComplianceRegisterRow => {
        const asset = doc.vehicle_id ? vehicleLabel(vehicleMap[doc.vehicle_id]) : doc.driver_id ? "Driver document" : "Owner not recorded";
        return {
          id: `doc-expired-${doc.id}`,
          category: "documents",
          priority: "critical",
          issue: `${doc.doc_type} Expired`,
          asset,
          assetKey: doc.vehicle_id ? `vehicle:${doc.vehicle_id}` : doc.driver_id ? `driver:${doc.driver_id}` : "other",
          dueDate: formatDate(doc.expiry_date),
          dueSort: parseDate(doc.expiry_date) || 0,
          status: "expired",
          statusLabel: "Expired",
          actionLabel: "Renew",
          actionTo: "/documents",
          searchText: `${doc.doc_type} ${asset} expired ${doc.expiry_date || ""}`,
        };
      }),
      ...expiringSoonDocuments.map((doc): ComplianceRegisterRow => {
        const asset = doc.vehicle_id ? vehicleLabel(vehicleMap[doc.vehicle_id]) : doc.driver_id ? "Driver document" : "Owner not recorded";
        return {
          id: `doc-soon-${doc.id}`,
          category: "documents",
          priority: "medium",
          issue: `${doc.doc_type} Expiring Soon`,
          asset,
          assetKey: doc.vehicle_id ? `vehicle:${doc.vehicle_id}` : doc.driver_id ? `driver:${doc.driver_id}` : "other",
          dueDate: formatDate(doc.expiry_date),
          dueSort: parseDate(doc.expiry_date) || Number.MAX_SAFE_INTEGER,
          status: "due-soon",
          statusLabel: "Due Soon",
          actionLabel: "Renew",
          actionTo: "/documents",
          searchText: `${doc.doc_type} ${asset} expiring soon ${doc.expiry_date || ""}`,
        };
      }),
    ];

    const maintenanceRows = maintenanceRiskRows.map((row): ComplianceRegisterRow => {
      const { vehicle } = row;
      return {
        id: `maintenance-${vehicle.id}`,
        category: "maintenance",
        priority: row.priority,
        issue: row.issue,
        asset: vehicleLabel(vehicle),
        assetKey: `vehicle:${vehicle.id}`,
        dueDate: row.dueDate,
        dueSort: row.dueSort,
        status: row.status,
        statusLabel: row.statusLabel,
        actionLabel: "Schedule",
        actionTo: "/maintenance",
        searchText: `${vehicleLabel(vehicle)} ${row.issue} ${row.component} ${row.prediction?.risk_level || ""} ${row.remainingKm || ""}`,
      };
    });

    const bookingRows = pendingBookings.map((booking): ComplianceRegisterRow => {
      const requested = parseDate(booking.requested_date);
      const overdue = typeof requested === "number" && requested < today;
      const asset = booking.vehicle_id ? vehicleLabel(vehicleMap[booking.vehicle_id]) : bookingLabel(booking);
      return {
        id: `booking-${booking.id}`,
        category: "bookings",
        priority: overdue ? "high" : "low",
        issue: "Booking Completion Review",
        asset,
        assetKey: booking.vehicle_id ? `vehicle:${booking.vehicle_id}` : `booking:${booking.id}`,
        dueDate: formatDate(booking.requested_date),
        dueSort: requested || Number.MAX_SAFE_INTEGER,
        status: "pending-review",
        statusLabel: "Pending Review",
        actionLabel: "Review",
        actionTo: "/maintenance",
        searchText: `${asset} ${booking.id} booking completion review ${booking.completion_review_status || "pending"}`,
      };
    });

    return [...documentRows, ...maintenanceRows, ...bookingRows].sort((a, b) => {
      const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
      if (priorityDelta !== 0) return priorityDelta;
      return a.dueSort - b.dueSort;
    });
  }, [expiredDocuments, expiringSoonDocuments, maintenanceRiskRows, pendingBookings, vehicleMap]);

  const dateRangeWindow = useMemo(() => {
    if (dateRangeMode === "next7") return { start: Number.NEGATIVE_INFINITY, end: today + 7 * DAY_MS };
    if (dateRangeMode === "next30") return { start: Number.NEGATIVE_INFINITY, end: today + THIRTY_DAYS_MS };
    return {
      start: customDateFrom ? startOfLocalDay(new Date(`${customDateFrom}T00:00:00`)) : Number.NEGATIVE_INFINITY,
      end: customDateTo ? startOfLocalDay(new Date(`${customDateTo}T00:00:00`)) : Number.POSITIVE_INFINITY,
    };
  }, [customDateFrom, customDateTo, dateRangeMode, today]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return registerRows.filter((row) => {
      const tabMatches = activeTab === "all" ? true : activeTab === "critical" ? row.priority === "critical" : row.category === activeTab;
      const statusMatches = statusFilter === "all" ? true : row.status === statusFilter;
      const assetMatches = assetFilter === "all" ? true : row.assetKey === assetFilter;
      const dateMatches = row.dueSort >= dateRangeWindow.start && row.dueSort <= dateRangeWindow.end;
      const searchMatches = query ? row.searchText.toLowerCase().includes(query) : true;
      return tabMatches && statusMatches && assetMatches && dateMatches && searchMatches;
    });
  }, [activeTab, assetFilter, dateRangeWindow, registerRows, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const assetOptions = useMemo(() => {
    const options = registerRows.reduce<Record<string, string>>((acc, row) => {
      acc[row.assetKey] = row.asset;
      return acc;
    }, {});
    return Object.entries(options).sort((a, b) => a[1].localeCompare(b[1]));
  }, [registerRows]);

  const documentBreakdown = countByType(expiredDocuments.map((doc) => doc.doc_type));
  const renewalBreakdown = countByType(expiringSoonDocuments.map((doc) => doc.doc_type));
  const bookingBreakdown = countByType(pendingBookings.map((booking) => statusLabel(booking.completion_review_status)));
  const maintenanceBreakdown = countByType(maintenanceRiskRows.map((row) => row.component));

  const criticalCount = expiredDocuments.length + overdueMaintenance.length + overdueBookingReviews.length;
  const issueCounts = {
    documents: expiredDocuments.length + expiringSoonDocuments.length,
    maintenance: maintenanceRiskRows.length,
    bookings: pendingBookings.length,
    other: props.vehicles.filter((vehicle) => (vehicle.status || "").toLowerCase() === "maintenance").length,
  };
  const issueTotal = Math.max(1, issueCounts.documents + issueCounts.maintenance + issueCounts.bookings + issueCounts.other);
  const healthScore = Math.max(
    0,
    Math.min(100, 100 - criticalCount * 8 - dueSoonMaintenance.length * 4 - pendingBookings.length * 3)
  );
  const healthSegments = {
    good: Math.max(0, Math.min(100, healthScore)),
    atRisk: Math.max(0, Math.min(100, 100 - healthScore - criticalCount * 3)),
    critical: Math.max(0, Math.min(100, criticalCount * 3)),
  };

  const nextSevenDays = useMemo<TimelineItem[]>(() => {
    const maxDate = today + 7 * DAY_MS;
    const documentItems = [...expiredDocuments, ...expiringSoonDocuments]
      .filter((doc) => {
        const expiry = parseDate(doc.expiry_date);
        return typeof expiry === "number" && expiry >= today && expiry <= maxDate;
      })
      .map((doc) => ({
        id: `next-doc-${doc.id}`,
        title: `${doc.doc_type} Expiry`,
        asset: doc.vehicle_id ? vehicleLabel(vehicleMap[doc.vehicle_id]) : doc.driver_id ? "Driver document" : "Owner not recorded",
        date: doc.expiry_date || "",
        dueText: relativeDueText(doc.expiry_date),
        sort: parseDate(doc.expiry_date) || Number.MAX_SAFE_INTEGER,
        category: "documents" as const,
      }));

    const bookingItems = pendingBookings
      .filter((booking) => {
        const requested = parseDate(booking.requested_date);
        return typeof requested === "number" && requested >= today && requested <= maxDate;
      })
      .map((booking) => ({
        id: `next-booking-${booking.id}`,
        title: "Booking Review Due",
        asset: booking.vehicle_id ? vehicleLabel(vehicleMap[booking.vehicle_id]) : bookingLabel(booking),
        date: booking.requested_date,
        dueText: relativeDueText(booking.requested_date),
        sort: parseDate(booking.requested_date) || Number.MAX_SAFE_INTEGER,
        category: "bookings" as const,
      }));

    const maintenanceItems = dueSoonMaintenance.slice(0, 2).map(({ vehicle, component }, index) => {
      const sort = today + DAY_MS * (index + 1);
      return {
        id: `next-maintenance-${vehicle.id}`,
        title: `${component} At Risk`,
        asset: vehicleLabel(vehicle),
        date: formatDateInput(sort),
        dueText: "Within 7 days",
        sort,
        category: "maintenance" as const,
      };
    });

    return [...documentItems, ...bookingItems, ...maintenanceItems].sort((a, b) => a.sort - b.sort).slice(0, 5);
  }, [dueSoonMaintenance, expiredDocuments, expiringSoonDocuments, pendingBookings, today, vehicleMap]);

  const calendarItems = useMemo<TimelineItem[]>(() => {
    const maxDate = today + 7 * DAY_MS;
    const documentItems = [...expiredDocuments, ...expiringSoonDocuments]
      .filter((doc) => {
        const expiry = parseDate(doc.expiry_date);
        return typeof expiry === "number" && expiry >= today && expiry <= maxDate;
      })
      .map((doc) => ({
        id: `calendar-doc-${doc.id}`,
        title: `${doc.doc_type} Expiry`,
        asset: doc.vehicle_id ? vehicleLabel(vehicleMap[doc.vehicle_id]) : doc.driver_id ? "Driver document" : "Owner not recorded",
        date: doc.expiry_date || "",
        dueText: relativeDueText(doc.expiry_date),
        sort: parseDate(doc.expiry_date) || Number.MAX_SAFE_INTEGER,
        category: "documents" as const,
      }));

    const bookingItems = pendingBookings
      .filter((booking) => {
        const requested = parseDate(booking.requested_date);
        return typeof requested === "number" && requested >= today && requested <= maxDate;
      })
      .map((booking) => ({
        id: `calendar-booking-${booking.id}`,
        title: "Booking Review Due",
        asset: booking.vehicle_id ? vehicleLabel(vehicleMap[booking.vehicle_id]) : bookingLabel(booking),
        date: booking.requested_date,
        dueText: relativeDueText(booking.requested_date),
        sort: parseDate(booking.requested_date) || Number.MAX_SAFE_INTEGER,
        category: "bookings" as const,
      }));

    const maintenanceItems = dueSoonMaintenance.map(({ vehicle, component }, index) => {
      const sort = today + DAY_MS * Math.min(6, index + 1);
      return {
        id: `calendar-maintenance-${vehicle.id}`,
        title: `${component} At Risk`,
        asset: vehicleLabel(vehicle),
        date: formatDateInput(sort),
        dueText: "Within 7 days",
        sort,
        category: "maintenance" as const,
      };
    });

    return [...documentItems, ...bookingItems, ...maintenanceItems].sort((a, b) => a.sort - b.sort);
  }, [dueSoonMaintenance, expiredDocuments, expiringSoonDocuments, pendingBookings, today, vehicleMap]);

  const calendarDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const timestamp = today + index * DAY_MS;
        const key = formatDateInput(timestamp);
        return {
          key,
          label: index === 0 ? "Today" : index === 1 ? "Tomorrow" : new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(new Date(timestamp)),
          dateLabel: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(timestamp)),
          items: calendarItems.filter((item) => formatDateInput(item.sort) === key),
        };
      }),
    [calendarItems, today]
  );

  const registerTabs: Array<{ key: RegisterTab; label: string; count: number; icon: typeof ShieldCheck }> = [
    { key: "all", label: "All", count: registerRows.length, icon: ShieldCheck },
    { key: "critical", label: "Critical", count: registerRows.filter((row) => row.priority === "critical").length, icon: AlertTriangle },
    { key: "documents", label: "Documents", count: issueCounts.documents, icon: FileText },
    { key: "maintenance", label: "Maintenance", count: issueCounts.maintenance, icon: Wrench },
    { key: "bookings", label: "Bookings", count: issueCounts.bookings, icon: ClipboardCheck },
  ];

  const issueBreakdownRows: Array<{
    label: string;
    count: number;
    detail: string;
    icon: typeof FileText;
    category?: RegisterCategory;
  }> = [
    {
      label: "Documents",
      count: issueCounts.documents,
      detail: `${expiredDocuments.length} expired, ${expiringSoonDocuments.length} expiring soon`,
      icon: FileText,
      category: "documents",
    },
    {
      label: "Maintenance",
      count: issueCounts.maintenance,
      detail: `${overdueMaintenance.length} high priority, ${dueSoonMaintenance.length} medium priority`,
      icon: Wrench,
      category: "maintenance",
    },
    {
      label: "Bookings",
      count: issueCounts.bookings,
      detail: `${pendingBookings.length} pending completion reviews`,
      icon: ClipboardCheck,
      category: "bookings",
    },
    {
      label: "Other",
      count: issueCounts.other,
      detail: "Vehicles currently marked for maintenance",
      icon: ShieldCheck,
    },
  ];

  function showAllIssues(closeModal = false) {
    setActiveTab("all");
    setStatusFilter("all");
    setAssetFilter("all");
    setSearch("");
    setDateRangeMode("next30");
    setPage(1);
    if (closeModal) setComplianceReportModal(null);
  }

  function showIssueCategory(category: RegisterCategory) {
    setActiveTab(category);
    setStatusFilter("all");
    setAssetFilter("all");
    setSearch("");
    setDateRangeMode("next30");
    setPage(1);
    setComplianceReportModal(null);
  }

  function showNextSevenDays(closeModal = false) {
    setActiveTab("all");
    setStatusFilter("all");
    setAssetFilter("all");
    setSearch("");
    setDateRangeMode("next7");
    setPage(1);
    if (closeModal) setComplianceReportModal(null);
  }

  return (
    <section className="section">
      <section className="admin-page compliance-page people-page people-page--compliance">
        <section className="dashboard-kpis compliance-kpi-grid" aria-label="Compliance summary">
          <article className="dashboard-kpi-card dashboard-kpi-card--red compliance-kpi-card">
            <span className="dashboard-kpi-card__icon"><ShieldCheck aria-hidden="true" /></span>
            <div>
              <small>Critical Alerts</small>
              <strong>{criticalCount}</strong>
              <span className={criticalCount > 0 ? "dashboard-trend dashboard-trend--down" : "dashboard-trend dashboard-trend--up"}>
                {criticalCount > 0 ? "Needs action" : "No critical items"}
              </span>
            </div>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card--amber compliance-kpi-card">
            <span className="dashboard-kpi-card__icon"><CalendarDays aria-hidden="true" /></span>
            <div>
              <small>Expiring in 30 Days</small>
              <strong>{expiringSoonDocuments.length}</strong>
              <span className="dashboard-trend dashboard-trend--warning">Document renewals</span>
            </div>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card--orange compliance-kpi-card">
            <span className="dashboard-kpi-card__icon"><Wrench aria-hidden="true" /></span>
            <div>
              <small>Overdue Maintenance</small>
              <strong>{overdueMaintenance.length}</strong>
              <span className="dashboard-trend dashboard-trend--warning">By odometer due km</span>
            </div>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card--purple compliance-kpi-card">
            <span className="dashboard-kpi-card__icon"><ClipboardCheck aria-hidden="true" /></span>
            <div>
              <small>Pending Booking Reviews</small>
              <strong>{pendingBookings.length}</strong>
              <span className="dashboard-trend dashboard-trend--neutral">Completed jobs</span>
            </div>
          </article>
        </section>

        <section className="compliance-summary-grid" aria-label="Compliance action groups">
          <ComplianceSummaryCard
            icon={AlertTriangle}
            title="Expired Documents"
            total={expiredDocuments.length}
            rows={topGroups(documentBreakdown, "No expired documents")}
            actionLabel={`View Expired (${expiredDocuments.length})`}
            to="/documents"
            tone="danger"
          />
          <ComplianceSummaryCard
            icon={CalendarDays}
            title="Upcoming Renewals"
            total={expiringSoonDocuments.length}
            rows={topGroups(renewalBreakdown, "No upcoming renewals")}
            actionLabel={`View Renewals (${expiringSoonDocuments.length})`}
            to="/documents"
            tone="warning"
          />
          <ComplianceSummaryCard
            icon={Wrench}
            title="High-Risk Maintenance"
            total={maintenanceRiskRows.length}
            rows={topGroups(maintenanceBreakdown, "No high-risk maintenance")}
            actionLabel={`View Maintenance (${maintenanceRiskRows.length})`}
            to="/maintenance"
            tone="warning"
          />
          <ComplianceSummaryCard
            icon={ClipboardCheck}
            title="Booking Completion Reviews"
            total={pendingBookings.length}
            rows={topGroups(bookingBreakdown, "No pending reviews")}
            actionLabel={`View Reviews (${pendingBookings.length})`}
            to="/maintenance"
            tone="info"
          />
        </section>

        <div className="compliance-workspace-grid">
          <section className="card compliance-register-card">
            <div className="compliance-card-header">
              <h3>Compliance Register</h3>
            </div>

            <div className="compliance-register-tabs" aria-label="Compliance register filters">
              {registerTabs.map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <button
                    type="button"
                    className={activeTab === tab.key ? "is-active" : ""}
                    onClick={() => {
                      setActiveTab(tab.key);
                      setPage(1);
                    }}
                    key={tab.key}
                  >
                    <TabIcon aria-hidden="true" />
                    {tab.label} ({tab.count})
                  </button>
                );
              })}
            </div>

            <div className="compliance-table-controls">
              <label className="compliance-search-control">
                <Search aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search by asset, issue, or reference..."
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label className="compliance-select-control">
                <span>Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as RegisterStatus);
                    setPage(1);
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="expired">Expired</option>
                  <option value="due-soon">Due Soon</option>
                  <option value="overdue">Overdue</option>
                  <option value="at-risk">At Risk</option>
                  <option value="pending-review">Pending Review</option>
                </select>
              </label>
              <label className="compliance-select-control">
                <span>Asset</span>
                <select
                  value={assetFilter}
                  onChange={(event) => {
                    setAssetFilter(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All Assets</option>
                  {assetOptions.map(([key, label]) => (
                    <option value={key} key={key}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="compliance-select-control compliance-select-control--date">
                <span>Range</span>
                <select
                  value={dateRangeMode}
                  onChange={(event) => {
                    setDateRangeMode(event.target.value as DateRangeMode);
                    setPage(1);
                  }}
                >
                  <option value="next7">Next 7 Days</option>
                  <option value="next30">Next 30 Days</option>
                  <option value="custom">Custom Range</option>
                </select>
                <CalendarDays aria-hidden="true" />
              </label>
              <label className="compliance-select-control compliance-select-control--rows">
                <span>Rows</span>
                <select
                  value={rowsPerPage}
                  onChange={(event) => {
                    setRowsPerPage(Number(event.target.value));
                    setPage(1);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>
              {dateRangeMode === "custom" && (
                <div className="compliance-custom-range">
                  <label>
                    <span>From</span>
                    <input
                      type="date"
                      value={customDateFrom}
                      onChange={(event) => {
                        setCustomDateFrom(event.target.value);
                        setPage(1);
                      }}
                    />
                  </label>
                  <label>
                    <span>To</span>
                    <input
                      type="date"
                      value={customDateTo}
                      onChange={(event) => {
                        setCustomDateTo(event.target.value);
                        setPage(1);
                      }}
                    />
                  </label>
                </div>
              )}
            </div>

            {filteredRows.length === 0 ? (
              <p className="empty">No compliance issues match the current filters.</p>
            ) : (
              <div className="compliance-register-table">
                <div className="compliance-table__head">
                  <span>Priority</span>
                  <span>Issue</span>
                  <span>Related Asset</span>
                  <span>Due Date</span>
                  <span>Status</span>
                  <span>Action</span>
                </div>
                {visibleRows.map((row) => (
                  <div className="compliance-table__row" key={row.id}>
                    <span data-label="Priority">
                      <b className={priorityBadgeClass(row.priority)}>{row.priority === "critical" ? "Critical" : row.priority[0].toUpperCase() + row.priority.slice(1)}</b>
                    </span>
                    <span className="compliance-issue-cell" data-label="Issue">
                      {row.category === "documents" ? <FileText aria-hidden="true" /> : row.category === "maintenance" ? <Wrench aria-hidden="true" /> : <ClipboardCheck aria-hidden="true" />}
                      <strong>{row.issue}</strong>
                    </span>
                    <span data-label="Related Asset">{row.asset}</span>
                    <span className={row.priority === "critical" || row.status === "overdue" ? "compliance-danger-date" : ""} data-label="Due Date">
                      {row.dueDate}
                    </span>
                    <span data-label="Status">
                      <b className={statusBadgeClass(row.status)}>{row.statusLabel}</b>
                    </span>
                    <span className="compliance-table__actions" data-label="Action">
                      <Link className="compliance-action-link" to={row.actionTo}>
                        {row.actionLabel}
                        <ChevronRight aria-hidden="true" />
                      </Link>
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="documents-table-footer compliance-table-footer">
              <span>
                Showing {filteredRows.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredRows.length)} of {filteredRows.length} issues
              </span>
              <div className="table-pagination documents-pagination-controls">
                <span className="table-pagination__meta">Page {currentPage} of {totalPages}</span>
                <button
                  className="documents-page-button"
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft aria-hidden="true" />
                  Prev
                </button>
                <span className="documents-page-button documents-page-button--active">{currentPage}</span>
                <button
                  className="documents-page-button"
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>

          <aside className="compliance-side-panel">
            <section className="card compliance-side-card">
              <div className="compliance-side-card__header">
                <h3>Compliance Health Score</h3>
                <button type="button" onClick={() => setComplianceReportModal("health")}>View report</button>
              </div>
              <div className="compliance-health-card">
                <div className="compliance-health-donut" style={{ "--score": `${healthScore * 3.6}deg` } as React.CSSProperties}>
                  <strong>{healthScore}</strong>
                  <span>/ 100</span>
                  <small>{healthScore >= 80 ? "Good" : healthScore >= 50 ? "At Risk" : "Critical"}</small>
                </div>
                <div className="compliance-health-legend">
                  <span><i className="dot dot--green" />Good (80-100)<b>{healthSegments.good}%</b></span>
                  <span><i className="dot dot--orange" />At Risk (50-79)<b>{healthSegments.atRisk}%</b></span>
                  <span><i className="dot dot--red" />Critical (0-49)<b>{healthSegments.critical}%</b></span>
                </div>
              </div>
            </section>

            <section className="card compliance-side-card">
              <div className="compliance-side-card__header">
                <h3>Issue Breakdown</h3>
                <button type="button" onClick={() => setComplianceReportModal("issues")}>View all</button>
              </div>
              <div className="compliance-breakdown-list">
                <BreakdownRow icon={FileText} label="Documents" count={issueCounts.documents} total={issueTotal} tone="blue" />
                <BreakdownRow icon={Wrench} label="Maintenance" count={issueCounts.maintenance} total={issueTotal} tone="orange" />
                <BreakdownRow icon={ClipboardCheck} label="Bookings" count={issueCounts.bookings} total={issueTotal} tone="purple" />
                <BreakdownRow icon={ShieldCheck} label="Other" count={issueCounts.other} total={issueTotal} tone="slate" />
              </div>
            </section>

            <section className="card compliance-side-card">
              <div className="compliance-side-card__header">
                <h3>Next 7 Days</h3>
                <button type="button" onClick={() => setComplianceReportModal("calendar")}>View calendar</button>
              </div>
              <div className="compliance-timeline-list">
                {nextSevenDays.length === 0 ? (
                  <p className="empty">No dated compliance work in the next 7 days.</p>
                ) : (
                  nextSevenDays.map((item) => {
                    const date = compactDate(item.date);
                    return (
                      <div className="compliance-timeline-row" key={item.id}>
                        <span className="compliance-date-chip"><small>{date.month}</small><b>{date.day}</b></span>
                        <div>
                          <strong>{item.title}</strong>
                          <small>{item.asset}</small>
                        </div>
                        <b>{item.dueText}</b>
                      </div>
                    );
                  })
                )}
              </div>
              <button className="compliance-view-all" type="button" onClick={() => setComplianceReportModal("calendar")}>
                View all upcoming ({nextSevenDays.length})
                <ChevronRight aria-hidden="true" />
              </button>
            </section>
          </aside>
        </div>

        {complianceReportModal === "health" && (
          <div className="modal-backdrop" role="presentation">
            <div className="modal modal--wide modal--details" role="dialog" aria-modal="true" aria-label="Compliance health report">
              <div className="modal__header">
                <div>
                  <h3>Compliance Health Report</h3>
                  <p className="modal__subtle">Score, issue mix, and category totals from the current compliance register.</p>
                </div>
                <button className="modal__close" type="button" onClick={() => setComplianceReportModal(null)} aria-label="Close compliance health report">
                  ✕
                </button>
              </div>
              <div className="details-grid details-grid--scroll">
                <div className="detail-item"><span>Health Score</span><strong>{healthScore} / 100</strong><small>{healthScore >= 80 ? "Good" : healthScore >= 50 ? "At Risk" : "Critical"}</small></div>
                <div className="detail-item"><span>Critical Items</span><strong>{criticalCount}</strong><small>Expired documents, overdue maintenance, and overdue booking reviews.</small></div>
                <div className="detail-item"><span>Total Issues</span><strong>{issueCounts.documents + issueCounts.maintenance + issueCounts.bookings + issueCounts.other}</strong><small>All tracked compliance categories.</small></div>
                <div className="detail-item"><span>Good Segment</span><strong>{healthSegments.good}%</strong><small>Current compliant score band.</small></div>
                <div className="detail-item"><span>At Risk Segment</span><strong>{healthSegments.atRisk}%</strong><small>Items requiring attention soon.</small></div>
                <div className="detail-item"><span>Critical Segment</span><strong>{healthSegments.critical}%</strong><small>Items already overdue or critical.</small></div>
                <div className="detail-item"><span>Documents</span><strong>{issueCounts.documents}</strong><small>{expiredDocuments.length} expired • {expiringSoonDocuments.length} expiring soon</small></div>
                <div className="detail-item"><span>Maintenance</span><strong>{issueCounts.maintenance}</strong><small>{overdueMaintenance.length} high priority • {dueSoonMaintenance.length} medium priority</small></div>
                <div className="detail-item"><span>Bookings</span><strong>{issueCounts.bookings}</strong><small>{pendingBookings.length} pending completion reviews</small></div>
                <div className="detail-item"><span>Other</span><strong>{issueCounts.other}</strong><small>Vehicles currently marked for maintenance.</small></div>
              </div>
            </div>
          </div>
        )}

        {complianceReportModal === "issues" && (
          <div className="modal-backdrop" role="presentation">
            <div className="modal modal--wide modal--details" role="dialog" aria-modal="true" aria-label="Issue breakdown report">
              <div className="modal__header">
                <div>
                  <h3>Issue Breakdown</h3>
                  <p className="modal__subtle">Open a category in the Compliance Register or reset to the full issue list.</p>
                </div>
                <button className="modal__close" type="button" onClick={() => setComplianceReportModal(null)} aria-label="Close issue breakdown">
                  ✕
                </button>
              </div>
              <div className="modal-report-list">
                <div className="modal-report-item">
                  <div className="modal-report-item__meta">
                    <span>Total Tracked Issues</span>
                    <strong>Compliance register total</strong>
                    <small>Documents, maintenance risk, booking reviews, and other compliance markers.</small>
                  </div>
                  <div className="modal-report-item__value">
                    <strong>{issueCounts.documents + issueCounts.maintenance + issueCounts.bookings + issueCounts.other}</strong>
                    <small>Issues</small>
                  </div>
                </div>
                {issueBreakdownRows.map((row) => {
                  const Icon = row.icon;
                  const percent = Math.round((row.count / Math.max(1, issueTotal)) * 100);
                  return (
                    <div className="modal-report-item" key={row.label}>
                      <div className="modal-report-item__meta">
                        <span>{row.label}</span>
                        <strong>{row.detail}</strong>
                        <small>{percent}% of tracked compliance issues</small>
                      </div>
                      <div className="modal-report-item__value">
                        <strong>{row.count}</strong>
                        <small>{percent}%</small>
                        <button
                          className="btn btn--secondary btn--compact"
                          type="button"
                          onClick={() => (row.category ? showIssueCategory(row.category) : showAllIssues(true))}
                        >
                          <Icon aria-hidden="true" />
                          {row.category ? `View ${row.label}` : "View All Issues"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="modal__actions">
                <button className="btn btn--secondary" type="button" onClick={() => setComplianceReportModal(null)}>
                  Close
                </button>
                <button className="btn" type="button" onClick={() => showAllIssues(true)}>
                  All Issues
                </button>
              </div>
            </div>
          </div>
        )}

        {complianceReportModal === "calendar" && (
          <div className="modal-backdrop" role="presentation">
            <div className="modal modal--wide modal--details" role="dialog" aria-modal="true" aria-label="Next seven days compliance calendar">
              <div className="modal__header">
                <div>
                  <h3>Next 7 Days Calendar</h3>
                  <p className="modal__subtle">Upcoming document renewals, booking reviews, and maintenance risks grouped by day.</p>
                </div>
                <button className="modal__close" type="button" onClick={() => setComplianceReportModal(null)} aria-label="Close compliance calendar">
                  ✕
                </button>
              </div>
              <div className="details-grid details-grid--scroll details-grid--single">
                {calendarItems.length === 0 ? (
                  <p className="empty">No dated compliance work in the next 7 days.</p>
                ) : (
                  calendarDays.map((day) => (
                    <div className="detail-item detail-item--full" key={day.key}>
                      <span>{day.label}</span>
                      <strong>{day.dateLabel}</strong>
                      {day.items.length === 0 ? (
                        <small>No compliance items scheduled.</small>
                      ) : (
                        <small>
                          {day.items.map((item) => `${item.title} - ${item.asset} (${item.dueText})`).join(" • ")}
                        </small>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className="modal__actions">
                <button className="btn btn--secondary" type="button" onClick={() => setComplianceReportModal(null)}>
                  Close
                </button>
                <button className="btn" type="button" onClick={() => showNextSevenDays(true)}>
                  View in Register
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}

function ComplianceSummaryCard(props: {
  icon: typeof AlertTriangle;
  title: string;
  total: number;
  rows: Array<[string, number]>;
  actionLabel: string;
  to: string;
  tone: "danger" | "warning" | "info";
}) {
  const Icon = props.icon;
  return (
    <section className="card compliance-summary-card">
      <div className="compliance-summary-card__title">
        <span className={`documents-row-icon documents-row-icon--${props.tone}`}><Icon aria-hidden="true" /></span>
        <div>
          <h3>{props.title}</h3>
          <strong>{props.total}</strong>
        </div>
      </div>
      <div className="compliance-summary-card__rows">
        {props.rows.map(([label, count]) => (
          <span key={label}>
            <b>{label}</b>
            <em>{count}</em>
          </span>
        ))}
      </div>
      <Link className="compliance-summary-card__action" to={props.to}>{props.actionLabel}</Link>
    </section>
  );
}

function BreakdownRow(props: {
  icon: typeof FileText;
  label: string;
  count: number;
  total: number;
  tone: "blue" | "orange" | "purple" | "slate";
}) {
  const Icon = props.icon;
  const percent = Math.round((props.count / Math.max(1, props.total)) * 100);
  return (
    <div className="compliance-breakdown-row">
      <Icon aria-hidden="true" />
      <span>{props.label}</span>
      <div className="compliance-breakdown-bar"><i className={`is-${props.tone}`} style={{ width: `${percent}%` }} /></div>
      <b>{props.count} ({percent}%)</b>
    </div>
  );
}
