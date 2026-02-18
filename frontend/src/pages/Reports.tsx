type ReportProps = {
  onExportVehicles: () => void;
  onExportDrivers: () => void;
  onExportTrips: () => void;
  onExportFuel: () => void;
  onExportMaintenance: () => void;
  onExportDocuments: () => void;
};

export default function Reports(props: ReportProps) {
  return (
    <section className="section">
      <h2>Reports</h2>
      <p className="muted">
        Export CSV summaries for analysis or submission.
      </p>
      <div className="grid">
        <section className="card">
          <h3>Export Data</h3>
          <div className="quick-actions">
            <button className="btn btn--secondary" onClick={props.onExportVehicles}>
              Export Vehicles
            </button>
            <button className="btn btn--secondary" onClick={props.onExportDrivers}>
              Export Drivers
            </button>
            <button className="btn btn--secondary" onClick={props.onExportTrips}>
              Export Trips
            </button>
            <button className="btn btn--secondary" onClick={props.onExportFuel}>
              Export Fuel Logs
            </button>
            <button
              className="btn btn--secondary"
              onClick={props.onExportMaintenance}
            >
              Export Maintenance
            </button>
            <button
              className="btn btn--secondary"
              onClick={props.onExportDocuments}
            >
              Export Documents
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
