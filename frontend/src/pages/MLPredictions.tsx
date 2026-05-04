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
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-LK", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRiskLabel(value?: string) {
  if (!value) return "Not recorded";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatFeatureValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not recorded";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

function formatNumber(value: unknown, fallback = "Not recorded") {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return number.toLocaleString();
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
  const selectedVehicle = useMemo(
    () => props.vehicles.find((vehicle) => vehicle.id === props.mlVehicleId) || null,
    [props.vehicles, props.mlVehicleId]
  );
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
  const latestInputFeatures = latestPrediction?.input_features || {};
  const inputFeatureCount = Object.keys(latestInputFeatures).length;
  const inputReadinessItems = [
    {
      label: "Vehicle Record",
      value: selectedVehicle ? `${selectedVehicle.plate_no} ready` : "Select a vehicle",
    },
    {
      label: "Saved Inputs",
      value: inputFeatureCount > 0 ? `${inputFeatureCount} fields captured` : "No saved input snapshot",
    },
    {
      label: "Last Checked",
      value: latestPrediction ? formatDateTime(latestPrediction.predicted_at) : "No saved check",
    },
  ];
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
          `${formatFeatureLabel(key)} changed from ${formatFeatureValue(before)} to ${formatFeatureValue(after)}`
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
            <div className="stat-label">Vehicles Available</div>
            <div className="stat-sub">Fleet records available for risk checks</div>
          </div>
          <div className="stat-card stat-card--green">
            <div className="stat-icon"><BrainCircuit aria-hidden="true" /></div>
            <div className="stat-value">{props.maintenancePredictions.length}</div>
            <div className="stat-label">Saved Checks</div>
            <div className="stat-sub">Stored maintenance risk snapshots</div>
          </div>
          <div className="stat-card stat-card--purple">
            <div className="stat-icon"><History aria-hidden="true" /></div>
            <div className="stat-value">{selectedVehicleHistory.length}</div>
            <div className="stat-label">Selected Vehicle History</div>
            <div className="stat-sub">Saved checks for the selected vehicle</div>
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
                  <h3>Maintenance Risk Check</h3>
                  <p className="muted admin-card__subtitle">Choose a fleet vehicle and refresh its maintenance risk using the latest saved records.</p>
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
                  {props.loading ? "Checking Vehicle..." : "Run Risk Check"}
                </button>
              </div>
              <div className="ml-readiness">
                <div className="ml-readiness__header">
                  <span>Input Readiness</span>
                  <strong>{selectedVehicle ? selectedVehicle.plate_no : "No vehicle selected"}</strong>
                </div>
                <div className="ml-readiness__grid">
                  {inputReadinessItems.map((item) => (
                    <div key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="card ml-result-panel">
              <div className="card__header">
                <div>
                  <h3>Latest Risk Result</h3>
                  <p className="muted admin-card__subtitle">Most recent saved risk level and probability for the selected vehicle.</p>
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
                        <span>Vehicle</span>
                        <strong>{selectedVehicle ? `${selectedVehicle.plate_no} • ${selectedVehicle.make || "Make not recorded"}` : "Vehicle not selected"}</strong>
                      </div>
                      <div className="detail-item">
                        <span>Last Checked</span>
                        <strong>{formatDateTime(latestPrediction.predicted_at)}</strong>
                      </div>
                      <div className="detail-item">
                        <span>Previous Risk</span>
                        <strong>{previousPrediction ? formatRiskLabel(previousPrediction.risk_level) : "No previous check"}</strong>
                      </div>
                      <div className="detail-item">
                        <span>Odometer</span>
                        <strong>{formatNumber(selectedVehicle?.odometer_km, "No odometer")}</strong>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="empty">{props.mlVehicleId ? "No saved risk result for this vehicle yet." : "Select a vehicle to review its latest maintenance risk result."}</p>
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
                <p className="empty">{props.mlVehicleId ? "No saved checks for this vehicle yet." : "Select a vehicle to view its saved check history."}</p>
              ) : (
                <ul className="list ml-history-list">
                  {selectedVehicleHistory.slice(0, 6).map((prediction) => (
                    <li key={prediction.id}>
                      <div>
                        <div className="list__title">
                          {selectedVehicle?.plate_no || "Selected vehicle"}
                        </div>
                        <div className="list__meta">{formatDateTime(prediction.predicted_at)}</div>
                      </div>
                      <span className={`risk-pill risk-pill--${prediction.risk_level}`}>
                        {formatRiskLabel(prediction.risk_level)} {(prediction.probability * 100).toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card insights-panel">
              <div className="card__header">
                <div>
                  <h3>What Changed Since Last Check</h3>
                  <p className="muted admin-card__subtitle">Differences between the latest saved check and the previous result.</p>
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
                      <p className="muted">{previousPrediction ? "No saved input changes." : "Run another check to compare changes over time."}</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="empty">{props.mlVehicleId ? "Run a check to build an audit trail for this vehicle." : "Select a vehicle to review saved check changes."}</p>
              )}
            </section>
          </div>
        )}
      </section>
    </section>
  );
}
