import { FormEvent, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Car,
  CheckCircle2,
  Eye,
  Gauge,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  Wrench,
  type LucideIcon,
} from "lucide-react";

type Vehicle = {
  id: string;
  org_id?: string;
  plate_no: string;
  make?: string;
  model?: string;
  vehicle_type?: string;
  year?: number;
  status?: string;
  mileage?: number;
  odometer_km?: number;
  transmission_type?: string;
  engine_size_cc?: number;
  accident_history_count?: number;
  fuel_efficiency?: number;
  next_service_due_km?: number;
  maintenance_history?: string;
  reported_issues_count?: number;
  tire_condition?: string;
  brake_condition?: string;
  battery_status?: string;
  fuel_type?: string;
  business_type?: string;
  road_condition_primary?: string;
  driver_behavior_profile?: string;
  expected_kmpl?: number;
  typical_load_factor?: number;
  service_interval_km?: number;
  oil_interval_km?: number;
  tyre_life_km?: number;
  brake_life_km?: number;
  battery_life_months?: number;
  fuel_filter_interval_km?: number;
  last_service_odometer_km?: number;
  last_oil_change_odometer_km?: number;
  last_tyre_change_odometer_km?: number;
  last_brake_service_odometer_km?: number;
  last_fuel_filter_change_odometer_km?: number;
  battery_installed_at?: string;
};

type MaintenancePrediction = {
  vehicle_id: string;
  probability: number;
  risk_level: "low" | "medium" | "high";
  predicted_at?: string;
  input_features?: Record<string, unknown>;
};

type ManagementProps = {
  vehicles: Vehicle[];
  maintenancePredictionMap: Record<string, MaintenancePrediction>;
  loading: boolean;
  plateNo: string;
  setPlateNo: (v: string) => void;
  make: string;
  setMake: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  vehicleType: string;
  setVehicleType: (v: string) => void;
  year: string;
  setYear: (v: string) => void;
  vehicleStatus: string;
  setVehicleStatus: (v: string) => void;
  vehicleMileage: string;
  setVehicleMileage: (v: string) => void;
  vehicleOdometer: string;
  setVehicleOdometer: (v: string) => void;
  transmissionType: string;
  setTransmissionType: (v: string) => void;
  engineSizeCc: string;
  setEngineSizeCc: (v: string) => void;
  accidentHistoryCount: string;
  setAccidentHistoryCount: (v: string) => void;
  fuelEfficiency: string;
  setFuelEfficiency: (v: string) => void;
  maintenanceHistory: string;
  setMaintenanceHistory: (v: string) => void;
  reportedIssuesCount: string;
  setReportedIssuesCount: (v: string) => void;
  tireCondition: string;
  setTireCondition: (v: string) => void;
  brakeCondition: string;
  setBrakeCondition: (v: string) => void;
  batteryStatus: string;
  setBatteryStatus: (v: string) => void;
  fuelType: string;
  setFuelType: (v: string) => void;
  businessType: string;
  setBusinessType: (v: string) => void;
  roadConditionPrimary: string;
  setRoadConditionPrimary: (v: string) => void;
  driverBehaviorProfile: string;
  setDriverBehaviorProfile: (v: string) => void;
  expectedKmpl: string;
  setExpectedKmpl: (v: string) => void;
  typicalLoadFactor: string;
  setTypicalLoadFactor: (v: string) => void;
  serviceIntervalKm: string;
  setServiceIntervalKm: (v: string) => void;
  oilIntervalKm: string;
  setOilIntervalKm: (v: string) => void;
  tyreLifeKm: string;
  setTyreLifeKm: (v: string) => void;
  brakeLifeKm: string;
  setBrakeLifeKm: (v: string) => void;
  batteryLifeMonths: string;
  setBatteryLifeMonths: (v: string) => void;
  fuelFilterIntervalKm: string;
  setFuelFilterIntervalKm: (v: string) => void;
  lastServiceOdometerKm: string;
  setLastServiceOdometerKm: (v: string) => void;
  lastOilChangeOdometerKm: string;
  setLastOilChangeOdometerKm: (v: string) => void;
  lastTyreChangeOdometerKm: string;
  setLastTyreChangeOdometerKm: (v: string) => void;
  lastBrakeServiceOdometerKm: string;
  setLastBrakeServiceOdometerKm: (v: string) => void;
  lastFuelFilterChangeOdometerKm: string;
  setLastFuelFilterChangeOdometerKm: (v: string) => void;
  batteryInstalledAt: string;
  setBatteryInstalledAt: (v: string) => void;
  activeTrips: number;
  editingVehicleId: string | null;
  onSaveVehicle: (e: FormEvent) => void;
  onEditVehicle: (vehicle: Vehicle) => void;
  onCancelEdit: () => void;
  onDeleteVehicle: (vehicleId: string) => void;
};

type ManagementIconName = "fleet" | "active" | "maintenance" | "risk";

function ManagementIcon({ name }: { name: ManagementIconName }) {
  const icons: Record<ManagementIconName, LucideIcon> = {
    fleet: Car,
    active: CheckCircle2,
    maintenance: Wrench,
    risk: AlertTriangle,
  };
  const Icon = icons[name];
  return <Icon aria-hidden="true" />;
}

export default function Management(props: ManagementProps) {
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [viewTarget, setViewTarget] = useState<Vehicle | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const filteredVehicles = props.vehicles.filter((vehicle) => {
    if (statusFilter === "all") return true;
    return (vehicle.status || "").toLowerCase() === statusFilter;
  }).filter((vehicle) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return [
      vehicle.plate_no,
      vehicle.make,
      vehicle.model,
      vehicle.vehicle_type,
      vehicle.status,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginatedVehicles = filteredVehicles.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );
  const maintenanceVehicles = props.vehicles.filter((vehicle) => (vehicle.status || "").toLowerCase() === "maintenance");
  const activeVehicles = props.vehicles.filter((vehicle) => (vehicle.status || "").toLowerCase() === "active");
  const inactiveVehicles = props.vehicles.filter((vehicle) => (vehicle.status || "").toLowerCase() === "inactive");
  const flaggedVehicles = Object.values(props.maintenancePredictionMap).filter(
    (prediction) => prediction.risk_level === "medium" || prediction.risk_level === "high"
  );
  const highRiskPredictions = Object.values(props.maintenancePredictionMap).filter(
    (prediction) => prediction.risk_level === "high"
  );
  const dueSoonVehicles = props.vehicles.filter((vehicle) => isDueSoon(props.maintenancePredictionMap[vehicle.id], vehicle));
  const missingMlVehicles = props.vehicles.filter((vehicle) => getMissingMlFields(vehicle).length > 0);
  const incompleteProfileVehicles = props.vehicles.filter((vehicle) => getMissingProfileFields(vehicle).length > 0);
  const riskBreakdown = {
    low: Object.values(props.maintenancePredictionMap).filter((prediction) => prediction.risk_level === "low").length,
    medium: Object.values(props.maintenancePredictionMap).filter((prediction) => prediction.risk_level === "medium").length,
    high: Object.values(props.maintenancePredictionMap).filter((prediction) => prediction.risk_level === "high").length,
  };
  const riskTotal = riskBreakdown.low + riskBreakdown.medium + riskBreakdown.high;
  const riskLowPercent = riskTotal ? Math.round((riskBreakdown.low / riskTotal) * 100) : 0;
  const riskMediumPercent = riskTotal ? Math.round((riskBreakdown.medium / riskTotal) * 100) : 0;
  const riskHighPercent = riskTotal ? Math.max(0, 100 - riskLowPercent - riskMediumPercent) : 0;
  const riskDonutStyle = {
    background: riskTotal
      ? `conic-gradient(#16a34a 0 ${riskLowPercent}%, #f97316 ${riskLowPercent}% ${riskLowPercent + riskMediumPercent}%, #dc2626 ${riskLowPercent + riskMediumPercent}% 100%)`
      : "conic-gradient(#e5ebf0 0 100%)",
  };
  const attentionVehicles = buildAttentionQueue();

  useEffect(() => {
    if (!props.editingVehicleId && !props.loading) {
      setShowVehicleModal(false);
    }
  }, [props.editingVehicleId, props.loading]);

  useEffect(() => {
    setPage(1);
  }, [rowsPerPage, statusFilter, searchTerm, props.vehicles.length]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    await props.onDeleteVehicle(deleteTarget.id);
    setDeleteTarget(null);
  }

  function openCreateModal() {
    props.onCancelEdit();
    setShowVehicleModal(true);
  }

  function openEditModal(vehicle: Vehicle) {
    props.onEditVehicle(vehicle);
    setShowVehicleModal(true);
  }

  async function handleVehicleSubmit(e: FormEvent) {
    await props.onSaveVehicle(e);
  }

  function closeVehicleModal() {
    props.onCancelEdit();
    setShowVehicleModal(false);
  }

  function handleMileageChange(nextMileage: string) {
    props.setVehicleMileage(nextMileage);
    if (!props.editingVehicleId) {
      const shouldSyncOdometer =
        props.vehicleOdometer.trim() === "" || props.vehicleOdometer === props.vehicleMileage;
      if (shouldSyncOdometer) {
        props.setVehicleOdometer(nextMileage);
      }
    }
  }

  function maintenanceToggleEnabled() {
    return props.vehicleStatus === "maintenance";
  }

  function activeToggleEnabled() {
    return props.vehicleStatus === "active";
  }

  function handleVehicleActiveToggle(checked: boolean) {
    if (maintenanceToggleEnabled()) return;
    props.setVehicleStatus(checked ? "active" : "inactive");
  }

  function handleVehicleMaintenanceToggle(checked: boolean) {
    if (checked) {
      props.setVehicleStatus("maintenance");
      return;
    }
    if (props.vehicleStatus === "maintenance") {
      props.setVehicleStatus("inactive");
    }
  }

  function formatRiskLabel(level?: "low" | "medium" | "high") {
    if (!level) return "Needs check";
    return `${level.charAt(0).toUpperCase()}${level.slice(1)} risk`;
  }

  function formatMakeModel(vehicle: Vehicle) {
    const parts = [vehicle.make, vehicle.model].filter((value) => value && value.trim().length > 0);
    return parts.length ? parts.join(" ") : "--";
  }

  function formatNumber(value?: number | string) {
    if (value === undefined || value === null || value === "") return "--";
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "--";
    return parsed.toLocaleString();
  }

  function formatOdometer(value?: number | string) {
    const formatted = formatNumber(value);
    return formatted === "--" ? "--" : `${formatted} km`;
  }

  function formatReadable(value?: string) {
    if (!value) return "Not recorded";
    return value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function getFeatureNumber(prediction: MaintenancePrediction | undefined, key: string, fallback = 0) {
    const raw = prediction?.input_features?.[key];
    const parsed = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function highestDueRatio(prediction: MaintenancePrediction | undefined, vehicle?: Vehicle) {
    const ratios = [
      getFeatureNumber(prediction, "service_due_ratio", ratioFromVehicle(vehicle?.odometer_km, vehicle?.last_service_odometer_km, vehicle?.service_interval_km)),
      getFeatureNumber(prediction, "oil_due_ratio", ratioFromVehicle(vehicle?.odometer_km, vehicle?.last_oil_change_odometer_km, vehicle?.oil_interval_km)),
      getFeatureNumber(prediction, "tyre_wear_ratio", ratioFromVehicle(vehicle?.odometer_km, vehicle?.last_tyre_change_odometer_km, vehicle?.tyre_life_km)),
      getFeatureNumber(prediction, "brake_wear_ratio", ratioFromVehicle(vehicle?.odometer_km, vehicle?.last_brake_service_odometer_km, vehicle?.brake_life_km)),
      getFeatureNumber(prediction, "fuel_filter_due_ratio", ratioFromVehicle(vehicle?.odometer_km, vehicle?.last_fuel_filter_change_odometer_km, vehicle?.fuel_filter_interval_km)),
    ];
    return Math.max(...ratios.filter(Number.isFinite), 0);
  }

  function ratioFromVehicle(current?: number, last?: number, interval?: number) {
    if (!current || !last || !interval) return 0;
    return Math.max(0, (Number(current) - Number(last)) / Number(interval));
  }

  function isDueSoon(prediction: MaintenancePrediction | undefined, vehicle?: Vehicle) {
    if (highestDueRatio(prediction, vehicle) >= 0.85) return true;
    if (vehicle?.next_service_due_km && vehicle?.odometer_km) {
      return Number(vehicle.next_service_due_km) - Number(vehicle.odometer_km) <= 1200;
    }
    return false;
  }

  function riskTone(level?: "low" | "medium" | "high") {
    return level ? `risk-pill--${level}` : "risk-pill--neutral";
  }

  function statusTone(status?: string) {
    const normalized = (status || "").toLowerCase();
    if (normalized === "active") return "status-badge--success";
    if (normalized === "maintenance") return "status-badge--warning";
    if (normalized === "inactive") return "status-badge--danger";
    return "status-badge--info";
  }

  function formatVehicleStatus(status?: string) {
    return status ? formatReadable(status) : "--";
  }

  function isBlankValue(value: unknown) {
    return value === undefined || value === null || value === "";
  }

  function getMissingMlFields(vehicle: Vehicle) {
    const fields: Array<[keyof Vehicle, string]> = [
      ["odometer_km", "odometer"],
      ["transmission_type", "transmission"],
      ["engine_size_cc", "engine size"],
      ["expected_kmpl", "expected km/l"],
      ["service_interval_km", "service interval"],
      ["oil_interval_km", "oil interval"],
      ["tyre_life_km", "tyre life"],
      ["brake_life_km", "brake life"],
      ["fuel_filter_interval_km", "fuel filter interval"],
      ["last_service_odometer_km", "last service odometer"],
    ];
    return fields.filter(([key]) => isBlankValue(vehicle[key])).map(([, label]) => label);
  }

  function getMissingProfileFields(vehicle: Vehicle) {
    const fields: Array<[keyof Vehicle, string]> = [
      ["vehicle_type", "type"],
      ["fuel_type", "fuel type"],
      ["business_type", "business type"],
      ["road_condition_primary", "road condition"],
      ["driver_behavior_profile", "driver behavior"],
      ["next_service_due_km", "next service due"],
    ];
    return fields.filter(([key]) => isBlankValue(vehicle[key])).map(([, label]) => label);
  }

  function getServiceDueText(vehicle: Vehicle, prediction?: MaintenancePrediction) {
    const currentKm = typeof vehicle.odometer_km === "number" ? vehicle.odometer_km : vehicle.mileage;
    if (typeof vehicle.next_service_due_km === "number" && typeof currentKm === "number") {
      const remaining = vehicle.next_service_due_km - currentKm;
      if (remaining <= 0) return `Overdue by ${Math.abs(Math.round(remaining)).toLocaleString()} km`;
      return `${Math.round(remaining).toLocaleString()} km until service`;
    }
    const ratio = highestDueRatio(prediction, vehicle);
    if (ratio >= 1) return "Component service overdue";
    if (ratio >= 0.85) return "Component service due soon";
    return "Service timing needs review";
  }

  function dueSeverity(vehicle: Vehicle, prediction?: MaintenancePrediction) {
    const currentKm = typeof vehicle.odometer_km === "number" ? vehicle.odometer_km : vehicle.mileage;
    if (typeof vehicle.next_service_due_km === "number" && typeof currentKm === "number") {
      return vehicle.next_service_due_km - currentKm <= 0 ? "high" : "medium";
    }
    return highestDueRatio(prediction, vehicle) >= 1 ? "high" : "medium";
  }

  function buildAttentionQueue() {
    const byVehicle = new Map<string, { vehicle: Vehicle; reason: string; tone: "high" | "medium" | "low"; priority: number }>();
    props.vehicles.forEach((vehicle) => {
      const prediction = props.maintenancePredictionMap[vehicle.id];
      if (prediction?.risk_level === "high") {
        byVehicle.set(vehicle.id, {
          vehicle,
          reason: `${Math.round(prediction.probability * 100)}% maintenance risk`,
          tone: "high",
          priority: 0,
        });
        return;
      }
      if (isDueSoon(prediction, vehicle)) {
        byVehicle.set(vehicle.id, {
          vehicle,
          reason: getServiceDueText(vehicle, prediction),
          tone: dueSeverity(vehicle, prediction),
          priority: 1,
        });
        return;
      }
      const missingProfile = getMissingProfileFields(vehicle);
      if (missingProfile.length > 0) {
        byVehicle.set(vehicle.id, {
          vehicle,
          reason: `${missingProfile[0]} missing`,
          tone: "medium",
          priority: 2,
        });
      }
    });
    return [...byVehicle.values()]
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        const aRisk = props.maintenancePredictionMap[a.vehicle.id]?.probability || 0;
        const bRisk = props.maintenancePredictionMap[b.vehicle.id]?.probability || 0;
        return bRisk - aRisk;
      })
      .slice(0, 5);
  }

  function formatShortDate(value?: string) {
    if (!value) return "Not recorded";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Not recorded";
    return parsed.toLocaleDateString();
  }

  function predictionFor(vehicle?: Vehicle | null) {
    if (!vehicle) return undefined;
    return props.maintenancePredictionMap[vehicle.id];
  }

  function getRiskReason(vehicle: Vehicle, prediction?: MaintenancePrediction) {
    const componentSignals = componentRows(vehicle, prediction)
      .sort((a, b) => b.ratio - a.ratio);
    const strongest = componentSignals[0];
    if (strongest && strongest.ratio >= 1) {
      return `${strongest.label} is past its service limit`;
    }
    if (strongest && strongest.ratio >= 0.85) {
      return `${strongest.label} is close to its service limit`;
    }
    const recentRepairs = getFeatureNumber(prediction, "repair_events_last_24w");
    if (recentRepairs > 0) {
      return `${formatNumber(recentRepairs)} repair event${recentRepairs === 1 ? "" : "s"} in recent history`;
    }
    const stress = getFeatureNumber(prediction, "vehicle_stress_score");
    if (stress >= 0.7) {
      return "Heavy usage pattern needs closer review";
    }
    return "Review service history and usage profile";
  }

  function getRiskSummary(vehicle: Vehicle, prediction?: MaintenancePrediction) {
    if (!prediction) return "No maintenance risk result is available yet for this vehicle.";
    const reason = getRiskReason(vehicle, prediction);
    const probability = Math.round(prediction.probability * 100);
    return `${probability}% maintenance risk. ${reason}.`;
  }

  function componentRows(vehicle: Vehicle, prediction?: MaintenancePrediction) {
    return [
      ["Service", "service_due_ratio", vehicle.last_service_odometer_km, vehicle.service_interval_km],
      ["Oil", "oil_due_ratio", vehicle.last_oil_change_odometer_km, vehicle.oil_interval_km],
      ["Tyres", "tyre_wear_ratio", vehicle.last_tyre_change_odometer_km, vehicle.tyre_life_km],
      ["Brakes", "brake_wear_ratio", vehicle.last_brake_service_odometer_km, vehicle.brake_life_km],
      ["Fuel filter", "fuel_filter_due_ratio", vehicle.last_fuel_filter_change_odometer_km, vehicle.fuel_filter_interval_km],
    ].map(([label, featureKey, lastOdometer, interval]) => {
      const ratio = getFeatureNumber(
        prediction,
        featureKey as string,
        ratioFromVehicle(vehicle.odometer_km, lastOdometer as number | undefined, interval as number | undefined)
      );
      return { label: label as string, ratio, lastOdometer, interval };
    });
  }

  return (
    <section className="section">
      <section className="admin-page fleet-page">
        <section className="dashboard-kpis fleet-kpi-grid" aria-label="Fleet management summary">
          <article className="dashboard-kpi-card dashboard-kpi-card--teal fleet-kpi-card">
            <span className="dashboard-kpi-card__icon"><ManagementIcon name="fleet" /></span>
            <div>
              <span className="dashboard-kpi-card__label">Total Vehicles</span>
              <strong>{props.vehicles.length}</strong>
              <small className="dashboard-trend">{props.activeTrips} active trip{props.activeTrips === 1 ? "" : "s"} using the fleet</small>
            </div>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card--green fleet-kpi-card">
            <span className="dashboard-kpi-card__icon"><ManagementIcon name="active" /></span>
            <div>
              <span className="dashboard-kpi-card__label">Active</span>
              <strong>{activeVehicles.length}</strong>
              <small className="dashboard-trend dashboard-trend--positive">{inactiveVehicles.length} inactive record{inactiveVehicles.length === 1 ? "" : "s"}</small>
            </div>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card--orange fleet-kpi-card">
            <span className="dashboard-kpi-card__icon"><ManagementIcon name="maintenance" /></span>
            <div>
              <span className="dashboard-kpi-card__label">In Maintenance</span>
              <strong>{maintenanceVehicles.length}</strong>
              <small className="dashboard-trend dashboard-trend--warning">{dueSoonVehicles.length} due or near due</small>
            </div>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card--red fleet-kpi-card">
            <span className="dashboard-kpi-card__icon"><ManagementIcon name="risk" /></span>
            <div>
              <span className="dashboard-kpi-card__label">High Risk</span>
              <strong>{highRiskPredictions.length}</strong>
              <small className="dashboard-trend dashboard-trend--danger">{flaggedVehicles.length} medium/high risk</small>
            </div>
          </article>
        </section>

        <div className="fleet-workspace">
          <section className="fleet-board-card fleet-register-card">
            <div className="fleet-card-header">
              <h3>Vehicle Register</h3>
              <button className="fleet-table-action" type="button" onClick={openCreateModal}>
                <Plus aria-hidden="true" />
                Add Vehicle
              </button>
            </div>

            {props.vehicles.length === 0 ? (
              <div className="fleet-empty-state">
                <Car aria-hidden="true" />
                <div>
                  <strong>No vehicles added yet</strong>
                  <span>Add the first fleet record to start tracking readiness.</span>
                </div>
              </div>
            ) : (
              <>
                <div className="fleet-table-controls">
                  <label className="fleet-search-control">
                    <Search aria-hidden="true" />
                    <input
                      type="search"
                      placeholder="Search by plate, make, or model..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </label>
                  <label className="fleet-select-control">
                    <span>Status</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                  <label className="fleet-select-control fleet-select-control--rows">
                    <span>Rows</span>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => setRowsPerPage(Number(e.target.value))}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                </div>
                {filteredVehicles.length === 0 ? (
                  <div className="fleet-empty-state">
                    <Search aria-hidden="true" />
                    <div>
                      <strong>No vehicles match the filters</strong>
                      <span>Adjust search or status to see more records.</span>
                    </div>
                  </div>
                ) : (
                  <div className="table management-table">
                    <div className="table__head management-table__head">
                      <span>Plate</span>
                      <span>Make / Model</span>
                      <span>Type</span>
                      <span>Odometer</span>
                      <span>Maintenance Risk</span>
                      <span>Status</span>
                      <span>Actions</span>
                    </div>
                    {paginatedVehicles.map((v) => {
                      const latestPrediction = props.maintenancePredictionMap[v.id];
                      return (
                        <div className="table__row management-table__row management-table__row--vehicles" key={v.id}>
                          <span className="management-table__cell management-table__cell--plate" data-label="Plate">{v.plate_no}</span>
                          <span className="management-table__cell" data-label="Make / Model">{formatMakeModel(v)}</span>
                          <span className="management-table__cell" data-label="Type">{v.vehicle_type || "--"}</span>
                          <span className="management-table__cell management-table__cell--odometer" data-label="Odometer">
                            {formatOdometer(v.odometer_km)}
                          </span>
                          <span className="management-table__cell management-table__cell--risk" data-label="Maintenance Risk">
                            {latestPrediction ? (
                              <span className={`risk-pill ${riskTone(latestPrediction.risk_level)}`}>
                                {formatRiskLabel(latestPrediction.risk_level)}
                                <strong>{Math.round(latestPrediction.probability * 100)}%</strong>
                              </span>
                            ) : (
                              <span className="risk-pill risk-pill--neutral">Needs check</span>
                            )}
                          </span>
                          <span className="management-table__cell management-table__cell--status" data-label="Status">
                            {v.status ? (
                              <span className={`status-badge ${statusTone(v.status)}`}>
                                {formatVehicleStatus(v.status)}
                              </span>
                            ) : (
                              <span className="muted">--</span>
                            )}
                          </span>
                          <span className="table__actions management-table__actions" data-label="Actions">
                            <button
                              className="icon-action"
                              type="button"
                              onClick={() => setViewTarget(v)}
                              aria-label={`View ${v.plate_no}`}
                              title="View vehicle"
                            >
                              <Eye className="icon-action__svg icon-action__svg--view" aria-hidden="true" />
                            </button>
                            <button
                              className="icon-action"
                              type="button"
                              onClick={() => openEditModal(v)}
                              aria-label={`Edit ${v.plate_no}`}
                              title="Edit vehicle"
                            >
                              <Pencil className="icon-action__svg icon-action__svg--edit" aria-hidden="true" />
                            </button>
                            <button
                              className="icon-action icon-action--danger"
                              type="button"
                              onClick={() => setDeleteTarget(v)}
                              disabled={props.loading}
                              aria-label={`Delete ${v.plate_no}`}
                              title="Delete vehicle"
                            >
                              <Trash2 className="icon-action__svg icon-action__svg--delete" aria-hidden="true" />
                            </button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="fleet-table-footer">
                  <span>Showing {filteredVehicles.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredVehicles.length)} of {filteredVehicles.length} vehicles</span>
                  <div>
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Prev
                    </button>
                    <strong>{currentPage}</strong>
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>

          <aside className="fleet-readiness-column" aria-label="Vehicle readiness">
            <section className="fleet-board-card fleet-readiness-card">
              <div className="fleet-card-header fleet-card-header--compact">
                <h3>Vehicle Readiness</h3>
              </div>
              <div className="fleet-readiness-list">
                <button type="button" className="fleet-readiness-item" onClick={() => missingMlVehicles[0] && setViewTarget(missingMlVehicles[0])}>
                  <span className="fleet-readiness-item__icon fleet-readiness-item__icon--danger"><AlertTriangle aria-hidden="true" /></span>
                  <span>
                    <strong>Missing ML Fields</strong>
                    <b>{missingMlVehicles.length}</b>
                    <small>{missingMlVehicles.length ? `${missingMlVehicles.slice(0, 3).map((vehicle) => vehicle.plate_no).join(", ")}${missingMlVehicles.length > 3 ? "..." : ""}` : "All ML profile inputs are recorded"}</small>
                  </span>
                </button>
                <button type="button" className="fleet-readiness-item" onClick={() => dueSoonVehicles[0] && setViewTarget(dueSoonVehicles[0])}>
                  <span className="fleet-readiness-item__icon fleet-readiness-item__icon--warning"><Wrench aria-hidden="true" /></span>
                  <span>
                    <strong>Upcoming Service Due</strong>
                    <b>{dueSoonVehicles.length}</b>
                    <small>{dueSoonVehicles.length ? `${dueSoonVehicles.slice(0, 3).map((vehicle) => vehicle.plate_no).join(", ")}${dueSoonVehicles.length > 3 ? "..." : ""}` : "No vehicles are near service limits"}</small>
                  </span>
                </button>
                <button type="button" className="fleet-readiness-item" onClick={() => incompleteProfileVehicles[0] && setViewTarget(incompleteProfileVehicles[0])}>
                  <span className="fleet-readiness-item__icon fleet-readiness-item__icon--info"><Settings2 aria-hidden="true" /></span>
                  <span>
                    <strong>Profile Completion Needed</strong>
                    <b>{incompleteProfileVehicles.length}</b>
                    <small>{incompleteProfileVehicles.length ? `${incompleteProfileVehicles.slice(0, 3).map((vehicle) => vehicle.plate_no).join(", ")}${incompleteProfileVehicles.length > 3 ? "..." : ""}` : "Core profile details are complete"}</small>
                  </span>
                </button>
              </div>
            </section>

            <section className="fleet-board-card fleet-risk-breakdown-card">
              <div className="fleet-card-header fleet-card-header--compact">
                <h3>Maintenance Risk Breakdown</h3>
              </div>
              <div className="fleet-risk-breakdown">
                <div className="fleet-risk-donut" style={riskDonutStyle} aria-label={`${riskTotal} maintenance risk predictions`}>
                  <span><strong>{riskTotal}</strong><small>Total</small></span>
                </div>
                <div className="fleet-risk-list">
                  <div><span><i className="dashboard-dot dashboard-dot--success" />Low</span><strong>{riskBreakdown.low} ({riskLowPercent}%)</strong></div>
                  <div><span><i className="dashboard-dot dashboard-dot--warning" />Medium</span><strong>{riskBreakdown.medium} ({riskMediumPercent}%)</strong></div>
                  <div><span><i className="dashboard-dot dashboard-dot--danger" />High</span><strong>{riskBreakdown.high} ({riskHighPercent}%)</strong></div>
                </div>
              </div>
            </section>

            <section className="fleet-board-card fleet-attention-card">
              <div className="fleet-card-header fleet-card-header--compact">
                <h3>Vehicles Needing Attention</h3>
              </div>
              {attentionVehicles.length === 0 ? (
                <div className="fleet-empty-state fleet-empty-state--compact">
                  <CheckCircle2 aria-hidden="true" />
                  <div>
                    <strong>No priority vehicles</strong>
                    <span>Current fleet records are clear.</span>
                  </div>
                </div>
              ) : (
                <div className="fleet-attention-list">
                  {attentionVehicles.map(({ vehicle, reason, tone }) => (
                    <button type="button" key={vehicle.id} onClick={() => setViewTarget(vehicle)}>
                      <strong>{vehicle.plate_no}</strong>
                      <span>{reason}</span>
                      <em className={`status-badge ${tone === "high" ? "status-badge--danger" : tone === "medium" ? "status-badge--warning" : "status-badge--success"}`}>
                        {tone}
                      </em>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>

      {showVehicleModal && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--wide modal--form" role="dialog" aria-modal="true" aria-label="Vehicle form">
            <div className="modal__header">
              <div>
                <h3>{props.editingVehicleId ? "Edit Vehicle" : "Add Vehicle"}</h3>
                <p className="modal__subtle">
                  {props.editingVehicleId ? "Update fleet details in one place." : "Create a vehicle record for fleet operations."}
                </p>
              </div>
              <button className="modal__close" type="button" onClick={closeVehicleModal} aria-label="Close vehicle form">
                ✕
              </button>
            </div>
            <form id="vehicle-form" className="form form--two-col form--scroll vehicle-form" onSubmit={handleVehicleSubmit}>
              <div className="form-section-title">
                <Car aria-hidden="true" />
                <div>
                  <h4>Vehicle Details</h4>
                  <p>Core record used across trips, documents, fuel, and maintenance workflows.</p>
                </div>
              </div>
              <label>
                Plate Number
                <input
                  placeholder="e.g., WP CAB-1234"
                  value={props.plateNo}
                  onChange={(e) => props.setPlateNo(e.target.value)}
                  required
                />
              </label>
              <label>
                Make
                <input
                  placeholder="e.g., Toyota"
                  value={props.make}
                  onChange={(e) => props.setMake(e.target.value)}
                />
              </label>
              <label>
                Model
                <input
                  placeholder="e.g., Prius"
                  value={props.model}
                  onChange={(e) => props.setModel(e.target.value)}
                />
              </label>
              <label>
                Vehicle Type
                <select
                  value={props.vehicleType}
                  onChange={(e) => props.setVehicleType(e.target.value)}
                >
                  <option value="">Select type</option>
                  <option value="Car">Car</option>
                  <option value="SUV">SUV</option>
                  <option value="Truck">Truck</option>
                  <option value="Bus">Bus</option>
                  <option value="Motorcycle">Motorcycle</option>
                  <option value="Van">Van</option>
                  <option value="Pickup">Pickup</option>
                </select>
              </label>
              <label>
                Year
                <input
                  type="number"
                  placeholder="e.g., 2022"
                  value={props.year}
                  onChange={(e) => props.setYear(e.target.value)}
                />
              </label>
              <label>
                Mileage (km)
                <input
                  type="number"
                  placeholder="e.g., 120000"
                  value={props.vehicleMileage}
                  onChange={(e) => handleMileageChange(e.target.value)}
                />
              </label>
              {props.editingVehicleId && (
                <label>
                  Latest Odometer (km)
                  <input
                    type="number"
                    placeholder="e.g., 125000"
                    value={props.vehicleOdometer}
                    onChange={(e) => props.setVehicleOdometer(e.target.value)}
                  />
                </label>
              )}
              <label>
                Transmission Type
                <select value={props.transmissionType} onChange={(e) => props.setTransmissionType(e.target.value)}>
                  <option value="">Select transmission</option>
                  <option value="Automatic">Automatic</option>
                  <option value="Manual">Manual</option>
                </select>
              </label>
              <label>
                Engine Size (cc)
                <input
                  type="number"
                  placeholder="e.g., 1500"
                  value={props.engineSizeCc}
                  onChange={(e) => props.setEngineSizeCc(e.target.value)}
                />
              </label>
              <div className="form-section-title">
                <Activity aria-hidden="true" />
                <div>
                  <h4>Usage Profile</h4>
                  <p>How this vehicle is normally used: work type, roads, load, and expected efficiency.</p>
                </div>
              </div>
              <label>
                Fuel Type
                <select value={props.fuelType} onChange={(e) => props.setFuelType(e.target.value)}>
                  <option value="">Select fuel type</option>
                  <option value="petrol">Petrol</option>
                  <option value="diesel">Diesel</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="hybrid_petrol">Hybrid Petrol</option>
                  <option value="electric">Electric</option>
                </select>
              </label>
              <label>
                Business Type
                <select value={props.businessType} onChange={(e) => props.setBusinessType(e.target.value)}>
                  <option value="">Select business type</option>
                  <option value="delivery">Delivery</option>
                  <option value="staff_transport">Staff Transport</option>
                  <option value="field_service">Field Service</option>
                  <option value="passenger_transport">Passenger Transport</option>
                  <option value="mixed_operations">Mixed Operations</option>
                </select>
              </label>
              <label>
                Road Condition
                <select value={props.roadConditionPrimary} onChange={(e) => props.setRoadConditionPrimary(e.target.value)}>
                  <option value="">Select condition</option>
                  <option value="urban">Urban</option>
                  <option value="highway">Highway</option>
                  <option value="rural">Rural</option>
                  <option value="estate_roads">Estate Roads</option>
                  <option value="mixed">Mixed</option>
                </select>
              </label>
              <label>
                Driver Behavior
                <select value={props.driverBehaviorProfile} onChange={(e) => props.setDriverBehaviorProfile(e.target.value)}>
                  <option value="">Select behavior</option>
                  <option value="safe">Safe</option>
                  <option value="normal">Normal</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </label>
              <label>
                Expected km/l
                <input type="number" step="0.1" value={props.expectedKmpl} onChange={(e) => props.setExpectedKmpl(e.target.value)} />
              </label>
              <label>
                Typical Load Factor
                <input type="number" step="0.01" placeholder="e.g., 1.0" value={props.typicalLoadFactor} onChange={(e) => props.setTypicalLoadFactor(e.target.value)} />
              </label>
              <div className="form-section-title">
                <CheckCircle2 aria-hidden="true" />
                <div>
                  <h4>Optional Condition Notes</h4>
                  <p>Useful workshop notes when a full service interval record is not yet available.</p>
                </div>
              </div>
              <label>
                Accident History Count
                <input
                  type="number"
                  min="0"
                  value={props.accidentHistoryCount}
                  onChange={(e) => props.setAccidentHistoryCount(e.target.value)}
                />
              </label>
              <label>
                Fuel Efficiency
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 12.5"
                  value={props.fuelEfficiency}
                  onChange={(e) => props.setFuelEfficiency(e.target.value)}
                />
              </label>
              <label>
                Maintenance History
                <select value={props.maintenanceHistory} onChange={(e) => props.setMaintenanceHistory(e.target.value)}>
                  <option value="">Select history</option>
                  <option value="Good">Good</option>
                  <option value="Average">Average</option>
                  <option value="Poor">Poor</option>
                </select>
              </label>
              <label>
                Reported Issues Count
                <input
                  type="number"
                  min="0"
                  value={props.reportedIssuesCount}
                  onChange={(e) => props.setReportedIssuesCount(e.target.value)}
                />
              </label>
              <label>
                Tire Condition
                <select value={props.tireCondition} onChange={(e) => props.setTireCondition(e.target.value)}>
                  <option value="">Select tire condition</option>
                  <option value="New">New</option>
                  <option value="Good">Good</option>
                  <option value="Worn Out">Worn Out</option>
                </select>
              </label>
              <label>
                Brake Condition
                <select value={props.brakeCondition} onChange={(e) => props.setBrakeCondition(e.target.value)}>
                  <option value="">Select brake condition</option>
                  <option value="New">New</option>
                  <option value="Good">Good</option>
                  <option value="Worn Out">Worn Out</option>
                </select>
              </label>
              <label>
                Battery Status
                <select value={props.batteryStatus} onChange={(e) => props.setBatteryStatus(e.target.value)}>
                  <option value="">Select battery status</option>
                  <option value="Good">Good</option>
                  <option value="Weak">Weak</option>
                </select>
              </label>
              <div className="form-section-title">
                <Wrench aria-hidden="true" />
                <div>
                  <h4>Service Intervals</h4>
                  <p>Intervals and last-service readings used to judge upcoming maintenance needs.</p>
                </div>
              </div>
              <label>
                Service Interval (km)
                <input type="number" value={props.serviceIntervalKm} onChange={(e) => props.setServiceIntervalKm(e.target.value)} />
              </label>
              <label>
                Oil Interval (km)
                <input type="number" value={props.oilIntervalKm} onChange={(e) => props.setOilIntervalKm(e.target.value)} />
              </label>
              <label>
                Tyre Life (km)
                <input type="number" value={props.tyreLifeKm} onChange={(e) => props.setTyreLifeKm(e.target.value)} />
              </label>
              <label>
                Brake Life (km)
                <input type="number" value={props.brakeLifeKm} onChange={(e) => props.setBrakeLifeKm(e.target.value)} />
              </label>
              <label>
                Battery Life (months)
                <input type="number" value={props.batteryLifeMonths} onChange={(e) => props.setBatteryLifeMonths(e.target.value)} />
              </label>
              <label>
                Fuel Filter Interval (km)
                <input type="number" value={props.fuelFilterIntervalKm} onChange={(e) => props.setFuelFilterIntervalKm(e.target.value)} />
              </label>
              <label>
                Last Service Odometer
                <input type="number" value={props.lastServiceOdometerKm} onChange={(e) => props.setLastServiceOdometerKm(e.target.value)} />
              </label>
              <label>
                Last Oil Change Odometer
                <input type="number" value={props.lastOilChangeOdometerKm} onChange={(e) => props.setLastOilChangeOdometerKm(e.target.value)} />
              </label>
              <label>
                Last Tyre Change Odometer
                <input type="number" value={props.lastTyreChangeOdometerKm} onChange={(e) => props.setLastTyreChangeOdometerKm(e.target.value)} />
              </label>
              <label>
                Last Brake Service Odometer
                <input type="number" value={props.lastBrakeServiceOdometerKm} onChange={(e) => props.setLastBrakeServiceOdometerKm(e.target.value)} />
              </label>
              <label>
                Last Fuel Filter Odometer
                <input type="number" value={props.lastFuelFilterChangeOdometerKm} onChange={(e) => props.setLastFuelFilterChangeOdometerKm(e.target.value)} />
              </label>
              <label>
                Battery Installed
                <input type="date" value={props.batteryInstalledAt} onChange={(e) => props.setBatteryInstalledAt(e.target.value)} />
              </label>
              <div className="form-section-title">
                <Settings2 aria-hidden="true" />
                <div>
                  <h4>Availability</h4>
                  <p>Control whether this vehicle can be assigned to work or held for service.</p>
                </div>
              </div>
              <div className="form-toggle-row form-toggle-row--full">
                <label className="toggle-switch">
                  <span className="toggle-switch__label">Active</span>
                  <input
                    type="checkbox"
                    className="toggle-switch__input"
                    checked={activeToggleEnabled()}
                    disabled={maintenanceToggleEnabled()}
                    onChange={(e) => handleVehicleActiveToggle(e.target.checked)}
                  />
                  <span className="toggle-switch__track" aria-hidden="true">
                    <span className="toggle-switch__thumb" />
                  </span>
                </label>
                <label className="toggle-switch">
                  <span className="toggle-switch__label">Maintenance</span>
                  <input
                    type="checkbox"
                    className="toggle-switch__input"
                    checked={maintenanceToggleEnabled()}
                    onChange={(e) => handleVehicleMaintenanceToggle(e.target.checked)}
                  />
                  <span className="toggle-switch__track" aria-hidden="true">
                    <span className="toggle-switch__thumb" />
                  </span>
                </label>
              </div>
            </form>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={closeVehicleModal}>
                Cancel
              </button>
              <button className="btn" type="submit" form="vehicle-form" disabled={props.loading}>
                {props.loading ? "Saving..." : props.editingVehicleId ? "Save Changes" : "Add Vehicle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--wide modal--details fleet-detail-modal" role="dialog" aria-modal="true" aria-label="Vehicle details">
            <div className="modal__header">
              <div>
                <h3>{viewTarget.plate_no}</h3>
                <p className="modal__subtle">{formatMakeModel(viewTarget)} • {viewTarget.vehicle_type || "Vehicle"} • {viewTarget.year || "--"}</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setViewTarget(null)} aria-label="Close vehicle details">
                ✕
              </button>
            </div>
            <div className="fleet-detail-body details-grid--scroll">
              {(() => {
                const prediction = predictionFor(viewTarget);
                const probability = prediction ? Math.round(prediction.probability * 100) : null;
                const components = componentRows(viewTarget, prediction);
                return (
                  <>
                    <section className={`fleet-risk-hero fleet-risk-hero--${prediction?.risk_level || "neutral"}`}>
                      <div>
                        <span className="fleet-panel__eyebrow">Maintenance risk</span>
                        <h4>{prediction ? formatRiskLabel(prediction.risk_level) : "No maintenance check yet"}</h4>
                        <p>
                          {prediction
                            ? getRiskSummary(viewTarget, prediction)
                            : "Run a maintenance check before using this vehicle for service planning."}
                        </p>
                      </div>
                      <div className="fleet-risk-hero__score">
                        <strong>{probability ?? "--"}{probability !== null ? "%" : ""}</strong>
                        <span>{prediction?.predicted_at ? formatShortDate(prediction.predicted_at) : "Latest check"}</span>
                      </div>
                    </section>

                    <section className="fleet-detail-section">
                      <div className="fleet-detail-section__header">
                        <Car aria-hidden="true" />
                        <h4>Vehicle Details</h4>
                      </div>
                      <div className="details-grid">
                        <div className="detail-item"><span>Plate</span><strong>{viewTarget.plate_no}</strong></div>
                        <div className="detail-item"><span>Make / Model</span><strong>{formatMakeModel(viewTarget)}</strong></div>
                        <div className="detail-item"><span>Type / Year</span><strong>{viewTarget.vehicle_type || "Not recorded"} • {viewTarget.year || "Not recorded"}</strong></div>
                        <div className="detail-item"><span>Status</span><strong>{formatReadable(viewTarget.status)}</strong></div>
                        <div className="detail-item"><span>Odometer</span><strong>{formatNumber(viewTarget.odometer_km)} km</strong></div>
                        <div className="detail-item"><span>Engine / Transmission</span><strong>{formatNumber(viewTarget.engine_size_cc)} cc • {viewTarget.transmission_type || "Not recorded"}</strong></div>
                      </div>
                    </section>

                    <section className="fleet-detail-section">
                      <div className="fleet-detail-section__header">
                        <Activity aria-hidden="true" />
                        <h4>Usage Profile</h4>
                      </div>
                      <div className="details-grid">
                        <div className="detail-item"><span>Fuel Type</span><strong>{formatReadable(viewTarget.fuel_type)}</strong></div>
                        <div className="detail-item"><span>Business Type</span><strong>{formatReadable(viewTarget.business_type)}</strong></div>
                        <div className="detail-item"><span>Road Condition</span><strong>{formatReadable(viewTarget.road_condition_primary)}</strong></div>
                        <div className="detail-item"><span>Driver Behavior</span><strong>{formatReadable(viewTarget.driver_behavior_profile)}</strong></div>
                        <div className="detail-item"><span>Expected km/l</span><strong>{viewTarget.expected_kmpl ?? viewTarget.fuel_efficiency ?? "Not recorded"}</strong></div>
                        <div className="detail-item"><span>Load Factor</span><strong>{viewTarget.typical_load_factor ?? "Not recorded"}</strong></div>
                      </div>
                    </section>

                    <section className="fleet-detail-section">
                      <div className="fleet-detail-section__header">
                        <Wrench aria-hidden="true" />
                        <h4>Service Intervals</h4>
                      </div>
                      <div className="fleet-component-list">
                        {components.map((component) => (
                          <div className="fleet-component-row" key={component.label}>
                            <div>
                              <strong>{component.label}</strong>
                              <span>Last {formatNumber(component.lastOdometer as number | undefined)} km • interval {formatNumber(component.interval as number | undefined)} km</span>
                            </div>
                            <div className="fleet-component-meter" aria-label={`${component.label} ${Math.round(component.ratio * 100)} percent due`}>
                              <span style={{ width: `${Math.min(100, Math.max(4, component.ratio * 100))}%` }} />
                            </div>
                            <span className={`risk-pill ${component.ratio >= 1 ? "risk-pill--high" : component.ratio >= 0.85 ? "risk-pill--medium" : "risk-pill--low"}`}>
                              {Math.round(component.ratio * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="fleet-detail-section">
                      <div className="fleet-detail-section__header">
                        <Gauge aria-hidden="true" />
                        <h4>Service Signals</h4>
                      </div>
                      <div className="details-grid">
                        <div className="detail-item"><span>Vehicle Stress</span><strong>{getFeatureNumber(prediction, "vehicle_stress_score").toFixed(2)}</strong></div>
                        <div className="detail-item"><span>Wear Score</span><strong>{getFeatureNumber(prediction, "component_wear_score").toFixed(2)}</strong></div>
                        <div className="detail-item"><span>Recent Events</span><strong>{formatNumber(getFeatureNumber(prediction, "maintenance_events_last_12w"))} in 12 weeks</strong></div>
                        <div className="detail-item"><span>Recent Repairs</span><strong>{formatNumber(getFeatureNumber(prediction, "repair_events_last_24w"))} in 24 weeks</strong></div>
                        <div className="detail-item"><span>Days Since Maintenance</span><strong>{formatNumber(getFeatureNumber(prediction, "days_since_last_maintenance"))}</strong></div>
                        <div className="detail-item"><span>Accidents</span><strong>{formatNumber(viewTarget.accident_history_count)}</strong></div>
                      </div>
                    </section>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Confirm delete">
            <div className="modal__header">
              <h3>Delete Vehicle?</h3>
              <button className="modal__close" type="button" onClick={() => setDeleteTarget(null)} aria-label="Close delete dialog">
                ✕
              </button>
            </div>
            <p className="muted">
              Are you sure you want to delete <strong>{deleteTarget.plate_no}</strong>? This action
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
