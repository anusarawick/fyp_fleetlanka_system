import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, ClipboardCheck, FileWarning, ShieldCheck, Wrench } from "lucide-react";

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
};

type ServiceBooking = {
  id: string;
  vehicle_id?: string;
  requested_date: string;
  status?: string;
  completion_review_status?: string;
};

type ComplianceProps = {
  documents: Document[];
  maintenance: MaintenanceRecord[];
  vehicles: Vehicle[];
  serviceBookings: ServiceBooking[];
};

type AlertRow = {
  id: string;
  category: "documents" | "fleet" | "approvals";
  severity: "danger" | "warning" | "info";
  priorityLabel: string;
  title: string;
  meta: string;
  actionLabel: string;
  actionTo: string;
};

type CompliancePanelRow = {
  id: string;
  title: string;
  meta: string;
  tone: AlertRow["severity"];
  label: string;
  to: string;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function toneClass(tone: AlertRow["severity"]) {
  return `pill pill--${tone}`;
}

function vehicleLabel(vehicle?: Vehicle) {
  if (!vehicle) return "Vehicle not found";
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(" ").trim();
  if (makeModel && vehicle.plate_no) return `${makeModel} • ${vehicle.plate_no}`;
  return makeModel || vehicle.plate_no || "Vehicle not found";
}

function formatDate(value?: string) {
  return value || "Date not recorded";
}

function documentOwnerLabel(doc: Document) {
  return doc.driver_id ? "Driver document" : doc.vehicle_id ? "Vehicle document" : "Owner not recorded";
}

function categoryLabel(category: AlertRow["category"]) {
  if (category === "documents") return "Documents";
  if (category === "fleet") return "Fleet";
  return "Approvals";
}

export default function Compliance(props: ComplianceProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "register">("overview");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | AlertRow["category"]>("all");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const now = new Date().getTime();

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
        if (!doc.expiry_date) return false;
        return new Date(doc.expiry_date).getTime() < now;
      }),
    [props.documents, now]
  );

  const expiringSoonDocuments = useMemo(
    () =>
      props.documents.filter((doc) => {
        if (!doc.expiry_date) return false;
        const expiry = new Date(doc.expiry_date).getTime();
        return expiry >= now && expiry <= now + THIRTY_DAYS_MS;
      }),
    [props.documents, now]
  );

  const vehiclesInMaintenance = useMemo(
    () => props.vehicles.filter((vehicle) => (vehicle.status || "").toLowerCase() === "maintenance"),
    [props.vehicles]
  );

  const pendingApprovals = useMemo(
    () =>
      props.serviceBookings.filter(
        (booking) =>
          (booking.status || "pending") === "completed" &&
          (booking.completion_review_status || "pending") !== "approved"
      ),
    [props.serviceBookings]
  );

  const vehicleDocumentCount = props.documents.filter((doc) => !!doc.vehicle_id).length;
  const driverDocumentCount = props.documents.filter((doc) => !!doc.driver_id).length;
  const totalOpenActions = expiredDocuments.length + expiringSoonDocuments.length + vehiclesInMaintenance.length + pendingApprovals.length;

  const alertRows = useMemo<AlertRow[]>(() => {
    const expiredDocAlerts = expiredDocuments.map((doc) => ({
      id: `doc-expired-${doc.id}`,
      category: "documents" as const,
      severity: "danger" as const,
      priorityLabel: "Urgent",
      title: `${doc.doc_type} expired`,
      meta: `${formatDate(doc.expiry_date)} • ${documentOwnerLabel(doc)}`,
      actionLabel: "Review",
      actionTo: "/documents",
    }));

    const expiringDocAlerts = expiringSoonDocuments.map((doc) => ({
      id: `doc-soon-${doc.id}`,
      category: "documents" as const,
      severity: "warning" as const,
      priorityLabel: "Due Soon",
      title: `${doc.doc_type} expiring soon`,
      meta: `${formatDate(doc.expiry_date)} • ${documentOwnerLabel(doc)}`,
      actionLabel: "Review",
      actionTo: "/documents",
    }));

    const maintenanceVehicleAlerts = vehiclesInMaintenance.map((vehicle) => ({
      id: `vehicle-maint-${vehicle.id}`,
      category: "fleet" as const,
      severity: "info" as const,
      priorityLabel: "Monitor",
      title: `${vehicleLabel(vehicle)} in maintenance`,
      meta: "Vehicle currently unavailable for fleet operations",
      actionLabel: "Review",
      actionTo: "/management",
    }));

    const approvalAlerts = pendingApprovals.map((booking) => ({
      id: `approval-${booking.id}`,
      category: "approvals" as const,
      severity: "warning" as const,
      priorityLabel: "Review",
      title: `${vehicleLabel(vehicleMap[booking.vehicle_id || ""])} awaiting approval`,
      meta: `${formatDate(booking.requested_date)} • Completed booking pending manager verification`,
      actionLabel: "Review",
      actionTo: "/maintenance",
    }));

    return [...expiredDocAlerts, ...expiringDocAlerts, ...maintenanceVehicleAlerts, ...approvalAlerts];
  }, [expiredDocuments, expiringSoonDocuments, vehiclesInMaintenance, pendingApprovals, vehicleMap]);

  const filteredAlerts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return alertRows.filter((row) => {
      const categoryMatches = categoryFilter === "all" ? true : row.category === categoryFilter;
      if (!categoryMatches) return false;
      if (!query) return true;
      return [row.title, row.meta, row.category, row.severity]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [alertRows, search, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const visibleAlerts = filteredAlerts.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const recentMaintenance = useMemo(
    () =>
      [...props.maintenance]
        .sort((a, b) => String(b.service_date).localeCompare(String(a.service_date)))
        .slice(0, 5),
    [props.maintenance]
  );

  const compliancePanels = [
    {
      title: "Document Risk",
      subtitle: "Expired and near-expiry records that should be handled before dispatch.",
      empty: "No renewal action needed.",
      icon: FileWarning,
      rows: [
        ...expiredDocuments.slice(0, 5).map((doc): CompliancePanelRow => ({
        id: doc.id,
        title: doc.doc_type,
        meta: `${formatDate(doc.expiry_date)} • ${documentOwnerLabel(doc)}`,
        tone: "danger",
        label: "Expired",
        to: "/documents",
      })),
        ...expiringSoonDocuments.slice(0, 5).map((doc): CompliancePanelRow => ({
        id: doc.id,
        title: doc.doc_type,
        meta: `${formatDate(doc.expiry_date)} • ${documentOwnerLabel(doc)}`,
        tone: "warning",
        label: "Due Soon",
        to: "/documents",
      })),
      ].slice(0, 5),
    },
    {
      title: "Service Review",
      subtitle: "Completed workshop jobs that still need manager verification.",
      empty: "No service approvals waiting.",
      icon: ClipboardCheck,
      rows: pendingApprovals.slice(0, 5).map((booking): CompliancePanelRow => ({
        id: booking.id,
        title: vehicleLabel(vehicleMap[booking.vehicle_id || ""]),
        meta: `${formatDate(booking.requested_date)} • Completion review waiting`,
        tone: "warning",
        label: "Review",
        to: "/maintenance",
      })),
    },
    {
      title: "Fleet Availability",
      subtitle: "Vehicles currently unavailable because their status is set to maintenance.",
      empty: "No maintenance holds on fleet availability.",
      icon: Wrench,
      rows: vehiclesInMaintenance.slice(0, 5).map((vehicle): CompliancePanelRow => ({
        id: vehicle.id,
        title: vehicleLabel(vehicle),
        meta: "Vehicle status is currently set to maintenance",
        tone: "info",
        label: "Maintenance",
        to: "/management",
      })),
    },
  ];

  return (
    <section className="section">
      <section className="admin-page compliance-page people-page people-page--compliance">
      <div className="stats compliance-stats admin-stats">
        <div className="stat-card stat-card--amber">
          <div className="stat-icon"><AlertTriangle aria-hidden="true" /></div>
          <div className="stat-value">{expiredDocuments.length}</div>
          <div className="stat-label">Renewal Risk</div>
          <div className="stat-sub">Expired documents blocking readiness</div>
        </div>
        <div className="stat-card stat-card--blue">
          <div className="stat-icon"><CalendarClock aria-hidden="true" /></div>
          <div className="stat-value">{expiringSoonDocuments.length}</div>
          <div className="stat-label">Upcoming Renewals</div>
          <div className="stat-sub">Due within the next 30 days</div>
        </div>
        <div className="stat-card stat-card--amber">
          <div className="stat-icon"><Wrench aria-hidden="true" /></div>
          <div className="stat-value">{vehiclesInMaintenance.length}</div>
          <div className="stat-label">Unavailable Vehicles</div>
          <div className="stat-sub">Held in maintenance state</div>
        </div>
        <div className="stat-card stat-card--green">
          <div className="stat-icon"><ClipboardCheck aria-hidden="true" /></div>
          <div className="stat-value">{pendingApprovals.length}</div>
          <div className="stat-label">Approval Queue</div>
          <div className="stat-sub">Completed jobs awaiting review</div>
        </div>
      </div>

      <nav className="admin-tabs" aria-label="Compliance sections">
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
          Alert Register
        </button>
      </nav>

      {activeTab === "overview" && (
      <>
      <div className="compliance-command-grid">
        <section className="card compliance-command-card compliance-action-summary">
          <div className="card__header">
            <div>
              <h3>Action Summary</h3>
              <p className="muted admin-card__subtitle">Open compliance items grouped by urgency and destination.</p>
            </div>
          </div>
          <div className="compliance-summary">
            <div className="compliance-summary__item">
              <span>Open Actions</span>
              <strong>{totalOpenActions}</strong>
            </div>
            <div className="compliance-summary__item">
              <span>Urgent</span>
              <strong>{expiredDocuments.length}</strong>
            </div>
          </div>
          <ul className="people-signal-list compliance-signal-list">
            <li>
              <span className="people-signal-list__icon people-signal-list__icon--info"><ShieldCheck aria-hidden="true" /></span>
              <div>
                <div className="list__title">Document coverage</div>
                <div className="list__meta">{vehicleDocumentCount} vehicle records, {driverDocumentCount} driver records</div>
              </div>
            </li>
            <li>
              <span className="people-signal-list__icon people-signal-list__icon--warning"><CalendarClock aria-hidden="true" /></span>
              <div>
                <div className="list__title">Next renewal window</div>
                <div className="list__meta">{expiringSoonDocuments.length} documents due within 30 days</div>
              </div>
            </li>
          </ul>
        </section>
        <section className="card compliance-command-card compliance-service-card">
          <div className="card__header">
            <div>
              <h3>Recent Service Signals</h3>
              <p className="muted admin-card__subtitle">Latest maintenance activity that may affect availability or follow-up work.</p>
            </div>
          </div>
          {recentMaintenance.length === 0 ? (
            <p className="empty">No recent service activity to review.</p>
          ) : (
            <ul className="list compliance-list">
              {recentMaintenance.map((record) => (
                <li key={record.id}>
                  <div>
                    <div className="list__title">{record.service_type || "Service"}</div>
                    <div className="list__meta">
                      {formatDate(record.service_date)}
                      {record.vehicle_id ? ` • ${vehicleLabel(vehicleMap[record.vehicle_id])}` : ""}
                    </div>
                  </div>
                  <Link className="btn btn--secondary btn--compact compliance-open-btn" to="/maintenance">
                    Review
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="compliance-alert-grid">
        {compliancePanels.map((section) => {
          const PanelIcon = section.icon;
          return (
          <section className="card compliance-alert-card" key={section.title}>
            <div className="card__header">
              <div className="compliance-card-title">
                <span className="people-signal-list__icon people-signal-list__icon--info"><PanelIcon aria-hidden="true" /></span>
                <div>
                  <h3>{section.title}</h3>
                  <p className="muted admin-card__subtitle">{section.subtitle}</p>
                </div>
              </div>
            </div>
            {section.rows.length === 0 ? (
              <p className="empty">{section.empty}</p>
            ) : (
              <ul className="list compliance-list">
                {section.rows.map((row) => (
                  <li key={row.id}>
                    <div>
                      <div className="list__title">{row.title}</div>
                      <div className="list__meta">{row.meta}</div>
                    </div>
                    <div className="compliance-list__actions">
                      <span className={toneClass(row.tone)}>{row.label}</span>
                      <Link className="btn btn--secondary btn--compact compliance-open-btn" to={row.to}>
                        Review
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          );
        })}
      </div>
      </>
      )}

      {activeTab === "register" && (
      <section className="card admin-table-section admin-panel">
        <div className="card__header">
          <div>
            <h3>Compliance Register</h3>
            <p className="muted admin-card__subtitle">Search and route document renewals, fleet holds, and service approvals from one queue.</p>
          </div>
        </div>
        <div className="table-controls">
          <div className="table-controls__filters">
            <label className="table-controls__label table-controls__label--search">
              Search
              <input
                type="search"
                placeholder="Document, vehicle, approval..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="table-controls__label">
              Category
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value as typeof categoryFilter);
                  setPage(1);
                }}
              >
                <option value="all">All</option>
                <option value="documents">Documents</option>
                <option value="fleet">Fleet</option>
                <option value="approvals">Approvals</option>
              </select>
            </label>
            <label className="table-controls__label">
              Rows
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(1);
                }}
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

        {filteredAlerts.length === 0 ? (
          <p className="empty">No compliance alerts match the current filters.</p>
        ) : (
          <div className="table compliance-table" style={{ ["--table-columns" as any]: 4 }}>
            <div className="table__head compliance-table__head">
              <span>Category</span>
              <span>Alert</span>
              <span>Priority</span>
              <span>Action</span>
            </div>
            {visibleAlerts.map((row) => (
              <div className="table__row compliance-table__row" key={row.id}>
                <span data-label="Category">
                  <span className="pill pill--info">{categoryLabel(row.category)}</span>
                </span>
                <span data-label="Alert">
                  <strong>{row.title}</strong>
                  <small className="muted compliance-table__meta">{row.meta}</small>
                </span>
                <span data-label="Priority">
                  <span className={toneClass(row.severity)}>
                    {row.priorityLabel}
                  </span>
                </span>
                <span className="table__actions compliance-table__actions" data-label="Action">
                  <Link className="btn btn--secondary btn--compact compliance-open-btn" to={row.actionTo}>
                    {row.actionLabel}
                  </Link>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
      )}
      </section>
    </section>
  );
}
