import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Eye,
  Fuel as FuelIconGlyph,
  Gauge,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

type Vehicle = {
  id: string;
  plate_no: string;
};

type FuelLog = {
  id: string;
  vehicle_id: string;
  fuel_date: string;
  liters: number;
  cost_lkr?: number;
  odometer_km?: number;
  vendor?: string;
};

type FuelForecast = {
  vehicle_id: string;
  plate_no: string;
  forecast_liters_7d: number;
  recent_7d_liters?: number;
  recent_30d_liters?: number;
  recent_distance_km_30d?: number;
  recent_trip_count_30d?: number;
  recent_avg_speed_kmh?: number;
  fuel_efficiency_gap_ratio?: number;
};

type FuelProps = {
  vehicles: Vehicle[];
  fuelLogs: FuelLog[];
  fuelForecasts: FuelForecast[];
  loading: boolean;
  fuelVehicle: string;
  setFuelVehicle: (v: string) => void;
  fuelDate: string;
  setFuelDate: (v: string) => void;
  fuelLiters: string;
  setFuelLiters: (v: string) => void;
  fuelCost: string;
  setFuelCost: (v: string) => void;
  fuelOdometer: string;
  setFuelOdometer: (v: string) => void;
  fuelVendor: string;
  setFuelVendor: (v: string) => void;
  editingFuelId: string | null;
  onExportFuel: () => void;
  onAddFuel: (e: FormEvent) => void;
  onEditFuel: (fuelLog: FuelLog) => void;
  onCancelFuelEdit: () => void;
  onDeleteFuel: (fuelId: string) => Promise<void>;
};

type TrendPoint = {
  key: string;
  label: string;
  value: number;
};

type FuelSignal = {
  label: string;
  detail: string;
  tone: "danger" | "warning" | "success" | "info";
  badge: string;
};

type FuelDateRangeMode = "last7" | "last30" | "custom";

const currency = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 0,
});

function parseLogDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShortDate(value: string) {
  const date = parseLogDate(value);
  if (!date) return value;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatCompactDate(value: string) {
  const date = parseLogDate(value);
  if (!date) return value.slice(5);
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function buildNextSevenDayLabels() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + 1);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  });
}

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatLiters(value: number, digits = 0) {
  return `${formatNumber(value, digits)} L`;
}

function formatChartTick(value: number) {
  if (value >= 1000) return `${formatNumber(value / 1000, value >= 10000 ? 0 : 1)}K`;
  return formatNumber(value);
}

function formatPercent(value: number, digits = 1) {
  if (!Number.isFinite(value)) return "0%";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function isSameMonth(dateValue: string, today = new Date()) {
  const date = parseLogDate(dateValue);
  if (!date) return false;
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
}

function startOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatDateInput(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysAgoKey(daysAgo: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function buildLastThirtyDayTrend(logs: FuelLog[]): TrendPoint[] {
  const spendByDate = logs.reduce<Record<string, number>>((acc, log) => {
    acc[log.fuel_date] = (acc[log.fuel_date] || 0) + (log.cost_lkr || 0);
    return acc;
  }, {});

  return Array.from({ length: 30 }, (_, index) => {
    const key = daysAgoKey(29 - index);
    return {
      key,
      label: formatCompactDate(key),
      value: spendByDate[key] || 0,
    };
  });
}

function trendPolyline(points: TrendPoint[], width: number, height: number) {
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const step = points.length > 1 ? width / (points.length - 1) : width;
  return points
    .map((point, index) => {
      const x = index * step;
      const y = height - (point.value / maxValue) * (height - 12) - 6;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function trendArea(points: TrendPoint[], width: number, height: number) {
  const line = trendPolyline(points, width, height);
  return `0,${height} ${line} ${width},${height}`;
}

function numberPolyline(values: number[], width: number, height: number) {
  const maxValue = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / maxValue) * (height - 12) - 6;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function numberArea(values: number[], width: number, height: number) {
  const line = numberPolyline(values, width, height);
  return `0,${height} ${line} ${width},${height}`;
}

export default function Fuel(props: FuelProps) {
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [selectedFuelLog, setSelectedFuelLog] = useState<FuelLog | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FuelLog | null>(null);
  const [fuelSearch, setFuelSearch] = useState("");
  const [fuelVehicleFilter, setFuelVehicleFilter] = useState("all");
  const [fuelDateRangeMode, setFuelDateRangeMode] = useState<FuelDateRangeMode>("last30");
  const [fuelCustomDateFrom, setFuelCustomDateFrom] = useState(formatDateInput(startOfLocalDay() - 30 * 24 * 60 * 60 * 1000));
  const [fuelCustomDateTo, setFuelCustomDateTo] = useState(formatDateInput(startOfLocalDay()));
  const [fuelRowsPerPage, setFuelRowsPerPage] = useState(10);
  const [fuelPage, setFuelPage] = useState(1);

  const vehicleLabelMap = useMemo(
    () =>
      props.vehicles.reduce<Record<string, string>>((acc, vehicle) => {
        acc[vehicle.id] = vehicle.plate_no;
        return acc;
      }, {}),
    [props.vehicles]
  );

  const monthlyFuelLogs = useMemo(
    () => props.fuelLogs.filter((log) => isSameMonth(log.fuel_date)),
    [props.fuelLogs]
  );

  const totalLiters = props.fuelLogs.reduce((sum, f) => sum + f.liters, 0);
  const totalCost = props.fuelLogs.reduce((sum, f) => sum + (f.cost_lkr || 0), 0);
  const monthlyLiters = monthlyFuelLogs.reduce((sum, f) => sum + f.liters, 0);
  const monthlyCost = monthlyFuelLogs.reduce((sum, f) => sum + (f.cost_lkr || 0), 0);
  const avgCostPerLiter = monthlyLiters > 0 ? monthlyCost / monthlyLiters : 0;
  const projectedFuelDemand = props.fuelForecasts.reduce(
    (sum, row) => sum + row.forecast_liters_7d,
    0
  );
  const priorMonthCost = props.fuelLogs
    .filter((log) => {
      const date = parseLogDate(log.fuel_date);
      if (!date) return false;
      const today = new Date();
      const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return date.getFullYear() === previousMonth.getFullYear() && date.getMonth() === previousMonth.getMonth();
    })
    .reduce((sum, log) => sum + (log.cost_lkr || 0), 0);
  const priorMonthLiters = props.fuelLogs
    .filter((log) => {
      const date = parseLogDate(log.fuel_date);
      if (!date) return false;
      const today = new Date();
      const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return date.getFullYear() === previousMonth.getFullYear() && date.getMonth() === previousMonth.getMonth();
    })
    .reduce((sum, log) => sum + log.liters, 0);
  const monthlySpendDelta = priorMonthCost > 0 ? ((monthlyCost - priorMonthCost) / priorMonthCost) * 100 : 0;
  const monthlyLiterDelta = priorMonthLiters > 0 ? ((monthlyLiters - priorMonthLiters) / priorMonthLiters) * 100 : 0;

  const fuelDateWindow = useMemo(() => {
    const today = startOfLocalDay();
    if (fuelDateRangeMode === "last7") return { start: today - 7 * 24 * 60 * 60 * 1000, end: today };
    if (fuelDateRangeMode === "last30") return { start: today - 30 * 24 * 60 * 60 * 1000, end: today };
    return {
      start: fuelCustomDateFrom ? startOfLocalDay(new Date(`${fuelCustomDateFrom}T00:00:00`)) : Number.NEGATIVE_INFINITY,
      end: fuelCustomDateTo ? startOfLocalDay(new Date(`${fuelCustomDateTo}T00:00:00`)) : Number.POSITIVE_INFINITY,
    };
  }, [fuelCustomDateFrom, fuelCustomDateTo, fuelDateRangeMode]);

  const filteredFuelLogs = props.fuelLogs.filter((log) => {
    const query = fuelSearch.trim().toLowerCase();
    const logDate = parseLogDate(log.fuel_date);
    const logTimestamp = logDate ? startOfLocalDay(logDate) : undefined;
    const matchesVehicleFilter =
      fuelVehicleFilter === "all" || log.vehicle_id === fuelVehicleFilter;
    if (!matchesVehicleFilter) return false;
    if (typeof logTimestamp === "number" && (logTimestamp < fuelDateWindow.start || logTimestamp > fuelDateWindow.end)) return false;
    if (!query) return true;
    return [
      log.fuel_date,
      log.vendor,
      vehicleLabelMap[log.vehicle_id] || "",
      String(log.liters),
      typeof log.cost_lkr === "number" ? String(log.cost_lkr) : "",
      typeof log.odometer_km === "number" ? String(log.odometer_km) : "",
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const fuelTotalPages = Math.max(1, Math.ceil(filteredFuelLogs.length / fuelRowsPerPage));
  const currentFuelPage = Math.min(fuelPage, fuelTotalPages);
  const paginatedFuelLogs = filteredFuelLogs.slice(
    (currentFuelPage - 1) * fuelRowsPerPage,
    currentFuelPage * fuelRowsPerPage
  );

  useEffect(() => {
    setFuelPage(1);
  }, [fuelCustomDateFrom, fuelCustomDateTo, fuelDateRangeMode, fuelRowsPerPage, fuelSearch, fuelVehicleFilter, props.fuelLogs.length]);

  useEffect(() => {
    if (!props.loading) {
      setShowFuelModal(false);
    }
  }, [props.loading]);

  const spendTrend = useMemo(() => buildLastThirtyDayTrend(props.fuelLogs), [props.fuelLogs]);
  const trendLine = trendPolyline(spendTrend, 520, 180);
  const trendFill = trendArea(spendTrend, 520, 180);
  const maxTrendValue = Math.max(...spendTrend.map((point) => point.value), 1);
  const trendTicks = [maxTrendValue, maxTrendValue * 0.66, maxTrendValue * 0.33, 0];
  const trendLabelPoints = spendTrend.filter((_, index) => index % 6 === 0 || index === spendTrend.length - 1);

  const efficiencyRows = useMemo(() => {
    return props.vehicles
      .map((vehicle) => {
        const logs = props.fuelLogs
          .filter((log) => log.vehicle_id === vehicle.id)
          .filter((log) => typeof log.odometer_km === "number" && log.odometer_km >= 0);
        const liters = props.fuelLogs
          .filter((log) => log.vehicle_id === vehicle.id)
          .reduce((sum, log) => sum + log.liters, 0);
        const odometers = logs.map((log) => log.odometer_km || 0);
        const distance = odometers.length >= 2 ? Math.max(...odometers) - Math.min(...odometers) : 0;
        const efficiency = distance > 0 && liters > 0 ? distance / liters : 0;
        return {
          vehicleId: vehicle.id,
          plateNo: vehicle.plate_no,
          efficiency,
          liters,
        };
      })
      .filter((row) => row.efficiency > 0)
      .sort((a, b) => b.efficiency - a.efficiency)
      .slice(0, 6);
  }, [props.fuelLogs, props.vehicles]);

  const fleetEfficiency =
    efficiencyRows.length > 0
      ? efficiencyRows.reduce((sum, row) => sum + row.efficiency, 0) / efficiencyRows.length
      : 0;
  const maxEfficiency = Math.max(...efficiencyRows.map((row) => row.efficiency), 1);
  const efficiencyAxisMax = Math.max(20, Math.ceil(maxEfficiency / 5) * 5);
  const efficiencyTicks = [efficiencyAxisMax, efficiencyAxisMax * 0.75, efficiencyAxisMax * 0.5, efficiencyAxisMax * 0.25, 0];

  const vehicleFuelDemand = [...props.fuelForecasts]
    .sort((a, b) => b.forecast_liters_7d - a.forecast_liters_7d)
    .slice(0, 5);
  const forecastTrendValues =
    props.fuelForecasts.length > 0
      ? [0.86, 0.78, 0.72, 0.96, 1.12, 0.91, 0.85].map((weight) => (projectedFuelDemand / 7) * weight)
      : [];
  const maxForecastTrend = Math.max(...forecastTrendValues, 1);
  const forecastTrendLine = numberPolyline(forecastTrendValues, 520, 92);
  const forecastTrendArea = numberArea(forecastTrendValues, 520, 92);
  const forecastTicks = [maxForecastTrend, maxForecastTrend * 0.66, maxForecastTrend * 0.33, 0];
  const forecastDateLabels = useMemo(() => buildNextSevenDayLabels(), []);
  const averageForecastGap =
    props.fuelForecasts.length > 0
      ? props.fuelForecasts.reduce((sum, row) => sum + (row.fuel_efficiency_gap_ratio || 0), 0) /
        props.fuelForecasts.length
      : 0;

  const vendorRows = useMemo(() => {
    const spendByVendor = monthlyFuelLogs.reduce<Record<string, number>>((acc, log) => {
      const vendor = log.vendor?.trim() || "Other";
      acc[vendor] = (acc[vendor] || 0) + (log.cost_lkr || 0);
      return acc;
    }, {});
    return Object.entries(spendByVendor)
      .map(([vendor, spend]) => ({
        vendor,
        spend,
        percent: monthlyCost > 0 ? (spend / monthlyCost) * 100 : 0,
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 4);
  }, [monthlyCost, monthlyFuelLogs]);
  const vendorColors = ["#16a34a", "#2563eb", "#f97316", "#94a3b8"];
  let vendorCursor = 0;
  const vendorDonutGradient =
    vendorRows.length > 0
      ? `conic-gradient(${vendorRows
          .map((row, index) => {
            const start = vendorCursor;
            vendorCursor += row.percent;
            return `${vendorColors[index]} ${start}% ${vendorCursor}%`;
          })
          .join(", ")})`
      : "conic-gradient(#d9e2ea 0% 100%)";

  const costPerLiterRows = props.fuelLogs
    .map((log) => ({
      ...log,
      costPerLiter: log.cost_lkr && log.liters > 0 ? log.cost_lkr / log.liters : 0,
    }))
    .filter((log) => log.costPerLiter > 0);
  const fleetCostPerLiter =
    costPerLiterRows.length > 0
      ? costPerLiterRows.reduce((sum, log) => sum + log.costPerLiter, 0) / costPerLiterRows.length
      : 0;
  const overBudgetVehicleCount = props.vehicles.filter((vehicle) => {
    const vehicleSpend = monthlyFuelLogs
      .filter((log) => log.vehicle_id === vehicle.id)
      .reduce((sum, log) => sum + (log.cost_lkr || 0), 0);
    const averageVehicleSpend = props.vehicles.length > 0 ? monthlyCost / props.vehicles.length : 0;
    return averageVehicleSpend > 0 && vehicleSpend > averageVehicleSpend * 1.25;
  }).length;
  const missingLogCount = props.vehicles.filter(
    (vehicle) => !monthlyFuelLogs.some((log) => log.vehicle_id === vehicle.id)
  ).length;
  const costSpikeCount =
    fleetCostPerLiter > 0
      ? costPerLiterRows.filter((log) => log.costPerLiter > fleetCostPerLiter * 1.2).length
      : 0;
  const lowEfficiencyCount =
    fleetEfficiency > 0
      ? efficiencyRows.filter((row) => row.efficiency < fleetEfficiency * 0.85).length
      : 0;
  const fuelSignals: FuelSignal[] = [
    {
      label: "Over Budget Vehicles",
      detail: `${overBudgetVehicleCount} Vehicles`,
      tone: "danger",
      badge: "High",
    },
    {
      label: "Missing Fuel Logs",
      detail: `${missingLogCount} Vehicles`,
      tone: "warning",
      badge: "Medium",
    },
    {
      label: "Cost Spikes Detected",
      detail: `${costSpikeCount} Entries`,
      tone: "success",
      badge: "Low",
    },
    {
      label: "Low Efficiency Alerts",
      detail: `${lowEfficiencyCount} Vehicles`,
      tone: "info",
      badge: "Info",
    },
  ];

  const fuelVariance =
    fleetCostPerLiter > 0 && avgCostPerLiter > 0
      ? ((avgCostPerLiter - fleetCostPerLiter) / fleetCostPerLiter) * 100
      : 0;
  const idleFuelEstimate = Math.round(Math.max(0, projectedFuelDemand * 0.038));
  const wasteEstimate = Math.max(0, Math.round(idleFuelEstimate * (avgCostPerLiter || fleetCostPerLiter || 0)));
  const latestFuelLog = [...props.fuelLogs].sort(
    (a, b) => new Date(b.fuel_date).getTime() - new Date(a.fuel_date).getTime()
  )[0];
  const costPerLiter =
    selectedFuelLog?.cost_lkr && selectedFuelLog.liters > 0
      ? selectedFuelLog.cost_lkr / selectedFuelLog.liters
      : null;

  function closeFuelModal() {
    setShowFuelModal(false);
    if (props.editingFuelId) {
      props.onCancelFuelEdit();
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await props.onDeleteFuel(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <section className="section">
      <section className="admin-page fuel-page">
        <section className="dashboard-kpis fuel-kpi-grid" aria-label="Fuel analytics summary">
          <article className="dashboard-kpi-card dashboard-kpi-card--teal fuel-kpi-card">
            <span className="dashboard-kpi-card__icon">
              <FuelIconGlyph aria-hidden="true" />
            </span>
            <div>
              <span className="dashboard-kpi-card__label">Monthly Fuel Spend</span>
              <strong>{currency.format(monthlyCost)}</strong>
              <small className={`dashboard-trend ${monthlySpendDelta >= 0 ? "dashboard-trend--positive" : "dashboard-trend--danger"}`}>
                {formatPercent(monthlySpendDelta)} vs last month
              </small>
            </div>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card--blue fuel-kpi-card">
            <span className="dashboard-kpi-card__icon">
              <Gauge aria-hidden="true" />
            </span>
            <div>
              <span className="dashboard-kpi-card__label">Liters Logged</span>
              <strong>{formatLiters(monthlyLiters)}</strong>
              <small className={`dashboard-trend ${monthlyLiterDelta >= 0 ? "dashboard-trend--positive" : "dashboard-trend--danger"}`}>
                {formatPercent(monthlyLiterDelta)} vs last month
              </small>
            </div>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card--purple fuel-kpi-card">
            <span className="dashboard-kpi-card__icon">
              <CircleDollarSign aria-hidden="true" />
            </span>
            <div>
              <span className="dashboard-kpi-card__label">Avg Cost per Liter</span>
              <strong>{avgCostPerLiter > 0 ? currency.format(avgCostPerLiter) : "LKR 0"}</strong>
              <small className={`dashboard-trend ${fuelVariance <= 0 ? "dashboard-trend--positive" : "dashboard-trend--danger"}`}>
                {formatPercent(Math.abs(fuelVariance))} vs fleet average
              </small>
            </div>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card--orange fuel-kpi-card">
            <span className="dashboard-kpi-card__icon">
              <BarChart3 aria-hidden="true" />
            </span>
            <div>
              <span className="dashboard-kpi-card__label">Forecast 7-Day Demand</span>
              <strong>{formatLiters(projectedFuelDemand)}</strong>
              <small className="dashboard-trend dashboard-trend--positive">
                {formatLiters(props.fuelForecasts.reduce((sum, row) => sum + (row.recent_7d_liters || 0), 0))} recent
              </small>
            </div>
          </article>
        </section>

        <div className="fuel-analytics-grid">
          <section className="fuel-board-card fuel-chart-card">
            <div className="fuel-card-header">
              <h3>Fuel Spend Trend</h3>
              <button className="fuel-chip-button" type="button">Last 30 Days</button>
            </div>
            <div className="fuel-line-chart" aria-label="Fuel spend trend">
              <div className="fuel-line-chart__axis">
                {trendTicks.map((tick) => (
                  <span key={tick}>{currency.format(tick)}</span>
                ))}
              </div>
              <svg viewBox="0 0 520 220" role="img" aria-label="Last 30 days fuel spend">
                <defs>
                  <linearGradient id="fuelSpendArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#078f92" stopOpacity="0.14" />
                    <stop offset="100%" stopColor="#078f92" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {[40, 85, 130, 175].map((y) => (
                  <line key={y} x1="0" x2="520" y1={y} y2={y} className="fuel-chart-gridline" />
                ))}
                <polygon points={trendFill} transform="translate(0 20)" className="fuel-chart-area" />
                <polyline points={trendLine} transform="translate(0 20)" className="fuel-chart-line" />
                {spendTrend.map((point, index) => {
                  if (index % 3 !== 0 && index !== spendTrend.length - 1) return null;
                  const maxValue = Math.max(maxTrendValue, 1);
                  const x = index * (520 / (spendTrend.length - 1));
                  const y = 200 - (point.value / maxValue) * 168;
                  return <circle key={point.key} cx={x} cy={y} r="3.4" className="fuel-chart-dot" />;
                })}
                {trendLabelPoints.map((point, index) => (
                  <text
                    key={point.key}
                    x={index === 0 ? 0 : index === trendLabelPoints.length - 1 ? 508 : index * 104}
                    y="216"
                    className="fuel-chart-label"
                  >
                    {point.label}
                  </text>
                ))}
              </svg>
              <div className="fuel-chart-legend">
                <span><i /> Fuel Spend (LKR)</span>
              </div>
            </div>
          </section>

          <section className="fuel-board-card fuel-chart-card">
            <div className="fuel-card-header">
              <h3>Fuel Forecast</h3>
              <button className="fuel-chip-button" type="button">Next 7 Days</button>
            </div>
            <div className="fuel-forecast-card-body">
              <div>
                <h4>7-Day Forecast Trend</h4>
                <div className="fuel-forecast-chart-grid">
                  <div className="fuel-forecast-chart__axis">
                    {forecastTicks.map((tick) => (
                      <span key={tick}>{formatChartTick(tick)}</span>
                    ))}
                  </div>
                  <div className="fuel-forecast-line-chart">
                    {forecastTrendValues.length === 0 ? (
                      <p className="empty">No trend yet.</p>
                    ) : (
                      <svg viewBox="0 0 520 122" role="img" aria-label="7-day forecast trend">
                        <defs>
                          <linearGradient id="fuelForecastArea" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#5dbec0" stopOpacity="0.16" />
                            <stop offset="100%" stopColor="#5dbec0" stopOpacity="0.02" />
                          </linearGradient>
                        </defs>
                        {[20, 52, 84].map((y) => (
                          <line key={y} x1="0" x2="520" y1={y} y2={y} className="fuel-chart-gridline" />
                        ))}
                        <polygon points={forecastTrendArea} transform="translate(0 12)" className="fuel-forecast-area" />
                        <polyline points={forecastTrendLine} transform="translate(0 12)" className="fuel-forecast-line" />
                        {forecastTrendValues.map((value, index) => {
                          const x = index * (520 / Math.max(1, forecastTrendValues.length - 1));
                          const y = 104 - (value / maxForecastTrend) * 80;
                          return <circle key={`${value}-${index}`} cx={x} cy={y} r="3.2" className="fuel-forecast-dot" />;
                        })}
                        {forecastDateLabels.map((label, index) => (
                          <text key={`${label}-${index}`} x={index * (520 / 6)} y="120" className="fuel-chart-label">
                            {label}
                          </text>
                        ))}
                      </svg>
                    )}
                    <div className="fuel-forecast-legend">
                      <span><i /> Forecasted Demand (L)</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="fuel-forecast-summary">
                <div className="fuel-forecast-top-vehicles">
                  <h4>Top Vehicles (Projected L)</h4>
                  <div className="fuel-rank-list">
                    {vehicleFuelDemand.length === 0 ? (
                      <p className="empty">No forecast available.</p>
                    ) : (
                      vehicleFuelDemand.slice(0, 3).map((forecast, index) => (
                        <div className="fuel-rank-row" key={forecast.vehicle_id}>
                          <span>{index + 1}</span>
                          <strong>{forecast.plate_no}</strong>
                          <b>{formatLiters(forecast.forecast_liters_7d)}</b>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="fuel-forecast-metrics">
                  <div>
                    <span>7-Day Demand Total</span>
                    <strong>{formatLiters(projectedFuelDemand)}</strong>
                    <small className="trend-up"><TrendingUp aria-hidden="true" /> Forecast total</small>
                  </div>
                  <div>
                    <span>Efficiency Gap (km/L)</span>
                    <strong className={averageForecastGap < 0 ? "text-danger" : ""}>
                      {averageForecastGap ? `${averageForecastGap.toFixed(1)} km/L` : "--"}
                    </strong>
                    <small>vs fleet target 12.5 km/L</small>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="fuel-board-card fuel-chart-card">
            <div className="fuel-card-header">
              <h3>Fuel Efficiency by Vehicle (km/L)</h3>
              <button className="fuel-chip-button" type="button">Last 30 Days</button>
            </div>
            {efficiencyRows.length === 0 ? (
              <div className="fuel-empty-state">
                <Gauge aria-hidden="true" />
                <div><strong>No efficiency data</strong><span>Add fuel logs with odometer readings to calculate km/L.</span></div>
              </div>
            ) : (
              <div className="fuel-bar-chart-grid">
                <div className="fuel-bar-chart__axis">
                  {efficiencyTicks.map((tick) => (
                    <span key={tick}>{formatNumber(tick, tick % 1 === 0 ? 0 : 1)}</span>
                  ))}
                </div>
                <div className="fuel-bar-chart">
                  {efficiencyRows.map((row) => (
                    <div className="fuel-bar" key={row.vehicleId}>
                      <strong>{row.efficiency.toFixed(1)}</strong>
                      <div className="fuel-bar__track">
                        <span style={{ height: `${Math.max(8, (row.efficiency / efficiencyAxisMax) * 100)}%` }} />
                      </div>
                      <small>{row.plateNo}</small>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="fuel-main-grid">
          <section className="fuel-board-card fuel-logs-panel">
            <div className="fuel-card-header">
              <h3>Fuel Logs</h3>
              <div className="fuel-card-header__actions">
                <button className="fuel-secondary-action" type="button" onClick={props.onExportFuel}>
                  <Download aria-hidden="true" />
                  Export
                </button>
                <button
                  className="fuel-table-action"
                  type="button"
                  onClick={() => {
                    props.onCancelFuelEdit();
                    setShowFuelModal(true);
                  }}
                >
                  <Plus aria-hidden="true" />
                  Add Fuel Log
                </button>
              </div>
            </div>
            <div className="fuel-table-controls">
              <label className="fuel-search-control">
                <Search aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search by vehicle or vendor..."
                  value={fuelSearch}
                  onChange={(e) => setFuelSearch(e.target.value)}
                />
              </label>
              <label className="fuel-select-control">
                <span>Vehicle</span>
                <select value={fuelVehicleFilter} onChange={(e) => setFuelVehicleFilter(e.target.value)}>
                  <option value="all">All Vehicles</option>
                  {props.vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>{vehicle.plate_no}</option>
                  ))}
                </select>
              </label>
              <label className="fuel-select-control fuel-select-control--date">
                <span>Range</span>
                <select
                  value={fuelDateRangeMode}
                  onChange={(e) => setFuelDateRangeMode(e.target.value as FuelDateRangeMode)}
                >
                  <option value="last7">Last 7 Days</option>
                  <option value="last30">Last 30 Days</option>
                  <option value="custom">Custom Range</option>
                </select>
                <CalendarDays aria-hidden="true" />
              </label>
              <label className="fuel-select-control fuel-select-control--rows">
                <span>Rows</span>
                <select
                  value={fuelRowsPerPage}
                  onChange={(e) => setFuelRowsPerPage(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>
              {fuelDateRangeMode === "custom" && (
                <div className="fuel-custom-range">
                  <label>
                    <span>From</span>
                    <input
                      type="date"
                      value={fuelCustomDateFrom}
                      onChange={(e) => setFuelCustomDateFrom(e.target.value)}
                    />
                  </label>
                  <label>
                    <span>To</span>
                    <input
                      type="date"
                      value={fuelCustomDateTo}
                      onChange={(e) => setFuelCustomDateTo(e.target.value)}
                    />
                  </label>
                </div>
              )}
            </div>
            {props.fuelLogs.length === 0 ? (
              <div className="fuel-empty-state">
                <FuelIconGlyph aria-hidden="true" />
                <div><strong>No fuel logs recorded</strong><span>New entries will appear here after logging.</span></div>
              </div>
            ) : filteredFuelLogs.length === 0 ? (
              <p className="empty">No fuel logs match the current filters.</p>
            ) : (
              <>
                <div className="table fuel-table">
                  <div className="table__head fuel-table__head">
                    <span>Vehicle</span>
                    <span>Date</span>
                    <span>Liters</span>
                    <span>Cost (LKR)</span>
                    <span>Odometer (km)</span>
                    <span>Vendor</span>
                    <span>Actions</span>
                  </div>
                  {paginatedFuelLogs.map((log) => (
                    <div className="table__row fuel-table__row" key={log.id}>
                      <span data-label="Vehicle" className="fuel-log-vehicle">
                        <FuelIconGlyph aria-hidden="true" />
                        {vehicleLabelMap[log.vehicle_id] || "--"}
                      </span>
                      <span data-label="Date">{formatShortDate(log.fuel_date)}</span>
                      <span data-label="Liters">{log.liters.toFixed(2)}</span>
                      <span data-label="Cost">{log.cost_lkr ? currency.format(log.cost_lkr) : "--"}</span>
                      <span data-label="Odometer">{log.odometer_km ? formatNumber(log.odometer_km) : "--"}</span>
                      <span data-label="Vendor">{log.vendor || "--"}</span>
                      <span className="table__actions fuel-table__actions" data-label="Actions">
                        <button
                          className="icon-action"
                          type="button"
                          onClick={() => setSelectedFuelLog(log)}
                          aria-label={`View fuel log ${log.id}`}
                          title="View fuel log"
                        >
                          <Eye className="icon-action__svg icon-action__svg--view" aria-hidden="true" />
                        </button>
                        <button
                          className="icon-action"
                          type="button"
                          onClick={() => {
                            props.onEditFuel(log);
                            setShowFuelModal(true);
                          }}
                          aria-label={`Edit fuel log ${log.id}`}
                          title="Edit fuel log"
                        >
                          <Pencil className="icon-action__svg icon-action__svg--edit" aria-hidden="true" />
                        </button>
                        <button
                          className="icon-action icon-action--danger"
                          type="button"
                          onClick={() => setDeleteTarget(log)}
                          aria-label={`Delete fuel log ${log.id}`}
                          title="Delete fuel log"
                          disabled={props.loading}
                        >
                          <Trash2 className="icon-action__svg icon-action__svg--delete" aria-hidden="true" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="fuel-table-footer">
                  <span>
                    Showing {(currentFuelPage - 1) * fuelRowsPerPage + 1} to{" "}
                    {Math.min(currentFuelPage * fuelRowsPerPage, filteredFuelLogs.length)} of{" "}
                    {filteredFuelLogs.length} entries
                  </span>
                  <div className="table-pagination fuel-pagination">
                    <span className="table-pagination__meta">
                      Page {currentFuelPage} of {fuelTotalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFuelPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentFuelPage === 1}
                    >
                      <ChevronLeft aria-hidden="true" /> Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setFuelPage((prev) => Math.min(fuelTotalPages, prev + 1))}
                      disabled={currentFuelPage === fuelTotalPages}
                    >
                      Next <ChevronRight aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>

          <aside className="fuel-side-panel">
            <section className="fuel-board-card fuel-side-card">
              <div className="fuel-card-header fuel-card-header--compact">
                <h3>Vendor Snapshot</h3>
                <button type="button" className="fuel-text-button">View report</button>
              </div>
              <div className="fuel-vendor-snapshot">
                <div className="fuel-donut" style={{ background: vendorDonutGradient }}>
                  <div>
                    <strong>{currency.format(monthlyCost)}</strong>
                    <span>Total Spend</span>
                  </div>
                </div>
                <div className="fuel-vendor-list">
                  {vendorRows.length === 0 ? (
                    <p className="empty">No vendor spend yet.</p>
                  ) : (
                    vendorRows.map((row, index) => (
                      <div key={row.vendor}>
                        <i style={{ background: vendorColors[index] }} />
                        <span>{row.vendor}</span>
                        <strong>{row.percent.toFixed(0)}% ({currency.format(row.spend)})</strong>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="fuel-board-card fuel-side-card">
              <div className="fuel-card-header fuel-card-header--compact">
                <h3>Fuel Control Signals</h3>
                <button type="button" className="fuel-text-button">View all</button>
              </div>
              <div className="fuel-signal-list">
                {fuelSignals.map((signal) => (
                  <div className="fuel-signal-row" key={signal.label}>
                    <span className={`fuel-signal-icon fuel-signal-icon--${signal.tone}`}>
                      <AlertTriangle aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{signal.label}</strong>
                      <small>{signal.detail}</small>
                    </div>
                    <b className={`fuel-signal-badge fuel-signal-badge--${signal.tone}`}>{signal.badge}</b>
                    <ChevronRight aria-hidden="true" />
                  </div>
                ))}
              </div>
            </section>

            <section className="fuel-board-card fuel-side-card">
              <div className="fuel-card-header fuel-card-header--compact">
                <h3>Fleet Fuel Health</h3>
                <button type="button" className="fuel-text-button">View report</button>
              </div>
              <div className="fuel-health-grid">
                <div>
                  <span>Total Fuel Efficiency</span>
                  <strong>{fleetEfficiency > 0 ? `${fleetEfficiency.toFixed(1)} km/L` : "--"}</strong>
                  <small className={fleetEfficiency >= 10 ? "trend-up" : "trend-down"}>
                    {fleetEfficiency >= 10 ? <TrendingUp aria-hidden="true" /> : <TrendingDown aria-hidden="true" />}
                    Fleet average
                  </small>
                </div>
                <div>
                  <span>Fuel Variance</span>
                  <strong>{formatPercent(fuelVariance)}</strong>
                  <small className={fuelVariance <= 0 ? "trend-up" : "trend-down"}>
                    {fuelVariance <= 0 ? <TrendingDown aria-hidden="true" /> : <TrendingUp aria-hidden="true" />}
                    vs cost average
                  </small>
                </div>
                <div>
                  <span>Idle Fuel (Est.)</span>
                  <strong>{formatLiters(idleFuelEstimate)}</strong>
                  <small className="trend-up"><TrendingDown aria-hidden="true" /> controllable</small>
                </div>
                <div>
                  <span>Fuel Wastage (Est.)</span>
                  <strong>{currency.format(wasteEstimate)}</strong>
                  <small className="trend-up"><TrendingDown aria-hidden="true" /> estimated waste</small>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </section>

      {showFuelModal && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--form" role="dialog" aria-modal="true" aria-label="Fuel log form">
            <div className="modal__header">
              <div>
                <h3>{props.editingFuelId ? "Edit Fuel Log" : "Log Fuel Purchase"}</h3>
                <p className="modal__subtle">
                  {props.editingFuelId
                    ? "Update liters, cost, odometer, and vendor details."
                    : "Capture liters, cost, odometer, and vendor details."}
                </p>
              </div>
              <button className="modal__close" type="button" onClick={closeFuelModal} aria-label="Close fuel form">
                ✕
              </button>
            </div>
            <form id="fuel-form" className="form form--two-col form--scroll" onSubmit={props.onAddFuel}>
              <div className="form-section-title form__field--full">
                <CalendarDays aria-hidden="true" />
                <div>
                  <h4>Vehicle & Date</h4>
                  <p>Select the vehicle and the purchase date from the fuel receipt.</p>
                </div>
              </div>
              <label>
                Vehicle
                <select
                  value={props.fuelVehicle}
                  onChange={(e) => props.setFuelVehicle(e.target.value)}
                  required
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
                Fuel Date
                <input
                  type="date"
                  value={props.fuelDate}
                  onChange={(e) => props.setFuelDate(e.target.value)}
                  required
                />
              </label>
              <div className="form-section-title form__field--full">
                <FuelIconGlyph aria-hidden="true" />
                <div>
                  <h4>Fuel Quantity</h4>
                  <p>Record the number of liters added to the vehicle.</p>
                </div>
              </div>
              <label>
                Liters
                <input
                  type="number"
                  placeholder="e.g., 45"
                  value={props.fuelLiters}
                  onChange={(e) => props.setFuelLiters(e.target.value)}
                  required
                />
              </label>
              <div className="form-section-title form__field--full">
                <CircleDollarSign aria-hidden="true" />
                <div>
                  <h4>Cost & Station</h4>
                  <p>Add payment amount and station/vendor details for audit trails.</p>
                </div>
              </div>
              <label>
                Cost (LKR)
                <input
                  type="number"
                  placeholder="e.g., 15000"
                  value={props.fuelCost}
                  onChange={(e) => props.setFuelCost(e.target.value)}
                />
              </label>
              <label>
                Vendor / Station
                <input
                  placeholder="e.g., Lanka IOC, Colombo"
                  value={props.fuelVendor}
                  onChange={(e) => props.setFuelVendor(e.target.value)}
                />
              </label>
              <div className="form-section-title form__field--full">
                <Gauge aria-hidden="true" />
                <div>
                  <h4>Odometer</h4>
                  <p>Use the current vehicle reading when available.</p>
                </div>
              </div>
              <label className="form__field--full">
                Odometer (km)
                <input
                  type="number"
                  placeholder="Current reading"
                  value={props.fuelOdometer}
                  onChange={(e) => props.setFuelOdometer(e.target.value)}
                />
              </label>
            </form>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={closeFuelModal}>
                Cancel
              </button>
              <button className="btn" type="submit" form="fuel-form" disabled={props.loading}>
                {props.loading ? "Saving..." : props.editingFuelId ? "Save Changes" : "Add Fuel Log"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedFuelLog && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Fuel log details">
            <div className="modal__header">
              <div>
                <h3>Fuel Log Details</h3>
                <p className="modal__subtle">
                  {vehicleLabelMap[selectedFuelLog.vehicle_id] || "Vehicle"} • {selectedFuelLog.fuel_date}
                </p>
              </div>
              <button className="modal__close" type="button" onClick={() => setSelectedFuelLog(null)} aria-label="Close fuel details">
                ✕
              </button>
            </div>
            <div className="details-grid">
              <div className="detail-item"><span>Date</span><strong>{selectedFuelLog.fuel_date}</strong></div>
              <div className="detail-item"><span>Vehicle</span><strong>{vehicleLabelMap[selectedFuelLog.vehicle_id] || "--"}</strong></div>
              <div className="detail-item"><span>Liters</span><strong>{selectedFuelLog.liters}L</strong></div>
              <div className="detail-item"><span>Cost</span><strong>{selectedFuelLog.cost_lkr ? `Rs.${selectedFuelLog.cost_lkr.toLocaleString()}` : "--"}</strong></div>
              <div className="detail-item"><span>Cost / Liter</span><strong>{costPerLiter ? `Rs.${costPerLiter.toFixed(0)}` : "--"}</strong></div>
              <div className="detail-item"><span>Odometer</span><strong>{selectedFuelLog.odometer_km ?? "--"}</strong></div>
              <div className="detail-item"><span>Vendor</span><strong>{selectedFuelLog.vendor || "--"}</strong></div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Confirm delete">
            <div className="modal__header">
              <h3>Delete Fuel Log?</h3>
              <button className="modal__close" type="button" onClick={() => setDeleteTarget(null)} aria-label="Close delete dialog">
                ✕
              </button>
            </div>
            <p className="muted">
              Are you sure you want to delete this fuel log for <strong>{vehicleLabelMap[deleteTarget.vehicle_id] || "Vehicle"}</strong>? This action cannot be undone.
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
