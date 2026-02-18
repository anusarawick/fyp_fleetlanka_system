import { FormEvent } from "react";

type Vehicle = {
  id: string;
  plate_no: string;
};

type Document = {
  id: string;
  doc_type: string;
  doc_number?: string;
  expiry_date?: string;
};

type DocumentsProps = {
  vehicles: Vehicle[];
  documents: Document[];
  loading: boolean;
  docVehicle: string;
  setDocVehicle: (v: string) => void;
  docType: string;
  setDocType: (v: string) => void;
  docNumber: string;
  setDocNumber: (v: string) => void;
  docExpiry: string;
  setDocExpiry: (v: string) => void;
  onAddDocument: (e: FormEvent) => void;
};

export default function Documents(props: DocumentsProps) {
  return (
    <section className="section">
      <h2>Documents</h2>
      <p className="muted">Track registration, insurance, and renewals.</p>
      <div className="grid">
        <section className="card">
          <h3>Add document</h3>
          <form className="form" onSubmit={props.onAddDocument}>
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
            <label>
              Document type
              <input
                value={props.docType}
                onChange={(e) => props.setDocType(e.target.value)}
                required
              />
            </label>
            <label>
              Document number
              <input
                value={props.docNumber}
                onChange={(e) => props.setDocNumber(e.target.value)}
              />
            </label>
            <label>
              Expiry date
              <input
                type="date"
                value={props.docExpiry}
                onChange={(e) => props.setDocExpiry(e.target.value)}
              />
            </label>
            <button className="btn" type="submit" disabled={props.loading}>
              {props.loading ? "Saving..." : "Add document"}
            </button>
          </form>
        </section>

        <section className="card">
          <h3>Document list</h3>
          {props.documents.length === 0 ? (
            <p className="muted empty">No documents yet.</p>
          ) : (
            <ul className="list">
              {props.documents.map((d) => (
                <li key={d.id}>
                  <div className="list__title">{d.doc_type}</div>
                  <div className="list__meta">
                    {d.doc_number || "No number"}{" "}
                    {d.expiry_date ? `• Exp: ${d.expiry_date}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
