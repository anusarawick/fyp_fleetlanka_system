import { useMemo, useState } from "react";
import { Database, Filter, Rows3 } from "lucide-react";
import { Document, Driver, FuelLog, Maintenance, ServiceBooking, ServiceCenter, Trip, Vehicle } from "../types";
import {
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

type ReportCategory = "vehicles" | "drivers" | "trips" | "fuel" | "maintenance" | "documents";

const REPORT_TABS: Array<{ value: ReportCategory; label: string }> = [
  { value: "vehicles", label: "Vehicles" },
  { value: "drivers", label: "Drivers" },
  { value: "trips", label: "Trips" },
  { value: "fuel", label: "Fuel" },
  { value: "maintenance", label: "Maintenance" },
  { value: "documents", label: "Documents" },
];

function withinDateRange(dateValue: string | undefined, fromDate: string, toDate: string) {
  if (!dateValue) return false;
  if (fromDate && dateValue < fromDate) return false;
  if (toDate && dateValue > toDate) return false;
  return true;
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

  const [category, setCategory] = useState<ReportCategory>("vehicles");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [centerFilter, setCenterFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const vehicleLabelMap = useMemo(
    () =>
      vehicles.reduce<Record<string, string>>((acc, vehicle) => {
        const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(" ").trim();
        acc[vehicle.id] = makeModel ? `${vehicle.plate_no} • ${makeModel}` : vehicle.plate_no;
        return acc;
      }, {}),
    [vehicles]
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
          [trip.start_time, trip.end_time, vehicleLabelMap[trip.vehicle_id]]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query));
        const matchesVehicle = vehicleFilter === "all" ? true : trip.vehicle_id === vehicleFilter;
        const matchesDate = withinDateRange(trip.start_time?.slice(0, 10), dateFrom, dateTo);
        return matchesSearch && matchesVehicle && matchesDate;
      }),
    [trips, search, vehicleFilter, dateFrom, dateTo, vehicleLabelMap]
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
          [record.service_date, record.service_type, record.notes, source, vehicleLabelMap[record.vehicle_id], centerLabelMap[record.service_center_id || ""]]
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
      default:
        return [];
    }
  }, [category, filteredVehicles, filteredDrivers, filteredTrips, filteredFuel, filteredMaintenance, filteredDocuments]);

  const totalPages = Math.max(1, Math.ceil(activeDataset.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const previewRows = activeDataset.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const totalRowsAcrossDatasets =
    vehicles.length + drivers.length + trips.length + fuelLogs.length + maintenance.length + documents.length;
  const supportsDateRange =
    category === "trips" || category === "fuel" || category === "maintenance" || category === "documents";
  const supportsVehicleFilter =
    category === "trips" || category === "fuel" || category === "maintenance" || category === "documents";

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
        return;
      case "drivers":
        exportDrivers(filteredDrivers);
        return;
      case "trips":
        exportTrips(filteredTrips);
        return;
      case "fuel":
        exportFuel(filteredFuel);
        return;
      case "maintenance":
        exportMaintenance(filteredMaintenance);
        return;
      case "documents":
        exportDocuments(filteredDocuments);
        return;
    }
  }

  function statusOptions() {
    switch (category) {
      case "vehicles":
        return [
          { value: "all", label: "All" },
          { value: "active", label: "Active" },
          { value: "maintenance", label: "Maintenance" },
          { value: "inactive", label: "Inactive" },
        ];
      case "drivers":
        return [
          { value: "all", label: "All" },
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ];
      case "maintenance":
        return [
          { value: "all", label: "All" },
          { value: "manual", label: "Manual" },
          { value: "service-booking", label: "Service Booking" },
        ];
      case "documents":
        return [
          { value: "all", label: "All" },
          { value: "vehicle", label: "Vehicle" },
          { value: "driver", label: "Driver" },
          { value: "expired", label: "Expired" },
          { value: "expiring", label: "Expiring Soon" },
        ];
      default:
        return [{ value: "all", label: "All" }];
    }
  }

  function previewTable() {
    switch (category) {
      case "vehicles":
        return (
          <div className="table reports-table" style={{ ["--table-columns" as any]: 4 }}>
            <div className="table__head reports-table__head">
              <span>Plate</span>
              <span>Vehicle</span>
              <span>Status</span>
              <span>Odometer</span>
            </div>
            {previewRows.map((row) => {
              const vehicle = row as Vehicle;
              return (
                <div className="table__row reports-table__row" key={vehicle.id}>
                  <span data-label="Plate">{vehicle.plate_no}</span>
                  <span data-label="Vehicle">{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "--"}</span>
                  <span data-label="Status">{vehicle.status || "--"}</span>
                  <span data-label="Odometer">{vehicle.odometer_km ?? "--"}</span>
                </div>
              );
            })}
          </div>
        );
      case "drivers":
        return (
          <div className="table reports-table" style={{ ["--table-columns" as any]: 4 }}>
            <div className="table__head reports-table__head">
              <span>Name</span>
              <span>Email</span>
              <span>Phone</span>
              <span>Status</span>
            </div>
            {previewRows.map((row) => {
              const driver = row as Driver;
              return (
                <div className="table__row reports-table__row" key={driver.id}>
                  <span data-label="Name">{driver.full_name || "--"}</span>
                  <span data-label="Email">{driver.email || "--"}</span>
                  <span data-label="Phone">{driver.phone || "--"}</span>
                  <span data-label="Status">{driver.status || "--"}</span>
                </div>
              );
            })}
          </div>
        );
      case "trips":
        return (
          <div className="table reports-table" style={{ ["--table-columns" as any]: 4 }}>
            <div className="table__head reports-table__head">
              <span>Start</span>
              <span>Vehicle</span>
              <span>Distance</span>
              <span>Duration</span>
            </div>
            {previewRows.map((row) => {
              const trip = row as Trip;
              return (
                <div className="table__row reports-table__row" key={trip.id}>
                  <span data-label="Start">{trip.start_time}</span>
                  <span data-label="Vehicle">{vehicleLabelMap[trip.vehicle_id] || trip.vehicle_id}</span>
                  <span data-label="Distance">{trip.distance_km ?? "--"}</span>
                  <span data-label="Duration">{trip.duration_min ?? "--"}</span>
                </div>
              );
            })}
          </div>
        );
      case "fuel":
        return (
          <div className="table reports-table" style={{ ["--table-columns" as any]: 5 }}>
            <div className="table__head reports-table__head">
              <span>Date</span>
              <span>Vehicle</span>
              <span>Liters</span>
              <span>Cost</span>
              <span>Vendor</span>
            </div>
            {previewRows.map((row) => {
              const log = row as FuelLog;
              return (
                <div className="table__row reports-table__row" key={log.id}>
                  <span data-label="Date">{log.fuel_date}</span>
                  <span data-label="Vehicle">{vehicleLabelMap[log.vehicle_id] || log.vehicle_id}</span>
                  <span data-label="Liters">{log.liters}</span>
                  <span data-label="Cost">{log.cost_lkr ?? "--"}</span>
                  <span data-label="Vendor">{log.vendor || "--"}</span>
                </div>
              );
            })}
          </div>
        );
      case "maintenance":
        return (
          <div className="table reports-table" style={{ ["--table-columns" as any]: 5 }}>
            <div className="table__head reports-table__head">
              <span>Date</span>
              <span>Vehicle</span>
              <span>Service</span>
              <span>Source</span>
              <span>Cost</span>
            </div>
            {previewRows.map((row) => {
              const record = row as Maintenance;
              return (
                <div className="table__row reports-table__row" key={record.id}>
                  <span data-label="Date">{record.service_date}</span>
                  <span data-label="Vehicle">{vehicleLabelMap[record.vehicle_id] || record.vehicle_id}</span>
                  <span data-label="Service">{record.service_type || "--"}</span>
                  <span data-label="Source">{record.service_booking_id ? "Service Booking" : "Manual"}</span>
                  <span data-label="Cost">{record.cost_lkr ?? "--"}</span>
                </div>
              );
            })}
          </div>
        );
      case "documents":
        return (
          <div className="table reports-table" style={{ ["--table-columns" as any]: 4 }}>
            <div className="table__head reports-table__head">
              <span>Type</span>
              <span>Owner</span>
              <span>Number</span>
              <span>Expiry</span>
            </div>
            {previewRows.map((row) => {
              const doc = row as Document;
              return (
                <div className="table__row reports-table__row" key={doc.id}>
                  <span data-label="Type">{doc.doc_type}</span>
                  <span data-label="Owner">{doc.driver_id ? "Driver" : "Vehicle"}</span>
                  <span data-label="Number">{doc.doc_number || "--"}</span>
                  <span data-label="Expiry">{doc.expiry_date || "--"}</span>
                </div>
              );
            })}
          </div>
        );
    }
  }

  return (
    <section className="section">
      <section className="admin-page reports-page">
      <section className="stats stats--three reports-stats">
        <div className="stat-card stat-card--blue">
          <div className="stat-icon"><Database aria-hidden="true" /></div>
          <div className="stat-value">{REPORT_TABS.length}</div>
          <div className="stat-label">Report Datasets</div>
          <div className="stat-sub">Vehicles, drivers, trips, fuel, maintenance, and documents</div>
        </div>
        <div className="stat-card stat-card--green">
          <div className="stat-icon"><Filter aria-hidden="true" /></div>
          <div className="stat-value">{activeDataset.length}</div>
          <div className="stat-label">Filtered Rows</div>
          <div className="stat-sub">Current result set for the active report tab</div>
        </div>
        <div className="stat-card stat-card--purple">
          <div className="stat-icon"><Rows3 aria-hidden="true" /></div>
          <div className="stat-value">{totalRowsAcrossDatasets}</div>
          <div className="stat-label">Indexed Records</div>
          <div className="stat-sub">Available reportable records across the manager portal</div>
        </div>
      </section>

      <nav className="admin-tabs" aria-label="Report categories">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`admin-tab ${category === tab.value ? "admin-tab--active" : ""}`}
            onClick={() => handleCategoryChange(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="grid reports-summary-grid reports-summary-grid--single admin-panel">
        <section className="card admin-card--summary">
          <div className="card__header">
            <div>
              <h3>Current Dataset</h3>
              <p className="muted admin-card__subtitle">The active tab controls filters, preview rows, and export output.</p>
            </div>
          </div>
          <div className="reports-summary">
            <div className="reports-summary__item">
              <span>Dataset</span>
              <strong>{REPORT_TABS.find((tab) => tab.value === category)?.label}</strong>
            </div>
            <div className="reports-summary__item">
              <span>Rows Ready</span>
              <strong>{activeDataset.length}</strong>
            </div>
            <div className="reports-summary__item">
              <span>Pages</span>
              <strong>{totalPages}</strong>
            </div>
          </div>
        </section>
      </div>

      <section className="card admin-table-section reports-builder-card">
        <div className="card__header">
          <div>
            <h3>Report Builder</h3>
            <p className="muted admin-card__subtitle">Apply dataset filters, preview the result, and export the current report view.</p>
          </div>
        </div>
        <div className="reports-builder">
          <div className="reports-builder__row">
            <div className="reports-builder__group reports-builder__group--primary">
              <label className="table-controls__label table-controls__label--search reports-builder__search">
                Search
                <input type="search" placeholder="Search report rows..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
              </label>
              <label className="table-controls__label">
                Status / Type
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  {statusOptions().map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="reports-builder__group reports-builder__group--actions">
              <div className="reports-builder__meta">
                <span>{activeDataset.length} rows</span>
                <span>Page {currentPage} of {totalPages}</span>
              </div>
              <button className="btn btn--secondary btn--compact" type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                Prev
              </button>
              <button className="btn btn--secondary btn--compact" type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
                Next
              </button>
              <button className="btn" type="button" onClick={exportCurrent}>
                Export
              </button>
            </div>
          </div>

          <div className="reports-builder__row reports-builder__row--filters">
            {supportsDateRange && (
              <>
                <label className="table-controls__label">
                  From
                  <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
                </label>
                <label className="table-controls__label">
                  To
                  <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
                </label>
              </>
            )}
            {supportsVehicleFilter && (
              <label className="table-controls__label">
                Vehicle
                <select value={vehicleFilter} onChange={(e) => { setVehicleFilter(e.target.value); setPage(1); }}>
                  <option value="all">All</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicleLabelMap[vehicle.id]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {category === "documents" && (
              <label className="table-controls__label">
                Driver
                <select value={driverFilter} onChange={(e) => { setDriverFilter(e.target.value); setPage(1); }}>
                  <option value="all">All</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.full_name || driver.email || driver.id}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {category === "maintenance" && (
              <label className="table-controls__label">
                Service Center
                <select value={centerFilter} onChange={(e) => { setCenterFilter(e.target.value); setPage(1); }}>
                  <option value="all">All</option>
                  {serviceCenters.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="table-controls__label">
              Rows
              <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(1); }}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>
        </div>

        <div className="reports-preview">
          <div className="reports-preview__header">
            <div>
              <h4>Preview</h4>
              <p className="muted">Current filtered result set for export.</p>
            </div>
          </div>
          {activeDataset.length === 0 ? <p className="empty">No rows match the current report filters.</p> : previewTable()}
        </div>
      </section>
      </section>
    </section>
  );
}
