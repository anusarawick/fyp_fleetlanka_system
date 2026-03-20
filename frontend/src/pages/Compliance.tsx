type Document = {
  id: string;
  doc_type: string;
  expiry_date?: string;
};

type MaintenanceRecord = {
  id: string;
  service_type?: string;
  service_date: string;
};

type ComplianceProps = {
  documents: Document[];
  maintenance: MaintenanceRecord[];
};

export default function Compliance(props: ComplianceProps) {
  const now = new Date().getTime();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  function getExpiryStatus(expiryDate?: string) {
    if (!expiryDate) return null;
    const date = new Date(expiryDate).getTime();
    if (date < now) return { label: "Expired", tone: "danger" as const };
    return { label: "Expiring Soon", tone: "warning" as const };
  }

  const expiringDocs = props.documents.filter((d) => {
    if (!d.expiry_date) return false;
    const date = new Date(d.expiry_date).getTime();
    return date <= now + thirtyDays;
  });

  const upcomingMaintenance = props.maintenance.filter((m) => {
    if (!m.service_date) return false;
    const date = new Date(m.service_date).getTime();
    return date <= now + thirtyDays;
  });

  return (
    <section className="section">
      <h2>Compliance Alerts</h2>
      <p className="muted">
        Track renewals and avoid penalties with upcoming deadlines.
      </p>
      <div className="grid">
        <section className="card">
          <h3>Expiring / Expired Documents (30 days)</h3>
          {expiringDocs.length === 0 ? (
            <p className="muted empty">No expiring documents.</p>
          ) : (
            <ul className="list">
              {expiringDocs.map((d) => {
                const expiryStatus = getExpiryStatus(d.expiry_date);
                return (
                  <li key={d.id}>
                    <div className="list__title">{d.doc_type}</div>
                    <div className="list__meta">
                      {d.expiry_date}{" "}
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
        <section className="card">
          <h3>Upcoming Maintenance (30 days)</h3>
          {upcomingMaintenance.length === 0 ? (
            <p className="muted empty">No upcoming maintenance.</p>
          ) : (
            <ul className="list">
              {upcomingMaintenance.map((m) => (
                <li key={m.id}>
                  <div className="list__title">{m.service_type || "Service"}</div>
                  <div className="list__meta">{m.service_date}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
