import { useMemo, useState } from "react";
import { BrainCircuit, Car, History } from "lucide-react";
import { MaintenancePrediction, Vehicle } from "../types";

type MLPredictionsProps = {
  vehicles: Vehicle[];
  mlVehicleId: string;
  setMlVehicleId: (v: string) => void;
  maintenancePredictions: MaintenancePrediction[];
  maintenancePredictionMap: Record<string, MaintenancePrediction>;
  loading: boolean;
  onRunVehicleMaintenanceCheck: (vehicleId: string) => void;
};

function formatDateTime(value?: string) {
  if (!value) return "--";
  return new Date(value).toLocaleString("en-LK", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRiskLabel(value?: string) {
  if (!value) return "--";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatFeatureValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "--";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

function formatFeatureLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\bkmh\b/gi, "km/h")
    .replace(/\bkm\b/gi, "km")
    .replace(/\bcc\b/gi, "cc")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function MLPredictions(props: MLPredictionsProps) {
  const [activeTab, setActiveTab] = useState<"run" | "audit">("run");
  const selectedVehiclePrediction = props.mlVehicleId
    ? props.maintenancePredictionMap[props.mlVehicleId]
    : null;
  const selectedVehicleHistory = useMemo(() => {
    if (!props.mlVehicleId) return [];
    return props.maintenancePredictions
      .filter((prediction) => prediction.vehicle_id === props.mlVehicleId)
      .sort((a, b) => new Date(b.predicted_at).getTime() - new Date(a.predicted_at).getTime());
  }, [props.maintenancePredictions, props.mlVehicleId]);
  const latestPrediction = selectedVehicleHistory[0] || null;
  const previousPrediction = selectedVehicleHistory[1] || null;
  const predictionChanges = useMemo(() => {
    if (!latestPrediction || !previousPrediction) return [];

    const changes: string[] = [];
    if (latestPrediction.risk_level !== previousPrediction.risk_level) {
      changes.push(
        `Risk changed from ${formatRiskLabel(previousPrediction.risk_level)} to ${formatRiskLabel(latestPrediction.risk_level)}`
      );
    }

    const probabilityDelta = Math.round((latestPrediction.probability - previousPrediction.probability) * 100);
    if (probabilityDelta !== 0) {
      changes.push(
        `Probability ${probabilityDelta > 0 ? "increased" : "decreased"} by ${Math.abs(probabilityDelta)} points`
      );
    }

    const latestFeatures = latestPrediction.input_features || {};
    const previousFeatures = previousPrediction.input_features || {};
    const featureKeys = Array.from(
      new Set([...Object.keys(latestFeatures), ...Object.keys(previousFeatures)])
    );

    for (const key of featureKeys) {
      const before = previousFeatures[key];
      const after = latestFeatures[key];
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        changes.push(
          `${formatFeatureLabel(key)} changed: ${formatFeatureValue(before)} -> ${formatFeatureValue(after)}`
        );
      }
    }

    return changes;
  }, [latestPrediction, previousPrediction]);

  return (
    <section className="section">
      <section className="admin-page ml-page insights-page insights-page--ml">
        <section className="stats stats--three admin-stats">
          <div className="stat-card stat-card--blue">
            <div className="stat-icon"><Car aria-hidden="true" /></div>
            <div className="stat-value">{props.vehicles.length}</div>
            <div className="stat-label">Tracked Vehicles</div>
            <div className="stat-sub">Ready for maintenance checks</div>
          </div>
          <div className="stat-card stat-card--green">
            <div className="stat-icon"><BrainCircuit aria-hidden="true" /></div>
            <div className="stat-value">{props.maintenancePredictions.length}</div>
            <div className="stat-label">Prediction Runs</div>
            <div className="stat-sub">Stored risk snapshots</div>
          </div>
          <div className="stat-card stat-card--purple">
            <div className="stat-icon"><History aria-hidden="true" /></div>
            <div className="stat-value">{selectedVehicleHistory.length}</div>
            <div className="stat-label">Selected History</div>
            <div className="stat-sub">Previous checks for this vehicle</div>
          </div>
        </section>

        <nav className="admin-tabs" aria-label="ML prediction sections">
          <button
            type="button"
            className={`admin-tab ${activeTab === "run" ? "admin-tab--active" : ""}`}
            onClick={() => setActiveTab("run")}
          >
            Run Check
          </button>
          <button
            type="button"
            className={`admin-tab ${activeTab === "audit" ? "admin-tab--active" : ""}`}
            onClick={() => setActiveTab("audit")}
          >
            Audit Trail
          </button>
        </nav>

        {activeTab === "run" && (
          <div className="ml-workspace-grid">
            <section className="card ml-run-panel">
              <div className="card__header">
                <div>
                  <h3>Vehicle Maintenance Check</h3>
                  <p className="muted admin-card__subtitle">Select a vehicle, run a maintenance risk check, and review the result immediately.</p>
                </div>
              </div>
              <div className="form">
                <label>
                  Vehicle
                  <select
                    value={props.mlVehicleId}
                    onChange={(e) => props.setMlVehicleId(e.target.value)}
                  >
                    <option value="">Select vehicle</option>
                    {props.vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.plate_no} {vehicle.make ? `• ${vehicle.make}` : ""} {vehicle.model ? `• ${vehicle.model}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="btn"
                  type="button"
                  disabled={props.loading || !props.mlVehicleId}
                  onClick={() => props.onRunVehicleMaintenanceCheck(props.mlVehicleId)}
                >
                  {props.loading ? "Running..." : "Run Maintenance Check"}
                </button>
              </div>
            </section>

            <section className="card ml-result-panel">
              <div className="card__header">
                <div>
                  <h3>Latest Result</h3>
              <p className="muted admin-card__subtitle">Latest saved risk level and probability for the selected vehicle.</p>
                </div>
              </div>
              {selectedVehiclePrediction ? (
                <div className="prediction-summary">
                  <div className={`ml-risk-result ml-risk-result--${selectedVehiclePrediction.risk_level}`}>
                    <span>{formatRiskLabel(selectedVehiclePrediction.risk_level)}</span>
                    <strong>{(selectedVehiclePrediction.probability * 100).toFixed(0)}%</strong>
                  </div>
                  {latestPrediction ? (
                    <div className="prediction-audit__meta">
                      <div className="detail-item">
                        <span>Last Predicted</span>
                        <strong>{formatDateTime(latestPrediction.predicted_at)}</strong>
                      </div>
                      <div className="detail-item">
                        <span>Previous Risk</span>
                        <strong>{previousPrediction ? formatRiskLabel(previousPrediction.risk_level) : "No previous run"}</strong>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="empty">Select a vehicle and run a maintenance check to populate the latest result.</p>
              )}
            </section>
          </div>
        )}

        {activeTab === "audit" && (
          <div className="ml-workspace-grid">
            <section className="card insights-panel">
              <div className="card__header">
                <div>
                  <h3>Prediction History</h3>
                  <p className="muted admin-card__subtitle">Recent saved checks for the selected vehicle, newest first.</p>
                </div>
              </div>
              {selectedVehicleHistory.length === 0 ? (
                <p className="empty">No prediction history exists for the selected vehicle yet.</p>
              ) : (
                <ul className="list">
                  {selectedVehicleHistory.slice(0, 6).map((prediction) => (
                    <li key={prediction.id}>
                      <div className="list__title">
                        {formatRiskLabel(prediction.risk_level)} • {(prediction.probability * 100).toFixed(0)}%
                      </div>
                      <div className="list__meta">{formatDateTime(prediction.predicted_at)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card insights-panel">
              <div className="card__header">
                <div>
                  <h3>Risk Movement</h3>
                  <p className="muted admin-card__subtitle">Changes between the latest check and the previous saved result.</p>
                </div>
              </div>
              {latestPrediction ? (
                <div className="prediction-audit">
                  <div className="prediction-audit__changes">
                    <span className="prediction-audit__label">Change Summary</span>
                    {predictionChanges.length > 0 ? (
                      <ul className="prediction-audit__list">
                        {predictionChanges.map((change) => (
                          <li key={change}>{change}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">{previousPrediction ? "No tracked changes." : "Run another prediction to compare changes over time."}</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="empty">Run a check first to build an audit trail.</p>
              )}
            </section>
          </div>
        )}
      </section>
    </section>
  );
}
