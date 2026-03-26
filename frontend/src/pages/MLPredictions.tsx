import { useMemo } from "react";
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
      <h2>ML Predictions</h2>
      <div className="grid">
        <section className="card">
          <h3>Vehicle Maintenance Check</h3>
          <p className="muted">
            Pick a saved vehicle and run the tuned maintenance model using its stored fleet data.
          </p>
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
          {selectedVehiclePrediction ? (
            <>
              <div className="result">
                Latest result: {selectedVehiclePrediction.risk_level.toUpperCase()}{" "}
                ({(selectedVehiclePrediction.probability * 100).toFixed(0)}%)
              </div>
              {latestPrediction ? (
                <div className="prediction-audit">
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
                  <div className="prediction-audit__changes">
                    <span className="prediction-audit__label">What Changed</span>
                    {predictionChanges.length > 0 ? (
                      <ul className="prediction-audit__list">
                        {predictionChanges.map((change) => (
                          <li key={change}>{change}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">
                        {previousPrediction
                          ? "No tracked feature changes since the previous prediction."
                          : "Run this vehicle at least twice to compare prediction changes over time."}
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </section>
  );
}
