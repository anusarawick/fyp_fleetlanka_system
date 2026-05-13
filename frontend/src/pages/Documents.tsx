import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  ExternalLink,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Pencil,
} from "lucide-react";

type Vehicle = {
  id: string;
  plate_no: string;
};

type Driver = {
  id: string;
  full_name?: string;
  email?: string;
};

type Document = {
  id: string;
  vehicle_id?: string;
  driver_id?: string;
  doc_type: string;
  doc_number?: string;
  expiry_date?: string;
  file_url?: string;
  file_path?: string;
  file_name?: string;
  file_mime_type?: string;
  file_size_bytes?: number;
};

type DocumentsProps = {
  vehicles: Vehicle[];
  drivers: Driver[];
  documents: Document[];
  loading: boolean;
  docOwnerType: "vehicle" | "driver";
  setDocOwnerType: (v: "vehicle" | "driver") => void;
  docVehicle: string;
  setDocVehicle: (v: string) => void;
  docDriver: string;
  setDocDriver: (v: string) => void;
  docType: string;
  setDocType: (v: string) => void;
  docNumber: string;
  setDocNumber: (v: string) => void;
  docExpiry: string;
  setDocExpiry: (v: string) => void;
  editingDocumentId: string | null;
  onAddDocument: (e: FormEvent, file?: File | null, removeFile?: boolean) => void;
  onEditDocument: (document: Document) => void;
  onCancelDocumentEdit: () => void;
  onDeleteDocument: (documentId: string) => Promise<void>;
  onGetDocumentFileUrl: (documentId: string) => Promise<string>;
};

type DocumentRegisterTab = "vehicle" | "driver";
type DocumentStatusFilter = "all" | "valid" | "expiring" | "expired" | "no-expiry";
type DocumentsReportModal = "renewals" | "coverage" | null;
type CoverageIssue = {
  label: string;
  detail: string;
  tone: "danger" | "warning" | "success" | "info";
  badge: string;
};

export default function Documents(props: DocumentsProps) {
  const [registerTab, setRegisterTab] = useState<DocumentRegisterTab>("vehicle");
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentOwnerFilter, setDocumentOwnerFilter] = useState("all");
  const [documentTypeFilter, setDocumentTypeFilter] = useState("all");
  const [documentStatusFilter, setDocumentStatusFilter] = useState<DocumentStatusFilter>("all");
  const [documentRowsPerPage, setDocumentRowsPerPage] = useState(10);
  const [documentPage, setDocumentPage] = useState(1);
  const [useCustomDocumentType, setUseCustomDocumentType] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [removeDocumentFile, setRemoveDocumentFile] = useState(false);
  const [documentFileError, setDocumentFileError] = useState("");
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  const [documentsReportModal, setDocumentsReportModal] = useState<DocumentsReportModal>(null);

  const allowedDocumentFileTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  const maxDocumentFileBytes = 10 * 1024 * 1024;

  const vehicleDocumentTypes = [
    "Insurance",
    "Registration",
    "Revenue License",
    "Emission Test",
    "Service Contract",
  ];

  const driverDocumentTypes = [
    "Driving License",
    "Medical Certificate",
    "Driver Permit",
    "National ID",
    "Training Certificate",
  ];

  const vehicleLabelMap = useMemo(
    () =>
      props.vehicles.reduce<Record<string, string>>((acc, vehicle) => {
        acc[vehicle.id] = vehicle.plate_no;
        return acc;
      }, {}),
    [props.vehicles]
  );

  const driverLabelMap = useMemo(
    () =>
      props.drivers.reduce<Record<string, string>>((acc, driver) => {
        acc[driver.id] = driver.full_name || driver.email || driver.id;
        return acc;
      }, {}),
    [props.drivers]
  );

  const documentTypeOptions =
    props.docOwnerType === "vehicle" ? vehicleDocumentTypes : driverDocumentTypes;
  const isCustomDocumentType = !!props.docType && !documentTypeOptions.includes(props.docType);

  useEffect(() => {
    setUseCustomDocumentType(isCustomDocumentType);
  }, [isCustomDocumentType, props.docOwnerType]);

  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  function getExpiryStatus(expiryDate?: string) {
    if (!expiryDate) return { label: "No Expiry", key: "no-expiry" as const, tone: "neutral" as const };
    const expiry = new Date(expiryDate).getTime();
    if (expiry < now) return { label: "Expired", key: "expired" as const, tone: "danger" as const };
    if (expiry <= now + thirtyDays) return { label: "Expiring Soon", key: "expiring" as const, tone: "warning" as const };
    return { label: "Valid", key: "valid" as const, tone: "success" as const };
  }

  function getDocumentOwner(doc: Document) {
    if (doc.vehicle_id) {
      return {
        type: "Vehicle",
        label: vehicleLabelMap[doc.vehicle_id] || "Vehicle not found",
      };
    }
    if (doc.driver_id) {
      return {
        type: "Driver",
        label: driverLabelMap[doc.driver_id] || "Driver not found",
      };
    }
    return {
      type: "Unassigned",
      label: "Owner not recorded",
    };
  }

  function formatDisplayDate(value?: string) {
    if (!value) return "Not dated";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  }

  function documentTypeMatches(actual: string, expected: string) {
    const normalizedActual = actual.toLowerCase();
    const normalizedExpected = expected.toLowerCase();
    if (normalizedExpected === "insurance") return normalizedActual.includes("insurance");
    if (normalizedExpected === "registration") return normalizedActual.includes("registration");
    if (normalizedExpected === "revenue license") return normalizedActual.includes("revenue") || normalizedActual.includes("licence") || normalizedActual.includes("license");
    if (normalizedExpected === "emission test") return normalizedActual.includes("emission");
    if (normalizedExpected === "driving license") return normalizedActual.includes("driving") || normalizedActual.includes("license") || normalizedActual.includes("licence");
    if (normalizedExpected === "medical certificate") return normalizedActual.includes("medical");
    return normalizedActual.includes(normalizedExpected);
  }

  function getUrgency(doc: Document) {
    if (!doc.expiry_date) return { label: "Low", tone: "success" as const };
    const daysUntilExpiry = Math.ceil((new Date(`${doc.expiry_date}T00:00:00`).getTime() - now) / (24 * 60 * 60 * 1000));
    if (daysUntilExpiry < 0) return { label: "Overdue", tone: "danger" as const };
    if (daysUntilExpiry <= 30) return { label: "High", tone: "warning" as const };
    if (daysUntilExpiry <= 90) return { label: "Medium", tone: "warning" as const };
    return { label: "Low", tone: "success" as const };
  }

  const expiredCount = props.documents.filter((doc) => getExpiryStatus(doc.expiry_date).key === "expired").length;
  const dueSoonCount = props.documents.filter((doc) => getExpiryStatus(doc.expiry_date).key === "expiring").length;
  const currentCount = props.documents.filter((doc) => getExpiryStatus(doc.expiry_date).key === "valid").length;
  const noExpiryCount = props.documents.filter((doc) => getExpiryStatus(doc.expiry_date).label === "No Expiry").length;
  const renewalPriorityRows = props.documents
    .filter((doc) => !!doc.expiry_date)
    .sort((a, b) => String(a.expiry_date).localeCompare(String(b.expiry_date)));
  const renewalQueue = renewalPriorityRows.slice(0, 8);

  const expectedVehicleTypes = ["Insurance", "Emission Test", "Revenue License", "Registration"];
  const expectedDriverTypes = ["Driving License", "Medical Certificate"];
  const missingVehicleDocuments = expectedVehicleTypes.map((type) => ({
    type,
    missing: props.vehicles.filter((vehicle) =>
      !props.documents.some((doc) => doc.vehicle_id === vehicle.id && documentTypeMatches(doc.doc_type, type))
    ).length,
  }));
  const missingDriverDocuments = expectedDriverTypes.map((type) => ({
    type,
    missing: props.drivers.filter((driver) =>
      !props.documents.some((doc) => doc.driver_id === driver.id && documentTypeMatches(doc.doc_type, type))
    ).length,
  }));
  const missingCoverageCount = [...missingVehicleDocuments, ...missingDriverDocuments].reduce((sum, row) => sum + row.missing, 0);
  const coverageIssues: CoverageIssue[] = [
    { label: "Missing Insurance", detail: `${missingVehicleDocuments[0]?.missing || 0} Vehicles`, tone: "danger", badge: "High" },
    { label: "Missing Emission Reports", detail: `${missingVehicleDocuments[1]?.missing || 0} Vehicles`, tone: "warning", badge: "Medium" },
    { label: "Missing Revenue Licenses", detail: `${missingVehicleDocuments[2]?.missing || 0} Vehicles`, tone: "info", badge: "Medium" },
    { label: "Missing Registration Certificates", detail: `${missingVehicleDocuments[3]?.missing || 0} Vehicles`, tone: "success", badge: "Low" },
    { label: "Missing Driving Licenses", detail: `${missingDriverDocuments[0]?.missing || 0} Drivers`, tone: "danger", badge: "High" },
    { label: "Missing Medical Certificates", detail: `${missingDriverDocuments[1]?.missing || 0} Drivers`, tone: "warning", badge: "Medium" },
  ];

  const visibleDocumentTypes = registerTab === "vehicle" ? vehicleDocumentTypes : driverDocumentTypes;
  const visibleOwners = registerTab === "vehicle" ? props.vehicles : props.drivers;

  const filteredDocuments = props.documents.filter((doc) => {
    const query = documentSearch.trim().toLowerCase();
    const isVehicleDocument = !!doc.vehicle_id;
    if (registerTab === "vehicle" && !isVehicleDocument) return false;
    if (registerTab === "driver" && isVehicleDocument) return false;
    const ownerId = doc.vehicle_id || doc.driver_id || "";
    if (documentOwnerFilter !== "all" && ownerId !== documentOwnerFilter) return false;
    if (documentTypeFilter !== "all" && doc.doc_type !== documentTypeFilter) return false;
    const status = getExpiryStatus(doc.expiry_date);
    if (documentStatusFilter !== "all" && status.key !== documentStatusFilter) return false;
    if (!query) return true;
    return [
      doc.doc_type,
      doc.doc_number,
      doc.expiry_date,
      doc.file_url,
      doc.file_name,
      doc.vehicle_id ? vehicleLabelMap[doc.vehicle_id] : "",
      doc.driver_id ? driverLabelMap[doc.driver_id] : "",
      doc.vehicle_id ? "vehicle" : doc.driver_id ? "driver" : "",
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const documentTotalPages = Math.max(1, Math.ceil(filteredDocuments.length / documentRowsPerPage));
  const currentDocumentPage = Math.min(documentPage, documentTotalPages);
  const paginatedDocuments = filteredDocuments.slice(
    (currentDocumentPage - 1) * documentRowsPerPage,
    currentDocumentPage * documentRowsPerPage
  );
  const editingDocument = props.editingDocumentId
    ? props.documents.find((doc) => doc.id === props.editingDocumentId)
    : undefined;

  useEffect(() => {
    setDocumentPage(1);
  }, [documentRowsPerPage, documentSearch, documentOwnerFilter, documentTypeFilter, documentStatusFilter, registerTab, props.documents.length]);

  useEffect(() => {
    if (!props.loading) {
      setShowDocumentModal(false);
      setUseCustomDocumentType(false);
      resetDocumentFileState();
    }
  }, [props.loading]);

  useEffect(() => {
    if (!selectedDocument) return;
    const latest = props.documents.find((doc) => doc.id === selectedDocument.id);
    if (latest && latest !== selectedDocument) {
      setSelectedDocument(latest);
    }
  }, [props.documents, selectedDocument]);

  function resetDocumentFileState() {
    setDocumentFile(null);
    setRemoveDocumentFile(false);
    setDocumentFileError("");
  }

  function hasDocumentFile(doc: Document) {
    return Boolean(doc.file_path || doc.file_url);
  }

  function isExternalFileUrl(value?: string) {
    return Boolean(value && /^https?:\/\//i.test(value));
  }

  function getDocumentFileReference(doc: Document) {
    const fileUrl = doc.file_url || "";
    if (!fileUrl.startsWith("document-files://")) return {};
    try {
      const url = new URL(fileUrl);
      return {
        name: url.searchParams.get("name") || undefined,
        type: url.searchParams.get("type") || undefined,
        size: url.searchParams.get("size") ? Number(url.searchParams.get("size")) : undefined,
      };
    } catch {
      return {};
    }
  }

  function formatFileSize(bytes?: number) {
    if (!bytes) return "--";
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getDocumentFileName(doc: Document) {
    if (!hasDocumentFile(doc)) return "No file uploaded";
    return doc.file_name || getDocumentFileReference(doc).name || "Uploaded file";
  }

  function getDocumentFileSize(doc: Document) {
    const referenceSize = getDocumentFileReference(doc).size;
    return doc.file_size_bytes || (Number.isFinite(referenceSize) ? referenceSize : undefined);
  }

  function getDocumentFileType(doc: Document) {
    const referenceType = getDocumentFileReference(doc).type;
    if (referenceType) return referenceType;
    if (doc.file_mime_type) return doc.file_mime_type;
    const path = doc.file_path || doc.file_url || doc.file_name || "";
    const extension = path.includes(".") ? path.split(".").pop()?.toLowerCase() : "";
    if (extension === "pdf") return "application/pdf";
    if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
    if (extension === "png") return "image/png";
    if (extension === "webp") return "image/webp";
    return "--";
  }

  function handleDocumentFileChange(file?: File) {
    setDocumentFileError("");
    if (!file) {
      setDocumentFile(null);
      return;
    }
    if (!allowedDocumentFileTypes.includes(file.type)) {
      setDocumentFile(null);
      setDocumentFileError("Upload a PDF, JPG, PNG, or WebP file.");
      return;
    }
    if (file.size > maxDocumentFileBytes) {
      setDocumentFile(null);
      setDocumentFileError("Document file must be 10MB or smaller.");
      return;
    }
    setDocumentFile(file);
    setRemoveDocumentFile(false);
  }

  async function openDocumentFile(doc: Document) {
    if (doc.file_url && !doc.file_path && isExternalFileUrl(doc.file_url)) {
      window.open(doc.file_url, "_blank", "noopener,noreferrer");
      return;
    }
    if (!doc.file_path && !doc.file_url) return;
    setOpeningDocumentId(doc.id);
    try {
      const url = await props.onGetDocumentFileUrl(doc.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningDocumentId(null);
    }
  }

  function closeDocumentModal() {
    setShowDocumentModal(false);
    if (props.editingDocumentId) {
      props.onCancelDocumentEdit();
    }
    setUseCustomDocumentType(false);
    resetDocumentFileState();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await props.onDeleteDocument(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <section className="section">
      <section className="admin-page people-page people-page--documents">
        <section className="dashboard-kpis documents-kpi-grid" aria-label="Document summary">
          <article className="dashboard-kpi-card dashboard-kpi-card--teal">
            <span className="dashboard-kpi-card__icon"><FileText aria-hidden="true" /></span>
            <div>
              <span className="dashboard-kpi-card__label">Total Documents</span>
              <strong>{props.documents.length}</strong>
              <small className="dashboard-trend dashboard-trend--positive">{currentCount} valid records</small>
            </div>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card--orange">
            <span className="dashboard-kpi-card__icon"><Clock3 aria-hidden="true" /></span>
            <div>
              <span className="dashboard-kpi-card__label">Expiring Soon</span>
              <strong>{dueSoonCount}</strong>
              <small className="dashboard-trend dashboard-trend--positive">within 30 days</small>
            </div>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card--red">
            <span className="dashboard-kpi-card__icon"><AlertTriangle aria-hidden="true" /></span>
            <div>
              <span className="dashboard-kpi-card__label">Expired</span>
              <strong>{expiredCount}</strong>
              <small className="dashboard-trend dashboard-trend--negative">{noExpiryCount} undated</small>
            </div>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card--purple">
            <span className="dashboard-kpi-card__icon"><ShieldCheck aria-hidden="true" /></span>
            <div>
              <span className="dashboard-kpi-card__label">Missing Coverage</span>
              <strong>{missingCoverageCount}</strong>
              <small className="dashboard-trend dashboard-trend--negative">expected records</small>
            </div>
          </article>
        </section>

        <div className="documents-workspace-grid">
          <section className="card documents-register-card">
            <div className="documents-card-header">
              <h3>Document Register</h3>
              <button
                className="documents-table-action"
                type="button"
                onClick={() => {
                  props.onCancelDocumentEdit();
                  setUseCustomDocumentType(false);
                  resetDocumentFileState();
                  setShowDocumentModal(true);
                }}
              >
                <Plus aria-hidden="true" />
                Add Document
              </button>
            </div>
            <div className="documents-segmented-tabs" aria-label="Document owner type">
              <button
                className={registerTab === "vehicle" ? "is-active" : ""}
                type="button"
                onClick={() => {
                  setRegisterTab("vehicle");
                  setDocumentOwnerFilter("all");
                  setDocumentTypeFilter("all");
                }}
              >
                Vehicle Documents
              </button>
              <button
                className={registerTab === "driver" ? "is-active" : ""}
                type="button"
                onClick={() => {
                  setRegisterTab("driver");
                  setDocumentOwnerFilter("all");
                  setDocumentTypeFilter("all");
                }}
              >
                Driver Documents
              </button>
            </div>
            <div className="documents-table-controls">
              <label className="documents-search-control">
                <Search aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search by owner, type, or number..."
                  value={documentSearch}
                  onChange={(e) => setDocumentSearch(e.target.value)}
                />
              </label>
              <label className="documents-select-control">
                <span>{registerTab === "vehicle" ? "Owner" : "Driver"}</span>
                <select value={documentOwnerFilter} onChange={(event) => setDocumentOwnerFilter(event.target.value)}>
                  <option value="all">All Owners</option>
                  {visibleOwners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {"plate_no" in owner ? owner.plate_no : owner.full_name || owner.email || owner.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="documents-select-control">
                <span>Type</span>
                <select value={documentTypeFilter} onChange={(event) => setDocumentTypeFilter(event.target.value)}>
                  <option value="all">All Document Types</option>
                  {visibleDocumentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label className="documents-select-control">
                <span>Status</span>
                <select value={documentStatusFilter} onChange={(event) => setDocumentStatusFilter(event.target.value as DocumentStatusFilter)}>
                  <option value="all">All Statuses</option>
                  <option value="valid">Valid</option>
                  <option value="expiring">Expiring Soon</option>
                  <option value="expired">Expired</option>
                  <option value="no-expiry">No Expiry</option>
                </select>
              </label>
              <label className="documents-select-control documents-select-control--rows">
                <span>Rows</span>
                <select value={documentRowsPerPage} onChange={(e) => setDocumentRowsPerPage(Number(e.target.value))}>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>
            </div>
            {filteredDocuments.length === 0 ? (
              <p className="empty">No documents match the current filters.</p>
            ) : (
              <div className="documents-register-table documents-table">
                <div className="documents-table__head">
                  <span>Owner</span>
                  <span>Type</span>
                  <span>Number</span>
                  <span>Expiry Date</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
                {paginatedDocuments.map((doc) => {
                  const owner = getDocumentOwner(doc);
                  const status = getExpiryStatus(doc.expiry_date);
                  return (
                    <div className="documents-table__row" key={doc.id}>
                      <span className="documents-table__owner" data-label="Owner">
                        <FileText aria-hidden="true" />
                        <strong>{owner.label}</strong>
                      </span>
                      <span data-label="Type">{doc.doc_type}</span>
                      <span data-label="Number">{doc.doc_number || "Not recorded"}</span>
                      <span data-label="Expiry Date">{formatDisplayDate(doc.expiry_date)}</span>
                      <span data-label="Status"><span className={`documents-status-badge documents-status-badge--${status.tone}`}>{status.label}</span></span>
                      <span className="documents-table__actions" data-label="Actions">
                        {hasDocumentFile(doc) && (
                          <span className="documents-attachment-indicator" title="File attached" aria-label="File attached">
                            <Paperclip aria-hidden="true" />
                          </span>
                        )}
                        <button className="icon-action" type="button" onClick={() => setSelectedDocument(doc)} aria-label={`View document ${doc.id}`} title="View document">
                          <Eye className="icon-action__svg icon-action__svg--view" aria-hidden="true" />
                        </button>
                        <button
                          className="icon-action"
                          type="button"
                          onClick={() => {
                            props.onEditDocument(doc);
                            setUseCustomDocumentType(false);
                            resetDocumentFileState();
                            setShowDocumentModal(true);
                          }}
                          aria-label={`Edit document ${doc.id}`}
                          title="Edit document"
                        >
                          <Pencil className="icon-action__svg icon-action__svg--edit" aria-hidden="true" />
                        </button>
                        <button className="icon-action icon-action--danger" type="button" onClick={() => setDeleteTarget(doc)} aria-label={`Delete document ${doc.id}`} title="Delete document">
                          <Trash2 className="icon-action__svg icon-action__svg--delete" aria-hidden="true" />
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="documents-table-footer">
              <span>Showing {filteredDocuments.length === 0 ? 0 : (currentDocumentPage - 1) * documentRowsPerPage + 1} to {Math.min(currentDocumentPage * documentRowsPerPage, filteredDocuments.length)} of {filteredDocuments.length} entries</span>
              <div className="table-pagination documents-pagination-controls">
                <span className="table-pagination__meta">Page {currentDocumentPage} of {documentTotalPages}</span>
                <button
                  className="documents-page-button"
                  type="button"
                  onClick={() => setDocumentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentDocumentPage === 1}
                >
                  <ChevronLeft aria-hidden="true" /> Prev
                </button>
                <button
                  className="documents-page-button"
                  type="button"
                  onClick={() => setDocumentPage((prev) => Math.min(documentTotalPages, prev + 1))}
                  disabled={currentDocumentPage === documentTotalPages}
                >
                  Next <ChevronRight aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>

          <aside className="documents-side-panel">
            <section className="card documents-side-card">
              <div className="documents-side-card__header">
                <h3>Renewal Priority Queue</h3>
                <button type="button" onClick={() => setDocumentsReportModal("renewals")}>View all</button>
              </div>
              <div className="documents-renewal-queue">
                {renewalQueue.length === 0 ? (
                  <p className="empty">No dated renewals are waiting.</p>
                ) : renewalQueue.map((doc) => {
                  const owner = getDocumentOwner(doc);
                  const urgency = getUrgency(doc);
                  return (
                    <div className="documents-renewal-row" key={doc.id}>
                      <span className={`documents-row-icon documents-row-icon--${urgency.tone}`}><FileText aria-hidden="true" /></span>
                      <strong>{owner.label}</strong>
                      <span>{doc.doc_type}</span>
                      <span>{formatDisplayDate(doc.expiry_date)}</span>
                      <b className={`documents-badge documents-badge--${urgency.tone}`}>{urgency.label}</b>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="card documents-side-card">
              <div className="documents-side-card__header">
                <h3>Coverage Summary</h3>
                <button type="button" onClick={() => setDocumentsReportModal("coverage")}>View report</button>
              </div>
              <div className="documents-coverage-list">
                {coverageIssues.map((item) => (
                  <div className="documents-coverage-row" key={item.label}>
                    <span className={`documents-row-icon documents-row-icon--${item.tone}`}><AlertTriangle aria-hidden="true" /></span>
                    <div>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </div>
                    <b className={`documents-badge documents-badge--${item.tone}`}>{item.badge}</b>
                    <ChevronRight aria-hidden="true" />
                  </div>
                ))}
                <div className="documents-info-note">
                  <CalendarDays aria-hidden="true" />
                  <span>Keeping documents up to date ensures compliance and avoids penalties.</span>
                </div>
              </div>
            </section>
          </aside>
        </div>

      {documentsReportModal === "renewals" && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--wide modal--details" role="dialog" aria-modal="true" aria-label="Renewal priority report">
            <div className="modal__header">
              <div>
                <h3>Renewal Priority Queue</h3>
                <p className="modal__subtle">All dated documents sorted by the nearest expiry date.</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setDocumentsReportModal(null)} aria-label="Close renewal report">
                ✕
              </button>
            </div>
            <div className="details-grid details-grid--scroll">
              {renewalPriorityRows.length === 0 ? (
                <p className="empty">No dated renewals are waiting.</p>
              ) : (
                renewalPriorityRows.map((doc) => {
                  const owner = getDocumentOwner(doc);
                  const urgency = getUrgency(doc);
                  return (
                    <div className="detail-item" key={doc.id}>
                      <span>{owner.label}</span>
                      <strong>{doc.doc_type}</strong>
                      <small>{formatDisplayDate(doc.expiry_date)} • {urgency.label}</small>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {documentsReportModal === "coverage" && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--wide modal--details" role="dialog" aria-modal="true" aria-label="Document coverage report">
            <div className="modal__header">
              <div>
                <h3>Coverage Summary Report</h3>
                <p className="modal__subtle">Expected vehicle and driver document coverage based on the current register.</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setDocumentsReportModal(null)} aria-label="Close coverage report">
                ✕
              </button>
            </div>
            <div className="details-grid details-grid--scroll">
              <div className="detail-item"><span>Total Missing Coverage</span><strong>{missingCoverageCount}</strong><small>Across expected vehicle and driver document types.</small></div>
              {[...missingVehicleDocuments, ...missingDriverDocuments].map((row) => (
                <div className="detail-item" key={row.type}>
                  <span>{row.type}</span>
                  <strong>{row.missing}</strong>
                  <small>{missingDriverDocuments.some((item) => item.type === row.type) ? "Drivers missing this document" : "Vehicles missing this document"}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showDocumentModal && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--form" role="dialog" aria-modal="true" aria-label="Document form">
            <div className="modal__header">
              <div>
                <h3>{props.editingDocumentId ? "Edit Document" : "Add Document"}</h3>
                <p className="modal__subtle">
                  {props.editingDocumentId
                    ? "Update the owner, document details, or renewal date."
                    : "Create a document record for a vehicle or driver."}
                </p>
              </div>
              <button className="modal__close" type="button" onClick={closeDocumentModal} aria-label="Close document form">
                ✕
              </button>
            </div>
            <form
              id="document-form"
              className="form form--scroll"
              onSubmit={(event) => props.onAddDocument(event, documentFile, removeDocumentFile)}
            >
              <div className="form-section-title">
                <div>
                  <h4>Owner</h4>
                  <p>Attach this document to the vehicle or driver responsible for renewal.</p>
                </div>
              </div>
              <label>
                Document Owner
                <select
                  value={props.docOwnerType}
                  onChange={(e) => {
                    const nextOwnerType = e.target.value as "vehicle" | "driver";
                    props.setDocOwnerType(nextOwnerType);
                    if (nextOwnerType === "vehicle") {
                      props.setDocDriver("");
                    } else {
                      props.setDocVehicle("");
                    }
                    props.setDocType("");
                    setUseCustomDocumentType(false);
                  }}
                >
                  <option value="vehicle">Vehicle</option>
                  <option value="driver">Driver</option>
                </select>
              </label>
              {props.docOwnerType === "vehicle" ? (
              <label>
                Vehicle
                <select
                  value={props.docVehicle}
                  onChange={(e) => props.setDocVehicle(e.target.value)}
                >
                  <option value="">Select a vehicle</option>
                  {props.vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                    {v.plate_no}
                  </option>
                ))}
                </select>
              </label>
              ) : (
              <label>
                Driver
                <select
                  value={props.docDriver}
                  onChange={(e) => props.setDocDriver(e.target.value)}
                >
                  <option value="">Select a driver</option>
                  {props.drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.full_name || driver.email || driver.id}
                    </option>
                  ))}
                </select>
              </label>
              )}
              <div className="form-section-title">
                <div>
                  <h4>Document</h4>
                  <p>Capture the document type and reference number used during checks.</p>
                </div>
              </div>
              <label>
                Document Type
                <select
                  value={useCustomDocumentType ? "__other__" : props.docType}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    if (nextValue === "__other__") {
                      setUseCustomDocumentType(true);
                      props.setDocType("");
                      return;
                    }
                    setUseCustomDocumentType(false);
                    props.setDocType(nextValue);
                  }}
                  required
                >
                  <option value="">Select a document type</option>
                  {documentTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value="__other__">Other</option>
                </select>
              </label>
              {useCustomDocumentType && (
                <label>
                  Other Document Type
                  <input
                    placeholder="Enter document type"
                    value={props.docType}
                    onChange={(e) => props.setDocType(e.target.value)}
                    required
                  />
                </label>
              )}
              <label>
                Document Number
                <input
                  value={props.docNumber}
                  onChange={(e) => props.setDocNumber(e.target.value)}
                />
              </label>
              <div className="form-section-title">
                <div>
                  <h4>Expiry</h4>
                  <p>Add a renewal date when this document needs expiry tracking.</p>
                </div>
              </div>
              <label>
                Expiry Date
                <input
                  type="date"
                  value={props.docExpiry}
                  onChange={(e) => props.setDocExpiry(e.target.value)}
                />
              </label>
              <div className="form-section-title">
                <div>
                  <h4>File</h4>
                  <p>Attach a PDF or image copy for private storage.</p>
                </div>
              </div>
              <div className="documents-file-field">
                <div>
                  <span className="documents-file-field__label">Document File</span>
                  <strong>
                    {documentFile
                      ? documentFile.name
                      : props.editingDocumentId && !removeDocumentFile
                        ? editingDocument && hasDocumentFile(editingDocument)
                          ? getDocumentFileName(editingDocument)
                          : "No file selected"
                        : "No file selected"}
                  </strong>
                  <small>
                    {documentFile
                      ? formatFileSize(documentFile.size)
                      : props.editingDocumentId && !removeDocumentFile
                        ? editingDocument && hasDocumentFile(editingDocument)
                          ? formatFileSize(getDocumentFileSize(editingDocument))
                          : "PDF, JPG, PNG, or WebP up to 10MB"
                        : "PDF, JPG, PNG, or WebP up to 10MB"}
                  </small>
                  {removeDocumentFile && <small>Current file will be removed when saved.</small>}
                  {documentFileError && <small className="documents-file-field__error">{documentFileError}</small>}
                </div>
                <div className="documents-file-field__actions">
                  <label className="btn btn--secondary documents-file-upload">
                    Choose File
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      onChange={(event) => handleDocumentFileChange(event.target.files?.[0])}
                    />
                  </label>
                  {(documentFile || (editingDocument && hasDocumentFile(editingDocument))) && (
                    <button
                      className="btn btn--secondary"
                      type="button"
                      onClick={() => {
                        setDocumentFile(null);
                        setRemoveDocumentFile(Boolean(props.editingDocumentId));
                        setDocumentFileError("");
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </form>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={closeDocumentModal}>
                Cancel
              </button>
              <button className="btn" type="submit" form="document-form" disabled={props.loading}>
                {props.loading ? "Saving..." : props.editingDocumentId ? "Save Changes" : "Add Document"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedDocument && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Document details">
            <div className="modal__header">
              <div>
                <h3>Document Details</h3>
                <p className="modal__subtle">Document owner, reference details, and renewal status.</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setSelectedDocument(null)} aria-label="Close document details">
                ✕
              </button>
            </div>
            <div className="details-grid">
              <div className="detail-item">
                <span>Owner</span>
                <strong>{getDocumentOwner(selectedDocument).label}</strong>
              </div>
              <div className="detail-item">
                <span>Owner Type</span>
                <strong>{getDocumentOwner(selectedDocument).type}</strong>
              </div>
              <div className="detail-item"><span>Type</span><strong>{selectedDocument.doc_type}</strong></div>
              <div className="detail-item"><span>Number</span><strong>{selectedDocument.doc_number || "Not recorded"}</strong></div>
              <div className="detail-item"><span>Expiry</span><strong>{selectedDocument.expiry_date || "Not dated"}</strong></div>
              <div className="detail-item">
                <span>Status</span>
                <strong>
                  <span className={`pill pill--${getExpiryStatus(selectedDocument.expiry_date).tone}`}>
                    {getExpiryStatus(selectedDocument.expiry_date).label}
                  </span>
                </strong>
              </div>
              <div className="detail-item"><span>File</span><strong>{getDocumentFileName(selectedDocument)}</strong></div>
              <div className="detail-item"><span>File Type</span><strong>{getDocumentFileType(selectedDocument)}</strong></div>
              <div className="detail-item"><span>File Size</span><strong>{formatFileSize(getDocumentFileSize(selectedDocument))}</strong></div>
              <div className="detail-item detail-item--full documents-file-open-row">
                <span>File Access</span>
                <strong>{hasDocumentFile(selectedDocument) ? "Private file available" : "--"}</strong>
                {hasDocumentFile(selectedDocument) && (
                  <button
                    className="btn btn--secondary documents-file-open"
                    type="button"
                    onClick={() => openDocumentFile(selectedDocument)}
                    disabled={openingDocumentId === selectedDocument.id}
                  >
                    <ExternalLink aria-hidden="true" />
                    {openingDocumentId === selectedDocument.id ? "Opening..." : "Open File"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Confirm delete">
            <div className="modal__header">
              <h3>Delete Document?</h3>
              <button className="modal__close" type="button" onClick={() => setDeleteTarget(null)} aria-label="Close delete dialog">
                ✕
              </button>
            </div>
            <p className="muted">
              Are you sure you want to delete <strong>{deleteTarget.doc_type}</strong>? This action
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
