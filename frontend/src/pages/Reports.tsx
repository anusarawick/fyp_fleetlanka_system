import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Car,
  Database,
  Download,
  FileText,
  Fuel,
  Printer,
  Rows3,
  Search,
  Wrench,
  Users,
  ClipboardList,
  FileDown,
} from "lucide-react";
import { Document, Driver, FuelLog, Maintenance, ServiceBooking, ServiceCenter, Trip, Vehicle } from "../types";
import {
  exportCSV,
  exportDocuments,
  exportDrivers,
  exportFuel,
  exportMaintenance,
  exportTrips,
  exportVehicles,
} from "../utils/export";

type ReportProps = {
  vehicles: Vehicle[];
  drivers: Driver[];
  trips: Trip[];
  fuelLogs: FuelLog[];
  maintenance: Maintenance[];
  documents: Document[];
  serviceBookings: ServiceBooking[];
  serviceCenters: ServiceCenter[];
};

type ReportCategory = "vehicles" | "drivers" | "trips" | "fuel" | "maintenance" | "documents" | "bookings";
type ActivityType = "CSV" | "PDF" | "Print";

type ActivityItem = {
  id: string;
  report: string;
  type: ActivityType;
  generated: string;
  rows: number;
};

const REPORT_ACTIVITY_STORAGE_KEY = "fleetlanka.reports.activity";

const REPORT_TABS: Array<{ value: ReportCategory; label: string; icon: typeof Car }> = [
  { value: "vehicles", label: "Vehicles", icon: Car },
  { value: "drivers", label: "Drivers", icon: Users },
  { value: "trips", label: "Trips", icon: ClipboardList },
  { value: "fuel", label: "Fuel", icon: Fuel },
  { value: "maintenance", label: "Maintenance", icon: Wrench },
  { value: "documents", label: "Documents", icon: FileText },
  { value: "bookings", label: "Bookings", icon: CalendarDays },
];

const CATEGORY_PREVIEW_TITLES: Record<ReportCategory, string> = {
  vehicles: "Vehicles Report Preview",
  drivers: "Drivers Report Preview",
  trips: "Trips Report Preview",
  fuel: "Fuel Report Preview",
  maintenance: "Maintenance Report Preview",
  documents: "Documents Report Preview",
  bookings: "Bookings Report Preview",
};

const CATEGORY_ROW_LABELS: Record<ReportCategory, string> = {
  vehicles: "vehicle records",
  drivers: "driver records",
  trips: "trip records",
  fuel: "fuel records",
  maintenance: "maintenance records",
  documents: "document records",
  bookings: "booking records",
};

function withinDateRange(dateValue: string | undefined, fromDate: string, toDate: string) {
  if (!dateValue) return false;
  if (fromDate && dateValue < fromDate) return false;
  if (toDate && dateValue > toDate) return false;
  return true;
}

function displayText(value: unknown, fallback = "Not recorded") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function formatNumber(value: unknown, fallback = "Not recorded") {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return number.toLocaleString();
}

function formatCurrency(value: unknown, fallback = "Not recorded") {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return `LKR ${number.toLocaleString()}`;
}

function formatDistance(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "No distance";
  return `${number.toLocaleString(undefined, { maximumFractionDigits: 1 })} km`;
}

function formatDuration(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "No duration";
  return `${number.toLocaleString(undefined, { maximumFractionDigits: 0 })} min`;
}

function formatDateTime(value?: string) {
  if (!value) return "Not generated";
  return new Date(value).toLocaleString("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatReportDate(value?: string, fallback = "Date not recorded") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-LK", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatReportDateTime(value?: string, fallback = "Date not recorded") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-LK", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function exportBookings(bookings: ServiceBooking[]) {
  exportCSV("service_bookings.csv", [
    ["requested_date", "vehicle_id", "center_id", "work_type", "status", "final_cost_lkr", "completion_review_status"],
    ...bookings.map((booking) => [
      booking.requested_date,
      booking.vehicle_id || "",
      booking.center_id || "",
      booking.work_type || "",
      booking.status || "",
      String(booking.final_cost_lkr || ""),
      booking.completion_review_status || "",
    ]),
  ]);
}

function loadStoredActivities() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REPORT_ACTIVITY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is ActivityItem =>
        item &&
        typeof item.id === "string" &&
        typeof item.report === "string" &&
        (item.type === "CSV" || item.type === "PDF" || item.type === "Print") &&
        typeof item.generated === "string" &&
        typeof item.rows === "number"
      )
      .slice(0, 8);
  } catch {
    return [];
  }
}

export default function Reports(props: ReportProps) {
  const vehicles = props.vehicles ?? [];
  const drivers = props.drivers ?? [];
  const trips = props.trips ?? [];
  const fuelLogs = props.fuelLogs ?? [];
  const maintenance = props.maintenance ?? [];
  const documents = props.documents ?? [];
  const serviceBookings = props.serviceBookings ?? [];
  const serviceCenters = props.serviceCenters ?? [];

  const [category, setCategory] = useState<ReportCategory>("trips");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [centerFilter, setCenterFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [activities, setActivities] = useState<ActivityItem[]>(loadStoredActivities);

  useEffect(() => {
    window.localStorage.setItem(REPORT_ACTIVITY_STORAGE_KEY, JSON.stringify(activities));
  }, [activities]);

  const vehicleLabelMap = useMemo(
    () =>
      vehicles.reduce<Record<string, string>>((acc, vehicle) => {
        const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(" ").trim();
        acc[vehicle.id] = makeModel ? `${vehicle.plate_no} - ${makeModel}` : vehicle.plate_no;
        return acc;
      }, {}),
    [vehicles]
  );

  const driverLabelMap = useMemo(
    () =>
      drivers.reduce<Record<string, string>>((acc, driver) => {
        acc[driver.id] = driver.full_name || driver.email || driver.id;
        return acc;
      }, {}),
    [drivers]
  );

  const centerLabelMap = useMemo(
    () =>
      serviceCenters.reduce<Record<string, string>>((acc, center) => {
        acc[center.id] = center.name;
        return acc;
      }, {}),
    [serviceCenters]
  );

  const filteredVehicles = useMemo(
    () =>
      vehicles.filter((vehicle) => {
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          [vehicle.plate_no, vehicle.make, vehicle.model, vehicle.vehicle_type, vehicle.status]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query));
        const matchesStatus = statusFilter === "all" ? true : (vehicle.status || "").toLowerCase() === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [vehicles, search, statusFilter]
  );

  const filteredDrivers = useMemo(
    () =>
      drivers.filter((driver) => {
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          [driver.full_name, driver.email, driver.phone, driver.status]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query));
        const matchesStatus = statusFilter === "all" ? true : (driver.status || "").toLowerCase() === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [drivers, search, statusFilter]
  );

  const filteredTrips = useMemo(
    () =>
      trips.filter((trip) => {
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          [trip.start_time, trip.end_time, trip.status, trip.origin_label, trip.destination_label, vehicleLabelMap[trip.vehicle_id], driverLabelMap[trip.driver_id || ""]]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query));
        const matchesVehicle = vehicleFilter === "all" ? true : trip.vehicle_id === vehicleFilter;
        const matchesDriver = driverFilter === "all" ? true : trip.driver_id === driverFilter;
        const matchesStatus = statusFilter === "all" ? true : (trip.status || "").toLowerCase() === statusFilter;
        const matchesDate = withinDateRange(trip.start_time?.slice(0, 10), dateFrom, dateTo);
        return matchesSearch && matchesVehicle && matchesDriver && matchesStatus && matchesDate;
      }),
    [trips, search, vehicleFilter, driverFilter, statusFilter, dateFrom, dateTo, vehicleLabelMap, driverLabelMap]
  );

  const filteredFuel = useMemo(
    () =>
      fuelLogs.filter((log) => {
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          [log.fuel_date, log.vendor, vehicleLabelMap[log.vehicle_id]]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query));
        const matchesVehicle = vehicleFilter === "all" ? true : log.vehicle_id === vehicleFilter;
        const matchesDate = withinDateRange(log.fuel_date, dateFrom, dateTo);
        return matchesSearch && matchesVehicle && matchesDate;
      }),
    [fuelLogs, search, vehicleFilter, dateFrom, dateTo, vehicleLabelMap]
  );

  const filteredMaintenance = useMemo(
    () =>
      maintenance.filter((record) => {
        const query = search.trim().toLowerCase();
        const source = record.service_booking_id ? "service booking" : "manual";
        const matchesSearch =
          !query ||
          [record.service_date, record.service_type, record.event_type, record.notes, source, vehicleLabelMap[record.vehicle_id], centerLabelMap[record.service_center_id || ""]]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query));
        const matchesVehicle = vehicleFilter === "all" ? true : record.vehicle_id === vehicleFilter;
        const matchesCenter = centerFilter === "all" ? true : record.service_center_id === centerFilter;
        const matchesDate = withinDateRange(record.service_date, dateFrom, dateTo);
        const matchesStatus =
          statusFilter === "all"
            ? true
            : statusFilter === "service-booking"
              ? !!record.service_booking_id
              : statusFilter === "manual"
                ? !record.service_booking_id
                : true;
        return matchesSearch && matchesVehicle && matchesCenter && matchesDate && matchesStatus;
      }),
    [maintenance, search, vehicleFilter, centerFilter, dateFrom, dateTo, statusFilter, vehicleLabelMap, centerLabelMap]
  );

  const filteredDocuments = useMemo(
    () =>
      documents.filter((doc) => {
        const query = search.trim().toLowerCase();
        const ownerType = doc.driver_id ? "driver" : "vehicle";
        const matchesSearch =
          !query ||
          [doc.doc_type, doc.doc_number, doc.expiry_date, ownerType]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query));
        const matchesVehicle = vehicleFilter === "all" ? true : doc.vehicle_id === vehicleFilter;
        const matchesDriver = driverFilter === "all" ? true : doc.driver_id === driverFilter;
        const matchesDate = !dateFrom && !dateTo ? true : withinDateRange(doc.expiry_date, dateFrom, dateTo);
        const matchesStatus =
          statusFilter === "all"
            ? true
            : statusFilter === "vehicle"
              ? !!doc.vehicle_id
              : statusFilter === "driver"
                ? !!doc.driver_id
                : statusFilter === "expired"
                  ? !!doc.expiry_date && new Date(doc.expiry_date).getTime() < Date.now()
                  : statusFilter === "expiring"
                    ? !!doc.expiry_date &&
                      new Date(doc.expiry_date).getTime() >= Date.now() &&
                      new Date(doc.expiry_date).getTime() <= Date.now() + 30 * 24 * 60 * 60 * 1000
                    : true;
        return matchesSearch && matchesVehicle && matchesDriver && matchesDate && matchesStatus;
      }),
    [documents, search, vehicleFilter, driverFilter, dateFrom, dateTo, statusFilter]
  );

  const filteredBookings = useMemo(
    () =>
      serviceBookings.filter((booking) => {
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          [booking.requested_date, booking.status, booking.work_type, booking.notes, vehicleLabelMap[booking.vehicle_id || ""], centerLabelMap[booking.center_id || ""]]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query));
        const matchesVehicle = vehicleFilter === "all" ? true : booking.vehicle_id === vehicleFilter;
        const matchesCenter = centerFilter === "all" ? true : booking.center_id === centerFilter;
        const matchesStatus = statusFilter === "all" ? true : (booking.status || "").toLowerCase() === statusFilter;
        const matchesDate = withinDateRange(booking.requested_date, dateFrom, dateTo);
        return matchesSearch && matchesVehicle && matchesCenter && matchesStatus && matchesDate;
      }),
    [serviceBookings, search, vehicleFilter, centerFilter, statusFilter, dateFrom, dateTo, vehicleLabelMap, centerLabelMap]
  );

  const activeDataset = useMemo(() => {
    switch (category) {
      case "vehicles":
        return filteredVehicles;
      case "drivers":
        return filteredDrivers;
      case "trips":
        return filteredTrips;
      case "fuel":
        return filteredFuel;
      case "maintenance":
        return filteredMaintenance;
      case "documents":
        return filteredDocuments;
      case "bookings":
        return filteredBookings;
    }
  }, [category, filteredVehicles, filteredDrivers, filteredTrips, filteredFuel, filteredMaintenance, filteredDocuments, filteredBookings]);

  const totalPages = Math.max(1, Math.ceil(activeDataset.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const previewRows = activeDataset.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const totalRowsAcrossDatasets =
    vehicles.length + drivers.length + trips.length + fuelLogs.length + maintenance.length + documents.length + serviceBookings.length;
  const supportsDateRange =
    category === "trips" || category === "fuel" || category === "maintenance" || category === "documents" || category === "bookings";
  const supportsVehicleFilter =
    category === "trips" || category === "fuel" || category === "maintenance" || category === "documents" || category === "bookings";
  const supportsDriverFilter = category === "trips" || category === "documents";
  const supportsCenterFilter = category === "maintenance" || category === "bookings";
  const selectedCategoryLabel = REPORT_TABS.find((tab) => tab.value === category)?.label ?? "Report";
  const lastGenerated = activities[0];
  const csvCount = activities.filter((item) => item.type === "CSV").length;
  const pdfCount = activities.filter((item) => item.type === "PDF").length;
  const printCount = activities.filter((item) => item.type === "Print").length;
  const previewSummary = `${activeDataset.length.toLocaleString()} ${CATEGORY_ROW_LABELS[category]} match the current filters.`;

  function addActivity(type: ActivityType) {
    setActivities((prev) => [
      {
        id: `${Date.now()}-${type}`,
        report: `${selectedCategoryLabel} Report`,
        type,
        generated: new Date().toISOString(),
        rows: activeDataset.length,
      },
      ...prev,
    ].slice(0, 8));
  }

  function handleCategoryChange(nextCategory: ReportCategory) {
    setCategory(nextCategory);
    setPage(1);
    setStatusFilter("all");
    setVehicleFilter("all");
    setDriverFilter("all");
    setCenterFilter("all");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  }

  function exportCurrent() {
    switch (category) {
      case "vehicles":
        exportVehicles(filteredVehicles);
        break;
      case "drivers":
        exportDrivers(filteredDrivers);
        break;
      case "trips":
        exportTrips(filteredTrips);
        break;
      case "fuel":
        exportFuel(filteredFuel);
        break;
      case "maintenance":
        exportMaintenance(filteredMaintenance);
        break;
      case "documents":
        exportDocuments(filteredDocuments);
        break;
      case "bookings":
        exportBookings(filteredBookings);
        break;
    }
    addActivity("CSV");
  }

  function printCurrent() {
    addActivity("Print");
    window.print();
  }

  function statusOptions() {
    switch (category) {
      case "vehicles":
        return [
          { value: "all", label: "All Statuses" },
          { value: "active", label: "Active" },
          { value: "maintenance", label: "Maintenance" },
          { value: "inactive", label: "Inactive" },
        ];
      case "drivers":
        return [
          { value: "all", label: "All Statuses" },
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ];
      case "trips":
      case "bookings":
        return [
          { value: "all", label: "All Statuses" },
          { value: "scheduled", label: "Scheduled" },
          { value: "in_progress", label: "In Progress" },
          { value: "completed", label: "Completed" },
          { value: "cancelled", label: "Cancelled" },
        ];
      case "maintenance":
        return [
          { value: "all", label: "All Types" },
          { value: "manual", label: "Manual" },
          { value: "service-booking", label: "Service Booking" },
        ];
      case "documents":
        return [
          { value: "all", label: "All Statuses" },
          { value: "vehicle", label: "Vehicle" },
          { value: "driver", label: "Driver" },
          { value: "expired", label: "Expired" },
          { value: "expiring", label: "Expiring Soon" },
        ];
      default:
        return [{ value: "all", label: "All" }];
    }
  }

  function reportRows() {
    switch (category) {
      case "vehicles":
        return {
          columns: ["Plate", "Vehicle", "Type", "Status", "Odometer"],
          rows: previewRows.map((row) => {
            const vehicle = row as Vehicle;
            return [vehicle.plate_no, [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle details not recorded", displayText(vehicle.vehicle_type), displayText(vehicle.status, "No status"), formatNumber(vehicle.odometer_km, "No odometer")];
          }),
        };
      case "drivers":
        return {
          columns: ["Name", "Email", "Phone", "Status"],
          rows: previewRows.map((row) => {
            const driver = row as Driver;
            return [displayText(driver.full_name, "Driver name not recorded"), displayText(driver.email, "Email not recorded"), displayText(driver.phone, "Phone not recorded"), displayText(driver.status, "No status")];
          }),
        };
      case "trips":
        return {
          columns: ["Vehicle", "Driver", "Route", "Status", "Distance", "Date"],
          rows: previewRows.map((row) => {
            const trip = row as Trip;
            return [
              vehicleLabelMap[trip.vehicle_id] || "Vehicle not found",
              driverLabelMap[trip.driver_id || ""] || "Not assigned",
              [trip.origin_label, trip.destination_label].filter(Boolean).join(" -> ") || "Route not recorded",
              displayText(trip.status, "No status"),
              formatDistance(trip.distance_km),
              formatReportDateTime(trip.start_time, "Start not recorded"),
            ];
          }),
        };
      case "fuel":
        return {
          columns: ["Date", "Vehicle", "Liters", "Cost", "Vendor"],
          rows: previewRows.map((row) => {
            const log = row as FuelLog;
            return [formatReportDate(log.fuel_date), vehicleLabelMap[log.vehicle_id] || "Vehicle not found", formatNumber(log.liters, "Liters not recorded"), formatCurrency(log.cost_lkr), displayText(log.vendor, "No vendor")];
          }),
        };
      case "maintenance":
        return {
          columns: ["Date", "Vehicle", "Service", "Source", "Cost"],
          rows: previewRows.map((row) => {
            const record = row as Maintenance;
            return [formatReportDate(record.service_date), vehicleLabelMap[record.vehicle_id] || "Vehicle not found", displayText(record.service_type || record.event_type, "Service not recorded"), record.service_booking_id ? "Service Booking" : "Manual", formatCurrency(record.cost_lkr)];
          }),
        };
      case "documents":
        return {
          columns: ["Type", "Owner", "Number", "Expiry"],
          rows: previewRows.map((row) => {
            const doc = row as Document;
            return [displayText(doc.doc_type, "Document type not recorded"), doc.driver_id ? "Driver" : "Vehicle", displayText(doc.doc_number, "Number not recorded"), formatReportDate(doc.expiry_date, "No expiry")];
          }),
        };
      case "bookings":
        return {
          columns: ["Date", "Vehicle", "Center", "Work Type", "Status", "Cost"],
          rows: previewRows.map((row) => {
            const booking = row as ServiceBooking;
            return [formatReportDate(booking.requested_date), vehicleLabelMap[booking.vehicle_id || ""] || "Vehicle not found", centerLabelMap[booking.center_id || ""] || "Center not recorded", displayText(booking.work_type, "Work not recorded"), displayText(booking.status, "No status"), formatCurrency(booking.final_cost_lkr)];
          }),
        };
    }
  }

  const preview = reportRows();

  return (
    <section className="section">
      <section className="admin-page reports-page reports-page--redesign">
        <section className="reports-kpi-grid" aria-label="Reports summary">
          <article className="reports-kpi-card reports-kpi-card--teal">
            <span className="reports-kpi-card__icon"><FileText aria-hidden="true" /></span>
            <div><small>Available Reports</small><strong>{REPORT_TABS.length}</strong><span>{totalRowsAcrossDatasets.toLocaleString()} total records</span></div>
          </article>
          <article className="reports-kpi-card reports-kpi-card--purple">
            <span className="reports-kpi-card__icon"><Download aria-hidden="true" /></span>
            <div><small>Exported This Session</small><strong>{activities.length}</strong><span>{csvCount} CSV exports</span></div>
          </article>
          <article className="reports-kpi-card reports-kpi-card--orange">
            <span className="reports-kpi-card__icon"><Database aria-hidden="true" /></span>
            <div><small>Data Categories</small><strong>{REPORT_TABS.length}</strong><span>Fleet operations data</span></div>
          </article>
          <article className="reports-kpi-card reports-kpi-card--blue">
            <span className="reports-kpi-card__icon"><CalendarDays aria-hidden="true" /></span>
            <div><small>Last Generated</small><strong>{lastGenerated ? formatDateTime(lastGenerated.generated) : "None"}</strong><span>{lastGenerated ? lastGenerated.report : "No session exports"}</span></div>
          </article>
        </section>

        <section className="reports-builder-shell">
          <div className="reports-main-card">
            <div className="reports-card-header">
              <h3>Build Report</h3>
              <div className="reports-export-actions">
                <button type="button" onClick={exportCurrent}><FileText aria-hidden="true" />CSV</button>
                <button type="button" disabled title="PDF generation is not enabled yet"><FileDown aria-hidden="true" />PDF Report</button>
                <button type="button" onClick={printCurrent}><Printer aria-hidden="true" />Print</button>
              </div>
            </div>

            <nav className="reports-tabs" aria-label="Report categories">
              {REPORT_TABS.map(({ value, label, icon: Icon }) => (
                <button key={value} type="button" className={category === value ? "is-active" : ""} onClick={() => handleCategoryChange(value)}>
                  <Icon aria-hidden="true" />
                  {label}
                </button>
              ))}
            </nav>

            <div className={`reports-filter-row reports-filter-row--${category}`}>
              {supportsDateRange && (
                <>
                  <label><span>From</span><input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} /></label>
                  <label><span>To</span><input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} /></label>
                </>
              )}
              {supportsVehicleFilter && (
                <label><span>Vehicle</span><select value={vehicleFilter} onChange={(e) => { setVehicleFilter(e.target.value); setPage(1); }}><option value="all">All Vehicles</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicleLabelMap[vehicle.id]}</option>)}</select></label>
              )}
              {supportsDriverFilter && (
                <label><span>Driver</span><select value={driverFilter} onChange={(e) => { setDriverFilter(e.target.value); setPage(1); }}><option value="all">All Drivers</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driverLabelMap[driver.id]}</option>)}</select></label>
              )}
              {supportsCenterFilter && (
                <label><span>Center</span><select value={centerFilter} onChange={(e) => { setCenterFilter(e.target.value); setPage(1); }}><option value="all">All Centers</option>{serviceCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}</select></label>
              )}
              <label><span>Status</span><select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>{statusOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <button className="reports-generate-button" type="button" onClick={exportCurrent}><FileText aria-hidden="true" />Generate Report</button>
            </div>

            <div className="reports-applied-strip">
              <div><span>Report Type</span><strong>{selectedCategoryLabel}</strong></div>
              <div><span>Date Range</span><strong>{dateFrom || dateTo ? `${dateFrom || "Any"} - ${dateTo || "Any"}` : "All dates"}</strong></div>
              <div><span>Applied Filters</span><strong>{activeDataset.length.toLocaleString()} matching rows</strong></div>
              <div><span>Rows</span><strong>{activeDataset.length.toLocaleString()}</strong></div>
            </div>

            <div className="reports-preview-card">
              <div className="reports-preview__header">
                <div>
                  <h4>{CATEGORY_PREVIEW_TITLES[category]}</h4>
                  <p className="muted">{previewSummary}</p>
                </div>
                <label className="reports-search-control"><Search aria-hidden="true" /><input type="search" placeholder="Search report rows..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></label>
                <label className="reports-rows-control"><span>Rows</span><select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(1); }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
              </div>
              <div className="reports-preview__body">
                {activeDataset.length === 0 ? (
                  <p className="empty">No rows match the current report filters.</p>
                ) : (
                  <div className="reports-table" style={{ ["--report-columns" as any]: preview.columns.length }}>
                    <div className="reports-table__head">{preview.columns.map((column) => <span key={column}>{column}</span>)}</div>
                    {preview.rows.map((row, index) => (
                      <div className="reports-table__row" key={index}>
                        {row.map((cell, cellIndex) => <span key={`${index}-${preview.columns[cellIndex]}`} data-label={preview.columns[cellIndex]}>{cell}</span>)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="reports-table-footer">
                <span>Showing {activeDataset.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, activeDataset.length)} of {activeDataset.length} entries</span>
                <div><button type="button" disabled={currentPage === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Prev</button><strong>{currentPage}</strong><button type="button" disabled={currentPage === totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>Next</button></div>
              </div>
            </div>
          </div>

          <aside className="reports-side-panel">
            <section className="reports-side-card">
              <div className="reports-side-header"><h3>Recent Exports / Activity</h3><span>{activities.length}</span></div>
              {activities.length === 0 ? (
                <p className="reports-empty-note">No report activity in this session.</p>
              ) : (
                <div className="reports-activity-list">
                  {activities.map((item) => (
                    <div key={item.id} className="reports-activity-row">
                      <strong>{item.report}</strong>
                      <span className={`reports-activity-type reports-activity-type--${item.type.toLowerCase()}`}>{item.type}</span>
                      <small>{formatDateTime(item.generated)}</small>
                      <em>{item.rows.toLocaleString()} rows</em>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="reports-side-card">
              <div className="reports-side-header"><h3>Export Summary</h3><span>Session</span></div>
              <div className="reports-export-summary">
                <div><FileText aria-hidden="true" /><strong>{activities.length}</strong><span>Total Actions</span></div>
                <div><Download aria-hidden="true" /><strong>{csvCount}</strong><span>CSV Exports</span></div>
                <div><FileDown aria-hidden="true" /><strong>{pdfCount}</strong><span>PDF Exports</span></div>
                <div><Printer aria-hidden="true" /><strong>{printCount}</strong><span>Print Jobs</span></div>
              </div>
            </section>
          </aside>
        </section>
      </section>
    </section>
  );
}
