import { FormEvent, useEffect, useMemo, useState } from "react";

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
  onAddDocument: (e: FormEvent) => void;
  onEditDocument: (document: Document) => void;
  onCancelDocumentEdit: () => void;
  onDeleteDocument: (documentId: string) => Promise<void>;
};

export default function Documents(props: DocumentsProps) {
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentRowsPerPage, setDocumentRowsPerPage] = useState(10);
  const [documentPage, setDocumentPage] = useState(1);
  const [useCustomDocumentType, setUseCustomDocumentType] = useState(false);

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

  const expiringSoonCount = props.documents.filter((doc) => {
    if (!doc.expiry_date) return false;
    const expiry = new Date(doc.expiry_date).getTime();
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    return expiry <= now + thirtyDays;
  }).length;

  function getExpiryStatus(expiryDate?: string) {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate).getTime();
    const now = Date.now();
    if (expiry < now) return { label: "Expired", tone: "danger" as const };
    return { label: "Expiring Soon", tone: "warning" as const };
  }

  const filteredDocuments = props.documents.filter((doc) => {
    const query = documentSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      doc.doc_type,
      doc.doc_number,
      doc.expiry_date,
      doc.file_url,
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

  useEffect(() => {
    setDocumentPage(1);
  }, [documentRowsPerPage, documentSearch, props.documents.length]);

  useEffect(() => {
    if (!props.loading) {
      setShowDocumentModal(false);
      setUseCustomDocumentType(false);
    }
  }, [props.loading]);

  function closeDocumentModal() {
    setShowDocumentModal(false);
    if (props.editingDocumentId) {
      props.onCancelDocumentEdit();
    }
    setUseCustomDocumentType(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await props.onDeleteDocument(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <section className="section">
      <div className="stats" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: "24px" }}>
        <div className="stat-card">
          <div className="stat-icon">📄</div>
          <div className="stat-value">{props.documents.length}</div>
          <div className="stat-label">Documents</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-value">{expiringSoonCount}</div>
          <div className="stat-label">Expiring Soon</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🚐</div>
          <div className="stat-value">{props.vehicles.length}</div>
          <div className="stat-label">Fleet Vehicles</div>
        </div>
      </div>

      <div className="grid">
        <section className="card">
          <div className="card__header">
            <h3>Document Actions</h3>
          </div>
          <p className="muted">Track registration, insurance, and renewal dates from a focused add form.</p>
          <div className="button-row">
            <button
              className="btn"
              type="button"
              onClick={() => {
                props.onCancelDocumentEdit();
                setUseCustomDocumentType(false);
                setShowDocumentModal(true);
              }}
            >
              + Add Document
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <h3>Renewal Watch</h3>
          </div>
          {props.documents.length === 0 ? (
            <p className="empty">No documents tracked yet.</p>
          ) : (
            <ul className="list">
              {props.documents
                .filter((doc) => !!doc.expiry_date)
                .sort((a, b) => String(a.expiry_date).localeCompare(String(b.expiry_date)))
                .slice(0, 4)
                .map((doc) => {
                  const expiryStatus = getExpiryStatus(doc.expiry_date);
                  return (
                    <li key={doc.id}>
                      <div className="list__title">
                        {doc.doc_type} • {doc.vehicle_id ? vehicleLabelMap[doc.vehicle_id || ""] || "Vehicle" : driverLabelMap[doc.driver_id || ""] || "Driver"}
                      </div>
                      <div className="list__meta">
                        {doc.expiry_date || "No expiry date"}{" "}
                        {expiryStatus && (
                          <span className={`pill pill--${expiryStatus.tone}`}>
                            {expiryStatus.label}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: "24px" }}>
        <div className="card__header">
          <h3>Document Register</h3>
        </div>
        {props.documents.length === 0 ? (
          <p className="empty">No documents yet.</p>
        ) : (
          <>
            <div className="table-controls">
              <div className="table-controls__filters">
                <label className="table-controls__label table-controls__label--search">
                  Search
                  <input
                    type="search"
                    placeholder="Type, number, vehicle..."
                    value={documentSearch}
                    onChange={(e) => setDocumentSearch(e.target.value)}
                  />
                </label>
                <label className="table-controls__label">
                  Rows
                  <select
                    value={documentRowsPerPage}
                    onChange={(e) => setDocumentRowsPerPage(Number(e.target.value))}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>
              <div className="table-pagination">
                <span className="table-pagination__meta">
                  Page {currentDocumentPage} of {documentTotalPages}
                </span>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setDocumentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentDocumentPage === 1}
                >
                  Prev
                </button>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setDocumentPage((prev) => Math.min(documentTotalPages, prev + 1))}
                  disabled={currentDocumentPage === documentTotalPages}
                >
                  Next
                </button>
              </div>
            </div>
            {filteredDocuments.length === 0 ? (
              <p className="empty">No documents match the current search.</p>
            ) : (
              <div className="table documents-table" style={{ ["--table-columns" as any]: 5 }}>
                <div className="table__head documents-table__head">
                  <span>Owner</span>
                  <span>Type</span>
                  <span>Number</span>
                  <span>Expiry</span>
                  <span>Actions</span>
                </div>
                {paginatedDocuments.map((doc) => (
                  <div className="table__row documents-table__row" key={doc.id}>
                    <span data-label="Owner">
                      {doc.vehicle_id
                        ? `Vehicle • ${vehicleLabelMap[doc.vehicle_id || ""] || "--"}`
                        : `Driver • ${driverLabelMap[doc.driver_id || ""] || "--"}`}
                    </span>
                    <span data-label="Type">{doc.doc_type}</span>
                    <span data-label="Number">{doc.doc_number || "--"}</span>
                    <span data-label="Expiry">{doc.expiry_date || "--"}</span>
                    <span className="table__actions documents-table__actions" data-label="Actions">
                      <button
                        className="icon-action"
                        type="button"
                        onClick={() => setSelectedDocument(doc)}
                        aria-label={`View document ${doc.id}`}
                        title="View document"
                      >
                        <svg className="icon-action__svg icon-action__svg--view" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
                        </svg>
                      </button>
                      <button
                        className="icon-action"
                        type="button"
                        onClick={() => {
                          props.onEditDocument(doc);
                          setUseCustomDocumentType(false);
                          setShowDocumentModal(true);
                        }}
                        aria-label={`Edit document ${doc.id}`}
                        title="Edit document"
                      >
                        <svg className="icon-action__svg icon-action__svg--edit" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M4.5 19.5h3.75L18.75 9 15 5.25 4.5 15.75v3.75Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M13.5 6.75 17.25 10.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        className="icon-action icon-action--danger"
                        type="button"
                        onClick={() => setDeleteTarget(doc)}
                        aria-label={`Delete document ${doc.id}`}
                        title="Delete document"
                      >
                        <svg className="icon-action__svg icon-action__svg--delete" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M9.75 9.75v6.75M14.25 9.75v6.75M5.25 6.75h13.5M8.25 6.75V5.25A1.5 1.5 0 0 1 9.75 3.75h4.5a1.5 1.5 0 0 1 1.5 1.5v1.5m-9.75 0 .6 10.2A1.5 1.5 0 0 0 8.1 18.75h7.8a1.5 1.5 0 0 0 1.497-1.8l-.597-10.2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {showDocumentModal && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--form" role="dialog" aria-modal="true" aria-label="Document form">
            <div className="modal__header">
              <div>
                <h3>{props.editingDocumentId ? "Edit Document" : "Add Document"}</h3>
                <p className="modal__subtle">
                  {props.editingDocumentId
                    ? "Update the selected document and its ownership details."
                    : "Register a fleet document and its renewal date."}
                </p>
              </div>
              <button className="modal__close" type="button" onClick={closeDocumentModal} aria-label="Close document form">
                ✕
              </button>
            </div>
            <form id="document-form" className="form form--scroll" onSubmit={props.onAddDocument}>
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
              <label>
                Expiry Date
                <input
                  type="date"
                  value={props.docExpiry}
                  onChange={(e) => props.setDocExpiry(e.target.value)}
                />
              </label>
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
                <p className="modal__subtle">Read-only view of the selected document.</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setSelectedDocument(null)} aria-label="Close document details">
                ✕
              </button>
            </div>
            <div className="details-grid">
              <div className="detail-item">
                <span>Owner</span>
                <strong>
                  {selectedDocument.vehicle_id
                    ? `Vehicle • ${vehicleLabelMap[selectedDocument.vehicle_id || ""] || "--"}`
                    : `Driver • ${driverLabelMap[selectedDocument.driver_id || ""] || "--"}`}
                </strong>
              </div>
              <div className="detail-item"><span>Type</span><strong>{selectedDocument.doc_type}</strong></div>
              <div className="detail-item"><span>Number</span><strong>{selectedDocument.doc_number || "--"}</strong></div>
              <div className="detail-item"><span>Expiry</span><strong>{selectedDocument.expiry_date || "--"}</strong></div>
              <div className="detail-item detail-item--full"><span>File URL</span><strong>{selectedDocument.file_url || "--"}</strong></div>
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
  );
}
