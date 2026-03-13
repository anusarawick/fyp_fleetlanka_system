import { FormEvent } from "react";
import { MaintenancePrediction, Vehicle } from "../types";

type MLPredictionsProps = {
  vehicles: Vehicle[];
  mlVehicleId: string;
  setMlVehicleId: (v: string) => void;
  maintenancePredictionMap: Record<string, MaintenancePrediction>;
  maintFeatures: string;
  setMaintFeatures: (v: string) => void;
  fuelFeatures: string;
  setFuelFeatures: (v: string) => void;
  maintResult: string | null;
  fuelResult: string | null;
  loading: boolean;
  onPredictMaintenance: (e: FormEvent) => void;
  onPredictFuel: (e: FormEvent) => void;
  onRunVehicleMaintenanceCheck: (vehicleId: string) => void;
};

export default function MLPredictions(props: MLPredictionsProps) {
  const selectedVehiclePrediction = props.mlVehicleId
    ? props.maintenancePredictionMap[props.mlVehicleId]
    : null;

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
            <div className="result">
              Latest result: {selectedVehiclePrediction.risk_level.toUpperCase()} {" "}
              ({(selectedVehiclePrediction.probability * 100).toFixed(0)}%)
            </div>
          ) : null}
        </section>

        <section className="card">
          <h3>Predict Maintenance</h3>
          <p className="muted">
            Enter features as comma-separated values per row. Example:
            <br />
            <code>10000,200,45,1500,85</code>
          </p>
          <form className="form" onSubmit={props.onPredictMaintenance}>
            <label>
              Features (rows separated by new lines)
              <textarea
                rows={4}
                value={props.maintFeatures}
                onChange={(e) => props.setMaintFeatures(e.target.value)}
                required
              />
            </label>
            <button className="btn" type="submit" disabled={props.loading}>
              {props.loading ? "Predicting..." : "Predict Maintenance"}
            </button>
          </form>
          {props.maintResult ? (
            <div className="result">Prediction: {props.maintResult}</div>
          ) : null}
        </section>

        <section className="card">
          <h3>Predict Fuel</h3>
          <p className="muted">
            Enter features as comma-separated values per row. Example:
            <br />
            <code>120,40,500,10</code>
          </p>
          <form className="form" onSubmit={props.onPredictFuel}>
            <label>
              Features (rows separated by new lines)
              <textarea
                rows={4}
                value={props.fuelFeatures}
                onChange={(e) => props.setFuelFeatures(e.target.value)}
                required
              />
            </label>
            <button className="btn" type="submit" disabled={props.loading}>
              {props.loading ? "Predicting..." : "Predict Fuel"}
            </button>
          </form>
          {props.fuelResult ? (
            <div className="result">Prediction: {props.fuelResult}</div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
