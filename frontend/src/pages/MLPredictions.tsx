import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  AlertTriangle,
  BatteryCharging,
  CalendarDays,
  Car,
  ChevronDown,
  Download,
  Fuel,
  Gauge,
  RotateCw,
  Search,
  SlidersHorizontal,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { Maintenance, MaintenancePrediction, Vehicle } from "../types";

type MLPredictionsProps = {
  vehicles: Vehicle[];
  maintenance: Maintenance[];
  mlVehicleId: string;
  setMlVehicleId: (v: string) => void;
  maintenancePredictions: MaintenancePrediction[];
  maintenancePredictionMap: Record<string, MaintenancePrediction>;
  loading: boolean;
  onRunVehicleMaintenanceCheck: (vehicleId: string) => Promise<void>;
  onDeleteMaintenancePrediction: (predictionId: string) => Promise<void>;
};

type DateRangeMode = "last7" | "last30" | "custom";
type FeatureTone = "success" | "warning" | "danger" | "info" | "neutral";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function endOfLocalDay(date = new Date()) {
  return startOfLocalDay(date) + DAY_MS - 1;
}

function formatDateInput(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`).getTime();
  return Number.isNaN(parsed) ? undefined : parsed;
}

function monthsSince(value?: string) {
  const parsed = parseDate(value);
  if (parsed === undefined) return undefined;
  const now = new Date();
  const date = new Date(parsed);
  return Math.max(0, (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth());
}

function formatDateTime(value?: string) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(value?: string) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleDateString("en-LK", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRiskLabel(value?: string) {
  if (!value) return "Not recorded";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTextValue(value?: string) {
  if (!value) return "Not recorded";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatNumber(value: unknown, fallback = "Not recorded") {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return number.toLocaleString();
}

function numericFeature(features: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = Number(features[key]);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

function percentUsed(value?: number, total?: number) {
  if (value === undefined || total === undefined || total <= 0) return undefined;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

function percentRemaining(value?: number, total?: number) {
  const used = percentUsed(value, total);
  return used === undefined ? undefined : Math.max(0, Math.min(100, 100 - used));
}

function conditionPercent(value?: string, fallback?: number) {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("poor") || normalized.includes("bad")) return 28;
  if (normalized.includes("fair") || normalized.includes("medium")) return 62;
  if (normalized.includes("good") || normalized.includes("new")) return 86;
  return fallback;
}

function percentTone(percent?: number): FeatureTone {
  if (percent === undefined) return "neutral";
  if (percent >= 75) return "success";
  if (percent >= 45) return "warning";
  return "danger";
}

function dueTone(percent?: number): FeatureTone {
  if (percent === undefined) return "neutral";
  if (percent >= 90) return "danger";
  if (percent >= 70) return "warning";
  return "success";
}

function statusFromTone(tone: FeatureTone) {
  if (tone === "success") return "Good";
  if (tone === "warning") return "Fair";
  if (tone === "danger") return "Poor";
  return "Info";
}

function riskTone(risk?: string): FeatureTone {
  if (risk === "high") return "danger";
  if (risk === "medium") return "warning";
  if (risk === "low") return "success";
  return "neutral";
}

function riskRecommendation(risk?: string) {
  if (risk === "high") return "Schedule inspection and service within 3 days.";
  if (risk === "medium") return "Plan maintenance review within 7 days.";
  if (risk === "low") return "Continue routine monitoring.";
  return "Run a maintenance check to generate a recommendation.";
}

function vehicleLabel(vehicle?: Vehicle | null) {
  if (!vehicle) return "Vehicle not selected";
  return [vehicle.plate_no, vehicle.make, vehicle.model].filter(Boolean).join(" - ");
}

function exportPredictions(rows: Array<{ vehicle: string; predictedAt: string; result: string; risk: string; probability: number }>) {
  const header = ["Vehicle", "Predicted At", "Result", "Risk Level", "Probability"];
  const csvRows = rows.map((row) => [
    row.vehicle,
    row.predictedAt,
    row.result,
    row.risk,
    `${row.probability}%`,
  ]);
  const csv = [header, ...csvRows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "maintenance-predictions.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function MLPredictions(props: MLPredictionsProps) {
  const [vehicleCategory, setVehicleCategory] = useState("all");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleDropdownOpen, setVehicleDropdownOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MaintenancePrediction | null>(null);
  const [showRunAllConfirm, setShowRunAllConfirm] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [dateRangeMode, setDateRangeMode] = useState<DateRangeMode>("last30");
  const [customFrom, setCustomFrom] = useState(formatDateInput(startOfLocalDay() - 30 * DAY_MS));
  const [customTo, setCustomTo] = useState(formatDateInput(startOfLocalDay()));
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const vehicleDropdownRef = useRef<HTMLDivElement | null>(null);
  const today = startOfLocalDay();

  const selectedVehicle = useMemo(
    () => props.vehicles.find((vehicle) => vehicle.id === props.mlVehicleId) || null,
    [props.vehicles, props.mlVehicleId]
  );
  const selectedVehicleHistory = useMemo(() => {
    if (!props.mlVehicleId) return [];
    return props.maintenancePredictions
      .filter((prediction) => prediction.vehicle_id === props.mlVehicleId)
      .sort((a, b) => new Date(b.predicted_at).getTime() - new Date(a.predicted_at).getTime());
  }, [props.maintenancePredictions, props.mlVehicleId]);
  const latestPrediction = selectedVehicleHistory[0] || (props.mlVehicleId ? props.maintenancePredictionMap[props.mlVehicleId] : null);
  const latestInputFeatures = latestPrediction?.input_features || {};
  const latestMaintenance = useMemo(() => {
    if (!props.mlVehicleId) return null;
    return [...props.maintenance]
      .filter((record) => record.vehicle_id === props.mlVehicleId)
      .sort((a, b) => (parseDate(b.service_date) || 0) - (parseDate(a.service_date) || 0))[0] || null;
  }, [props.maintenance, props.mlVehicleId]);
  const probabilityPercent = latestPrediction ? Math.round(latestPrediction.probability * 100) : 0;
  const risk = latestPrediction?.risk_level;

  const vehicleCategories = useMemo(
    () => Array.from(new Set(props.vehicles.map((vehicle) => vehicle.vehicle_type || "Uncategorized"))).sort(),
    [props.vehicles]
  );

  const categoryVehicles = useMemo(
    () => props.vehicles.filter((vehicle) => vehicleCategory === "all" || (vehicle.vehicle_type || "Uncategorized") === vehicleCategory),
    [props.vehicles, vehicleCategory]
  );

  const filteredVehicles = useMemo(() => {
    const query = vehicleSearch.trim().toLowerCase();
    return categoryVehicles.filter((vehicle) => {
      const searchMatches = !query || vehicleLabel(vehicle).toLowerCase().includes(query);
      return searchMatches;
    });
  }, [categoryVehicles, vehicleSearch]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!vehicleDropdownRef.current?.contains(event.target as Node)) {
        setVehicleDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const odometer = selectedVehicle?.odometer_km ?? numericFeature(latestInputFeatures, ["odometer_km", "odometer"]);
  const latestServiceOdometer = selectedVehicle?.last_service_odometer_km ?? latestMaintenance?.odometer_km;
  const latestTyreOdometer = selectedVehicle?.last_tyre_change_odometer_km;
  const latestBrakeOdometer = selectedVehicle?.last_brake_service_odometer_km;
  const kmSinceLastService =
    numericFeature(latestInputFeatures, ["km_since_last_service"]) ??
    (odometer !== undefined && latestServiceOdometer !== undefined ? Math.max(0, odometer - latestServiceOdometer) : undefined);
  const kmSinceLastTyreChange =
    numericFeature(latestInputFeatures, ["km_since_last_tyre_change"]) ??
    (odometer !== undefined && latestTyreOdometer !== undefined ? Math.max(0, odometer - latestTyreOdometer) : undefined);
  const kmSinceLastBrakeService =
    numericFeature(latestInputFeatures, ["km_since_last_brake_service"]) ??
    (odometer !== undefined && latestBrakeOdometer !== undefined ? Math.max(0, odometer - latestBrakeOdometer) : undefined);
  const batteryAgeMonths = numericFeature(latestInputFeatures, ["battery_age_months"]) ?? monthsSince(selectedVehicle?.battery_installed_at);
  const serviceInterval = selectedVehicle?.service_interval_km ?? numericFeature(latestInputFeatures, ["service_interval_km", "service_interval"]);
  const nextServiceDue = selectedVehicle?.next_service_due_km ?? numericFeature(latestInputFeatures, ["next_service_due_km"]);
  const tyreLifeKm = selectedVehicle?.tyre_life_km ?? numericFeature(latestInputFeatures, ["tyre_life_km"]);
  const brakeLifeKm = selectedVehicle?.brake_life_km ?? numericFeature(latestInputFeatures, ["brake_life_km"]);
  const batteryLifeMonths = selectedVehicle?.battery_life_months ?? numericFeature(latestInputFeatures, ["battery_life_months"]);
  const serviceProgressFromElapsed = percentUsed(kmSinceLastService, serviceInterval);
  const serviceProgressFromRatio = numericFeature(latestInputFeatures, ["service_due_ratio", "service_interval_ratio"]);
  const serviceProgress =
    odometer !== undefined && nextServiceDue !== undefined && serviceInterval
      ? Math.max(0, Math.min(100, ((serviceInterval - Math.max(0, nextServiceDue - odometer)) / serviceInterval) * 100))
      : serviceProgressFromElapsed !== undefined
        ? serviceProgressFromElapsed
      : serviceProgressFromRatio !== undefined
        ? Math.min(100, Math.max(0, serviceProgressFromRatio * 100))
        : undefined;
  const tyrePercent = conditionPercent(
    selectedVehicle?.tire_condition,
    numericFeature(latestInputFeatures, ["tire_condition_score", "tyre_condition_score", "tire_health_pct"]) ??
      percentRemaining(kmSinceLastTyreChange, tyreLifeKm)
  );
  const brakePercent = conditionPercent(
    selectedVehicle?.brake_condition,
    numericFeature(latestInputFeatures, ["brake_condition_score", "brake_health_pct"]) ??
      percentRemaining(kmSinceLastBrakeService, brakeLifeKm)
  );
  const batteryPercent = conditionPercent(
    selectedVehicle?.battery_status,
    numericFeature(latestInputFeatures, ["battery_condition_score", "battery_health_pct"]) ??
      percentRemaining(batteryAgeMonths, batteryLifeMonths)
  );
  const fuelEfficiency =
    numericFeature(latestInputFeatures, ["actual_fuel_efficiency_kmpl", "fuel_efficiency_avg_4w", "fuel_efficiency", "recent_fuel_efficiency_avg"]) ??
    selectedVehicle?.recent_fuel_efficiency_avg ??
    selectedVehicle?.fuel_efficiency;
  const expectedEfficiency = selectedVehicle?.expected_kmpl ?? numericFeature(latestInputFeatures, ["expected_kmpl", "target_fuel_efficiency"]);
  const recentTripCount =
    numericFeature(latestInputFeatures, ["trip_count_last_4w", "trip_count_week", "recent_trip_count_30d", "recent_trip_count_7d"]) ??
    selectedVehicle?.recent_trip_count_30d;
  const distanceLast4w = numericFeature(latestInputFeatures, ["distance_last_4w"]);
  const weeklyDistance = numericFeature(latestInputFeatures, ["weekly_distance_km"]);
  const avgDailyDistance =
    numericFeature(latestInputFeatures, ["avg_daily_distance_km", "average_daily_distance_km"]) ??
    (distanceLast4w !== undefined ? distanceLast4w / 28 : undefined) ??
    (weeklyDistance !== undefined ? weeklyDistance / 7 : undefined) ??
    (selectedVehicle?.avg_monthly_km ? selectedVehicle.avg_monthly_km / 30 : undefined);
  const latestTime = latestPrediction ? formatDateTime(latestPrediction.predicted_at) : "No saved prediction";
  const latestMaintenanceType = latestMaintenance?.service_type || latestMaintenance?.event_type || latestMaintenance?.event_category;

  const featureRows = [
    { icon: Gauge, label: "Odometer", value: odometer !== undefined ? `${formatNumber(odometer)} km` : "Not recorded", note: "Total distance", tone: "info" as FeatureTone },
    { icon: CalendarDays, label: "Service Interval Status", value: serviceProgress !== undefined ? `${Math.round(serviceProgress)}% used` : "Not recorded", progress: serviceProgress, badge: serviceProgress !== undefined && serviceProgress >= 90 ? "Overdue" : kmSinceLastService !== undefined ? `${formatNumber(kmSinceLastService)} km` : serviceProgress !== undefined ? "Tracked" : "Missing", tone: dueTone(serviceProgress) },
    { icon: Wrench, label: "Tyre State", value: tyrePercent !== undefined ? `${Math.round(tyrePercent)}%` : selectedVehicle?.tire_condition || "Not recorded", progress: tyrePercent, badge: selectedVehicle?.tire_condition || statusFromTone(percentTone(tyrePercent)), tone: percentTone(tyrePercent) },
    { icon: SlidersHorizontal, label: "Brake State", value: brakePercent !== undefined ? `${Math.round(brakePercent)}%` : selectedVehicle?.brake_condition || "Not recorded", progress: brakePercent, badge: selectedVehicle?.brake_condition || statusFromTone(percentTone(brakePercent)), tone: percentTone(brakePercent) },
    { icon: BatteryCharging, label: "Battery State", value: batteryPercent !== undefined ? `${Math.round(batteryPercent)}%` : selectedVehicle?.battery_status || "Not recorded", progress: batteryPercent, badge: selectedVehicle?.battery_status || statusFromTone(percentTone(batteryPercent)), tone: percentTone(batteryPercent) },
    { icon: Fuel, label: "Fuel Efficiency (km/L)", value: fuelEfficiency !== undefined ? `${Number(fuelEfficiency).toFixed(1)} km/L` : "Not recorded", badge: expectedEfficiency && fuelEfficiency && fuelEfficiency < expectedEfficiency ? "Below Avg" : fuelEfficiency !== undefined ? "Tracked" : undefined, tone: expectedEfficiency && fuelEfficiency && fuelEfficiency < expectedEfficiency ? "warning" as FeatureTone : "info" as FeatureTone },
    { icon: Car, label: "Recent Trip Count", value: recentTripCount !== undefined ? `${Math.round(Number(recentTripCount))} trips` : "Not recorded", badge: recentTripCount !== undefined ? "4 weeks" : undefined, tone: "info" as FeatureTone },
    { icon: Gauge, label: "Avg. Daily Distance", value: avgDailyDistance !== undefined ? `${Math.round(Number(avgDailyDistance))} km` : "Not recorded", badge: avgDailyDistance !== undefined ? "Daily" : undefined, tone: "info" as FeatureTone },
  ];

  const dateWindow = useMemo(() => {
    const endOfToday = today + DAY_MS - 1;
    if (dateRangeMode === "last7") return { start: today - 7 * DAY_MS, end: endOfToday };
    if (dateRangeMode === "last30") return { start: today - 30 * DAY_MS, end: endOfToday };
    return {
      start: customFrom ? startOfLocalDay(new Date(`${customFrom}T00:00:00`)) : Number.NEGATIVE_INFINITY,
      end: customTo ? endOfLocalDay(new Date(`${customTo}T00:00:00`)) : Number.POSITIVE_INFINITY,
    };
  }, [customFrom, customTo, dateRangeMode, today]);

  const vehicleMap = useMemo(
    () => props.vehicles.reduce<Record<string, Vehicle>>((acc, vehicle) => ({ ...acc, [vehicle.id]: vehicle }), {}),
    [props.vehicles]
  );
  const historyRows = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return props.maintenancePredictions
      .map((prediction) => {
        const vehicle = vehicleMap[prediction.vehicle_id];
        return {
          id: prediction.id,
          vehicleId: prediction.vehicle_id,
          vehicle: vehicle ? vehicleLabel(vehicle) : prediction.vehicle_id,
          plate: vehicle?.plate_no || prediction.vehicle_id,
          makeModel: vehicle ? [vehicle.make, vehicle.model].filter(Boolean).join(" - ") || vehicle.vehicle_type || "Not recorded" : "Not recorded",
          predictedAt: prediction.predicted_at,
          result: prediction.prediction === 1 ? "Attention" : "Clear",
          risk: prediction.risk_level,
          probability: Math.round(prediction.probability * 100),
          sortDate: parseDate(prediction.predicted_at) || 0,
        };
      })
      .filter((row) => {
        const searchMatches = !query || row.vehicle.toLowerCase().includes(query) || row.risk.includes(query);
        const riskMatches = riskFilter === "all" || row.risk === riskFilter;
        const dateMatches = row.sortDate >= dateWindow.start && row.sortDate <= dateWindow.end;
        return searchMatches && riskMatches && dateMatches;
      })
      .sort((a, b) => b.sortDate - a.sortDate);
  }, [dateWindow, historySearch, props.maintenancePredictions, riskFilter, vehicleMap]);

  const totalPages = Math.max(1, Math.ceil(historyRows.length / rowsPerPage));
  const currentSafePage = Math.min(currentPage, totalPages);
  const visibleRows = historyRows.slice((currentSafePage - 1) * rowsPerPage, currentSafePage * rowsPerPage);

  async function handleRerunPrediction(vehicleId: string) {
    props.setMlVehicleId(vehicleId);
    await props.onRunVehicleMaintenanceCheck(vehicleId);
  }

  async function confirmRunAllChecks() {
    for (const vehicle of categoryVehicles) {
      await props.onRunVehicleMaintenanceCheck(vehicle.id);
    }
    setShowRunAllConfirm(false);
  }

  async function confirmDeletePrediction() {
    if (!deleteTarget) return;
    try {
      await props.onDeleteMaintenancePrediction(deleteTarget.id);
    } catch {
      return;
    }
    setDeleteTarget(null);
  }

  return (
    <section className="section">
      <section className="admin-page ml-page insights-page insights-page--ml ml-page--redesign">
        <section className="ml-control-card">
          <label className="ml-select-control ml-select-control--compact">
            <span>Category</span>
            <select value={vehicleCategory} onChange={(event) => setVehicleCategory(event.target.value)}>
              <option value="all">All Categories</option>
              {vehicleCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <ChevronDown aria-hidden="true" />
          </label>
          <div className="ml-vehicle-dropdown" ref={vehicleDropdownRef}>
            <button className="ml-vehicle-dropdown__trigger" type="button" onClick={() => setVehicleDropdownOpen((open) => !open)}>
              <span>Select Vehicle</span>
              <strong>{selectedVehicle ? selectedVehicle.plate_no : "Select vehicle"}</strong>
              <ChevronDown aria-hidden="true" />
            </button>
            {vehicleDropdownOpen && (
              <div className="ml-vehicle-dropdown__menu">
                <label className="ml-vehicle-dropdown__search">
                  <Search aria-hidden="true" />
                  <input
                    autoFocus
                    value={vehicleSearch}
                    onChange={(event) => setVehicleSearch(event.target.value)}
                    placeholder="Search by name or number"
                  />
                </label>
                <div className="ml-vehicle-dropdown__list">
                  <button
                    type="button"
                    className={!props.mlVehicleId ? "is-selected" : undefined}
                    onClick={() => {
                      props.setMlVehicleId("");
                      setVehicleDropdownOpen(false);
                    }}
                  >
                    Select vehicle
                  </button>
                  {filteredVehicles.map((vehicle) => (
                    <button
                      type="button"
                      className={props.mlVehicleId === vehicle.id ? "is-selected" : undefined}
                      key={vehicle.id}
                      onClick={() => {
                        props.setMlVehicleId(vehicle.id);
                        setVehicleDropdownOpen(false);
                      }}
                    >
                      {vehicleLabel(vehicle)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button className="ml-run-button" type="button" disabled={props.loading || !props.mlVehicleId} onClick={() => handleRerunPrediction(props.mlVehicleId)}>
            <SlidersHorizontal aria-hidden="true" />
            {props.loading ? "Checking..." : "Run Maintenance Check"}
          </button>
          <button
            className="ml-run-all-button"
            type="button"
            disabled={props.loading || categoryVehicles.length === 0}
            onClick={() => setShowRunAllConfirm(true)}
          >
            <RotateCw aria-hidden="true" />
            Run Checks For All
          </button>
          <div className="ml-last-predicted">
            <CalendarDays aria-hidden="true" />
            <span>Last predicted</span>
            <strong>{latestTime}</strong>
          </div>
        </section>

        <section className="ml-result-grid">
          <article className="ml-board-card ml-prediction-card">
            <div className="ml-card-header">
              <h3>Prediction Result</h3>
              <span className={`ml-risk-badge ml-risk-badge--${risk || "neutral"}`}><AlertTriangle aria-hidden="true" />{formatRiskLabel(risk)}</span>
            </div>
            {selectedVehicle ? (
              <>
                <div className="ml-result-hero">
                  <span className="ml-vehicle-icon"><Car aria-hidden="true" /></span>
                  <div>
                    <strong>{selectedVehicle.plate_no}</strong>
                    <span>{[selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(" ") || selectedVehicle.vehicle_type || "Vehicle details unavailable"}</span>
                  </div>
                </div>
                <div className="ml-risk-summary">
                  <div className="ml-risk-donut" style={{ "--risk-percent": `${probabilityPercent}%` } as CSSProperties}>
                    <div><strong>{probabilityPercent}%</strong><span>{formatRiskLabel(risk)}</span></div>
                  </div>
                  <div className="ml-risk-copy">
                    <span>Risk Level</span>
                    <strong className={`ml-risk-text ml-risk-text--${risk || "neutral"}`}>{formatRiskLabel(risk)}</strong>
                    <span>Recommendation</span>
                    <p>{riskRecommendation(risk)}</p>
                  </div>
                </div>
                <div className={`ml-alert-strip ml-alert-strip--${risk || "neutral"}`}>
                  <AlertTriangle aria-hidden="true" />
                  <div><strong>{risk ? `${formatRiskLabel(risk)} risk detected` : "No prediction available"}</strong><span>{latestPrediction ? "Prediction is derived from the latest saved vehicle and maintenance features." : "Run a maintenance check to generate risk details."}</span></div>
                </div>
                <div className="ml-detail-grid">
                  <div><span>Odometer</span><strong>{odometer !== undefined ? `${formatNumber(odometer)} km` : "Not recorded"}</strong></div>
                  <div><span>Vehicle Type</span><strong>{selectedVehicle.vehicle_type || "Not recorded"}</strong></div>
                  <div><span>Last Prediction</span><strong>{latestPrediction ? formatShortDate(latestPrediction.predicted_at) : "No saved check"}</strong></div>
                  <div><span>Last Service Date</span><strong>{latestMaintenance ? formatShortDate(latestMaintenance.service_date) : "Not recorded"}</strong></div>
                  <div><span>Last Service Type</span><strong>{formatTextValue(latestMaintenanceType)}</strong></div>
                  <div><span>Fuel Efficiency</span><strong>{fuelEfficiency !== undefined ? `${Number(fuelEfficiency).toFixed(1)} km/L` : "Not recorded"}</strong></div>
                </div>
              </>
            ) : (
              <p className="empty">Select a vehicle to review its latest maintenance risk result.</p>
            )}
          </article>

          <article className="ml-board-card ml-feature-card">
            <div className="ml-card-header"><h3>Feature Snapshot</h3></div>
            <div className="ml-feature-list">
              {featureRows.map(({ icon: Icon, ...row }) => (
                <div className="ml-feature-row" key={row.label}>
                  <span className={`ml-feature-icon ml-feature-icon--${row.tone}`}><Icon aria-hidden="true" /></span>
                  <div className="ml-feature-main">
                    <span>{row.label}</span>
                    {row.progress !== undefined ? <i><b style={{ width: `${Math.max(4, Math.min(100, row.progress))}%` }} /></i> : null}
                    {row.note ? <small>{row.note}</small> : null}
                  </div>
                  <strong>{row.value}</strong>
                  {row.badge ? <em className={`ml-feature-badge ml-feature-badge--${row.tone}`}>{row.badge}</em> : null}
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="ml-board-card ml-history-card">
          <div className="ml-card-header"><h3>Prediction History</h3></div>
          <div className="ml-history-controls">
            <label className="ml-history-search"><Search aria-hidden="true" /><input value={historySearch} onChange={(event) => { setHistorySearch(event.target.value); setCurrentPage(1); }} placeholder="Search predictions..." /></label>
            <label className="ml-select-control ml-select-control--compact"><span>Risk</span><select value={riskFilter} onChange={(event) => { setRiskFilter(event.target.value); setCurrentPage(1); }}><option value="all">All Risk Levels</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><ChevronDown aria-hidden="true" /></label>
            <label className="ml-select-control ml-select-control--compact"><span>Range</span><select value={dateRangeMode} onChange={(event) => { setDateRangeMode(event.target.value as DateRangeMode); setCurrentPage(1); }}><option value="last7">Last 7 Days</option><option value="last30">Last 30 Days</option><option value="custom">Custom Range</option></select><CalendarDays aria-hidden="true" /></label>
            <button className="ml-export-button" type="button" onClick={() => exportPredictions(historyRows)}><Download aria-hidden="true" />Export</button>
            <label className="ml-select-control ml-select-control--rows"><span>Rows</span><select value={rowsPerPage} onChange={(event) => { setRowsPerPage(Number(event.target.value)); setCurrentPage(1); }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select><ChevronDown aria-hidden="true" /></label>
          </div>
          {dateRangeMode === "custom" && (
            <div className="ml-custom-range">
              <label><span>From</span><input type="date" value={customFrom} onChange={(event) => { setCustomFrom(event.target.value); setCurrentPage(1); }} /></label>
              <label><span>To</span><input type="date" value={customTo} onChange={(event) => { setCustomTo(event.target.value); setCurrentPage(1); }} /></label>
            </div>
          )}
          {historyRows.length === 0 ? (
            <p className="empty">No prediction history matches the current filters.</p>
          ) : (
            <div className="ml-history-table">
              <div className="ml-history-table__head"><span>Plate</span><span>Make / Model</span><span>Predicted At</span><span>Result</span><span>Risk Level</span><span>Probability</span><span>Actions</span></div>
              {visibleRows.map((row) => (
                <div className="ml-history-table__row" key={row.id}>
                  <span className="ml-history-vehicle" data-label="Plate">{row.plate}</span>
                  <span className="ml-history-model" data-label="Make / Model">{row.makeModel}</span>
                  <span data-label="Predicted At">{formatDateTime(row.predictedAt)}</span>
                  <span data-label="Result"><b className={`ml-result-chip ml-result-chip--${row.result === "Attention" ? "attention" : "clear"}`}>{row.result}</b></span>
                  <span data-label="Risk Level"><b className={`ml-risk-chip ml-risk-chip--${row.risk}`}>{formatRiskLabel(row.risk)}</b></span>
                  <span data-label="Probability">{row.probability}%</span>
                  <span className="ml-history-actions" data-label="Actions">
                    <button className="icon-action" type="button" onClick={() => handleRerunPrediction(row.vehicleId)} disabled={props.loading} aria-label="Run check again" title="Run check again"><RotateCw className="icon-action__svg icon-action__svg--edit" aria-hidden="true" /></button>
                    <button className="icon-action icon-action--danger" type="button" onClick={() => setDeleteTarget(props.maintenancePredictions.find((prediction) => prediction.id === row.id) || null)} disabled={props.loading} aria-label="Delete prediction" title="Delete prediction"><Trash2 className="icon-action__svg icon-action__svg--delete" aria-hidden="true" /></button>
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="ml-history-footer">
            <span>Showing {historyRows.length === 0 ? 0 : (currentSafePage - 1) * rowsPerPage + 1} to {Math.min(currentSafePage * rowsPerPage, historyRows.length)} of {historyRows.length} entries</span>
            <div><span>Page {currentSafePage} of {totalPages}</span><button type="button" disabled={currentSafePage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>Prev</button><button type="button" disabled={currentSafePage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>Next</button></div>
          </div>
        </section>
        {showRunAllConfirm && (
          <div className="modal-backdrop" role="presentation">
            <div className="modal" role="dialog" aria-modal="true" aria-label="Run checks for all vehicles">
              <div className="modal__header">
                <h3>Run Checks For All?</h3>
                <button className="modal__close" type="button" onClick={() => setShowRunAllConfirm(false)} aria-label="Close run all dialog">
                  <X aria-hidden="true" />
                </button>
              </div>
              <p>
                This will run maintenance prediction checks for {categoryVehicles.length} {categoryVehicles.length === 1 ? "vehicle" : "vehicles"} in the current category.
              </p>
              <div className="modal__actions">
                <button className="btn btn--secondary" type="button" onClick={() => setShowRunAllConfirm(false)}>
                  Cancel
                </button>
                <button className="btn btn--primary" type="button" onClick={confirmRunAllChecks} disabled={props.loading}>
                  {props.loading ? "Running..." : "Run Checks"}
                </button>
              </div>
            </div>
          </div>
        )}
        {deleteTarget && (
          <div className="modal-backdrop" role="presentation">
            <div className="modal" role="dialog" aria-modal="true" aria-label="Delete prediction">
              <div className="modal__header">
                <h3>Delete Prediction?</h3>
                <button className="modal__close" type="button" onClick={() => setDeleteTarget(null)} aria-label="Close delete dialog">
                  <X aria-hidden="true" />
                </button>
              </div>
              <p>
                This will remove the saved prediction for {vehicleLabel(vehicleMap[deleteTarget.vehicle_id])} from {formatDateTime(deleteTarget.predicted_at)}.
              </p>
              <div className="modal__actions">
                <button className="btn btn--secondary" type="button" onClick={() => setDeleteTarget(null)}>
                  Cancel
                </button>
                <button className="btn btn--danger" type="button" onClick={confirmDeletePrediction} disabled={props.loading}>
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
