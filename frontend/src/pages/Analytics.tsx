import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronDown,
  Download,
  Fuel,
  PieChart,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

type Vehicle = {
  id: string;
  plate_no: string;
  recent_fuel_efficiency_avg?: number;
};

type FuelLog = {
  id: string;
  fuel_date: string;
  liters: number;
  cost_lkr?: number;
  vehicle_id: string;
};

type Trip = {
  id: string;
  vehicle_id: string;
  scheduled_start?: string;
  start_time?: string;
  end_time?: string;
};

type MaintenanceRecord = {
  id: string;
  vehicle_id?: string;
  service_date: string;
  service_type?: string;
  event_category?: string;
  cost_lkr?: number;
  next_service_due_km?: number;
};

type MaintenancePrediction = {
  vehicle_id: string;
  probability: number;
  risk_level: "low" | "medium" | "high";
};

type TopPerformer = {
  driverId: string;
  driverName: string;
  score: number;
};

type AnalyticsProps = {
  vehicles: Vehicle[];
  trips: Trip[];
  fuelLogs: FuelLog[];
  maintenance: MaintenanceRecord[];
  maintenancePredictionMap: Record<string, MaintenancePrediction>;
  fuelCostTotal: number;
  projectedFuelDemand: number;
  avgFuelPerVehicle: number;
  vehicleCount: number;
  driverCount: number;
  activeTrips: number;
  topPerformers: TopPerformer[];
  onExportMaintenance: () => void;
};

type DateRangeMode = "last7" | "last30" | "custom";
type AnalyticsReportModal = "performer" | "cost" | "risk" | null;

const DAY_MS = 24 * 60 * 60 * 1000;
const currency = new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 });

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

function parseDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`).getTime();
  return Number.isNaN(parsed) ? undefined : parsed;
}

function formatCompactDate(value: string) {
  const parsed = parseDate(value);
  if (!parsed) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(parsed));
}

function formatDateLabel(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(timestamp));
}

function formatWeekRange(startTimestamp: number) {
  const start = new Date(startTimestamp);
  const end = new Date(startTimestamp + 6 * DAY_MS);
  const startLabel = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(start);
  const endLabel = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(end);
  return `${startLabel} - ${endLabel}`;
}

function tripDate(trip: Trip) {
  return trip.end_time || trip.start_time || trip.scheduled_start;
}

function normalizeServiceCategory(value?: string) {
  const normalized = (value || "Other").toLowerCase();
  if (normalized.includes("tyre") || normalized.includes("tire")) return "Tires";
  if (normalized.includes("engine") || normalized.includes("service")) return "Engine";
  if (normalized.includes("brake")) return "Brakes";
  if (normalized.includes("oil") || normalized.includes("filter")) return "Oil & Filters";
  if (normalized.includes("battery")) return "Battery";
  return "Other";
}

function formatShortMoney(value: number) {
  if (value >= 1_000_000) return `LKR ${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 2)}M`;
  if (value >= 1000) return `LKR ${Math.round(value / 1000)}K`;
  return currency.format(value);
}

function linePoints(values: number[], width: number, height: number, maxValue = 100) {
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - (Math.min(value, maxValue) / maxValue) * (height - 12) - 6;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function areaPoints(values: number[], width: number, height: number, maxValue = 100) {
  return `0,${height} ${linePoints(values, width, height, maxValue)} ${width},${height}`;
}

function bucketScores(scores: TopPerformer[]) {
  const buckets = [
    { label: "Excellent (80-100)", min: 80, color: "#16a34a", count: 0 },
    { label: "Good (60-79)", min: 60, color: "#2563eb", count: 0 },
    { label: "Average (40-59)", min: 40, color: "#f97316", count: 0 },
    { label: "Needs Improvement (0-39)", min: 0, color: "#dc2626", count: 0 },
  ];
  scores.forEach((score) => {
    const bucket = buckets.find((item) => score.score >= item.min) || buckets[buckets.length - 1];
    bucket.count += 1;
  });
  return buckets;
}

function AnalyticsIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon aria-hidden="true" />;
}

export default function Analytics(props: AnalyticsProps) {
  const [rangeMode, setRangeMode] = useState<DateRangeMode>("last30");
  const [customFrom, setCustomFrom] = useState(formatDateInput(startOfLocalDay() - 30 * DAY_MS));
  const [customTo, setCustomTo] = useState(formatDateInput(startOfLocalDay()));
  const [analyticsReportModal, setAnalyticsReportModal] = useState<AnalyticsReportModal>(null);
  const today = startOfLocalDay();

  const dateWindow = useMemo(() => {
    if (rangeMode === "last7") return { start: today - 7 * DAY_MS, end: today };
    if (rangeMode === "last30") return { start: today - 30 * DAY_MS, end: today };
    return {
      start: customFrom ? startOfLocalDay(new Date(`${customFrom}T00:00:00`)) : Number.NEGATIVE_INFINITY,
      end: customTo ? startOfLocalDay(new Date(`${customTo}T00:00:00`)) : Number.POSITIVE_INFINITY,
    };
  }, [customFrom, customTo, rangeMode, today]);

  const rangeLabel = rangeMode === "last7" ? "Last 7 Days" : rangeMode === "last30" ? "Last 30 Days" : "Custom Range";

  const rangeDayCount = useMemo(() => {
    if (!Number.isFinite(dateWindow.start) || !Number.isFinite(dateWindow.end)) return rangeMode === "last7" ? 7 : 30;
    return Math.max(1, Math.round((dateWindow.end - dateWindow.start) / DAY_MS) + 1);
  }, [dateWindow.end, dateWindow.start, rangeMode]);

  const vehicleLabelMap = useMemo(
    () => props.vehicles.reduce<Record<string, string>>((acc, vehicle) => ({ ...acc, [vehicle.id]: vehicle.plate_no }), {}),
    [props.vehicles]
  );

  const filteredFuelLogs = props.fuelLogs.filter((log) => {
    const date = parseDate(log.fuel_date);
    return typeof date === "number" && date >= dateWindow.start && date <= dateWindow.end;
  });

  const filteredTrips = props.trips.filter((trip) => {
    const date = parseDate(tripDate(trip));
    return typeof date === "number" && date >= dateWindow.start && date <= dateWindow.end;
  });

  const filteredMaintenance = props.maintenance.filter((record) => {
    const date = parseDate(record.service_date);
    return typeof date === "number" && date >= dateWindow.start && date <= dateWindow.end;
  });

  const totalFuelLiters = filteredFuelLogs.reduce((sum, log) => sum + log.liters, 0);
  const maintenanceCost = filteredMaintenance.reduce((sum, record) => sum + (record.cost_lkr || 0), 0);
  const utilizedVehicleCount = new Set(filteredTrips.map((trip) => trip.vehicle_id).filter(Boolean)).size;
  const fleetUtilization = props.vehicleCount > 0 ? (utilizedVehicleCount / props.vehicleCount) * 100 : 0;
  const avgFuelPerVehicle = props.vehicleCount > 0 ? totalFuelLiters / props.vehicleCount : props.avgFuelPerVehicle;

  const utilizationTrend = useMemo(() => {
    const days = Math.min(rangeDayCount, 60);
    const start = Number.isFinite(dateWindow.end) ? dateWindow.end - (days - 1) * DAY_MS : today - (days - 1) * DAY_MS;
    const vehiclesByDate = filteredTrips.reduce<Record<string, Set<string>>>((acc, trip) => {
      const date = parseDate(tripDate(trip));
      if (typeof date !== "number") return acc;
      const key = formatDateInput(date);
      if (!acc[key]) acc[key] = new Set<string>();
      if (trip.vehicle_id) acc[key].add(trip.vehicle_id);
      return acc;
    }, {});

    return Array.from({ length: days }, (_, index) => {
      const key = formatDateInput(start + index * DAY_MS);
      const dailyVehicles = vehiclesByDate[key]?.size || 0;
      return props.vehicleCount > 0 ? Math.min(100, (dailyVehicles / props.vehicleCount) * 100) : 0;
    });
  }, [dateWindow.end, filteredTrips, props.vehicleCount, rangeDayCount, today]);

  const fuelSpendBuckets = useMemo(() => {
    const useDaily = rangeDayCount <= 14;
    const bucketSizeDays = useDaily ? 1 : 7;
    const start = Number.isFinite(dateWindow.start) ? dateWindow.start : today - (rangeDayCount - 1) * DAY_MS;
    const bucketCount = Math.max(1, Math.ceil(rangeDayCount / bucketSizeDays));
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const bucketStart = start + index * bucketSizeDays * DAY_MS;
      return {
        label: useDaily ? formatDateLabel(bucketStart) : formatWeekRange(bucketStart),
        value: 0,
      };
    });

    filteredFuelLogs.forEach((log) => {
      const date = parseDate(log.fuel_date);
      if (typeof date !== "number") return;
      const index = Math.floor((date - start) / (bucketSizeDays * DAY_MS));
      if (buckets[index]) buckets[index].value += log.cost_lkr || 0;
    });
    return buckets;
  }, [dateWindow.start, filteredFuelLogs, rangeDayCount, today]);

  const maxFuelSpendBucket = Math.max(...fuelSpendBuckets.map((row) => row.value), 1);
  const maintenanceCategories = Object.entries(
    filteredMaintenance.reduce<Record<string, number>>((acc, record) => {
      const category = normalizeServiceCategory(record.service_type || record.event_category);
      acc[category] = (acc[category] || 0) + (record.cost_lkr || 0);
        return acc;
    }, {})
  )
    .map(([category, value]) => ({ category, value }))
    .sort((a, b) => b.value - a.value);
  const maxMaintenanceCategory = Math.max(...maintenanceCategories.map((row) => row.value), 1);

  const scoreBuckets = bucketScores(props.topPerformers);
  const totalScores = Math.max(1, props.topPerformers.length);
  let scoreCursor = 0;
  const scoreDonut = `conic-gradient(${scoreBuckets
    .map((bucket) => {
      const start = scoreCursor;
      scoreCursor += (bucket.count / totalScores) * 100;
      return `${bucket.color} ${start}% ${scoreCursor}%`;
    })
    .join(", ")})`;

  const allTopPerformers = props.topPerformers;
  const topPerformers = allTopPerformers.slice(0, 5);
  const allCostHotspots = filteredMaintenance
    .filter((record) => (record.cost_lkr || 0) > 0)
    .map((record) => ({
      id: record.id,
      item: normalizeServiceCategory(record.service_type || record.event_category),
      asset: record.vehicle_id ? vehicleLabelMap[record.vehicle_id] || "Vehicle" : "Fleet",
      cost: record.cost_lkr || 0,
    }))
    .sort((a, b) => b.cost - a.cost);
  const costHotspots = allCostHotspots.slice(0, 5);
  const totalHotspotCost = Math.max(1, allCostHotspots.reduce((sum, row) => sum + row.cost, 0));
  const allRiskRows = Object.values(props.maintenancePredictionMap)
    .map((prediction) => ({
      vehicle: vehicleLabelMap[prediction.vehicle_id] || prediction.vehicle_id,
      level: prediction.risk_level,
      score: Math.round((prediction.probability || 0) * 100),
    }))
    .sort((a, b) => b.score - a.score);
  const riskRows = allRiskRows.slice(0, 5);

  return (
    <section className="section">
      <section className="analytics-page analytics-page--redesign">
        <section className="dashboard-kpis analytics-kpi-grid" aria-label="Analytics summary">
          <article className="dashboard-kpi-card dashboard-kpi-card--teal analytics-kpi-card">
            <span className="dashboard-kpi-card__icon"><AnalyticsIcon icon={PieChart} /></span>
            <div>
              <small>Fleet Utilization</small>
              <strong>{fleetUtilization.toFixed(1)}%</strong>
              <span className="dashboard-trend dashboard-trend--up">{utilizedVehicleCount} vehicles used</span>
            </div>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card--blue analytics-kpi-card">
            <span className="dashboard-kpi-card__icon"><AnalyticsIcon icon={Fuel} /></span>
            <div>
              <small>Avg Fuel per Vehicle</small>
              <strong>{avgFuelPerVehicle.toFixed(1)} L</strong>
              <span className="dashboard-trend dashboard-trend--neutral">Selected range</span>
            </div>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card--orange analytics-kpi-card">
            <span className="dashboard-kpi-card__icon"><AnalyticsIcon icon={Wrench} /></span>
            <div>
              <small>Maintenance Cost</small>
              <strong>{formatShortMoney(maintenanceCost)}</strong>
              <span className="dashboard-trend dashboard-trend--warning">Selected range</span>
            </div>
          </article>
          <article className="dashboard-kpi-card dashboard-kpi-card--purple analytics-kpi-card">
            <span className="dashboard-kpi-card__icon"><AnalyticsIcon icon={Users} /></span>
            <div>
              <small>Driver Count</small>
              <strong>{props.driverCount}</strong>
              <span className="dashboard-trend dashboard-trend--up">{topPerformers.length} scored</span>
            </div>
          </article>
        </section>

        <section className="analytics-control-bar">
          <label className="analytics-select-control analytics-select-control--range">
            <CalendarDays aria-hidden="true" />
            <span>Range</span>
            <select value={rangeMode} onChange={(event) => setRangeMode(event.target.value as DateRangeMode)}>
              <option value="last7">Last 7 Days</option>
              <option value="last30">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
            <ChevronDown aria-hidden="true" />
          </label>
          {rangeMode === "custom" && (
            <div className="analytics-custom-range">
              <label><span>From</span><input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></label>
              <label><span>To</span><input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></label>
            </div>
          )}
          <button className="analytics-export-button" type="button" onClick={props.onExportMaintenance}>
            <Download aria-hidden="true" />
            Export
          </button>
        </section>

        <section className="analytics-chart-grid">
          <article className="analytics-board-card analytics-chart-card analytics-chart-card--wide">
            <div className="analytics-card-header">
              <h3>Fleet Utilization Trend</h3>
              <span>{rangeLabel}</span>
            </div>
            <div className="analytics-line-chart">
              <div className="analytics-line-chart__axis">{[100, 75, 50, 25, 0].map((tick) => <span key={tick}>{tick}%</span>)}</div>
              <svg viewBox="0 0 620 210" role="img" aria-label="Fleet utilization trend">
                <defs>
                  <linearGradient id="analyticsUtilizationArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#078f92" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#078f92" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {[30, 72, 114, 156].map((y) => <line key={y} x1="0" x2="620" y1={y} y2={y} className="analytics-gridline" />)}
                <polygon points={areaPoints(utilizationTrend, 620, 180)} transform="translate(0 12)" className="analytics-chart-area" />
                <polyline points={linePoints(utilizationTrend, 620, 180)} transform="translate(0 12)" className="analytics-chart-line" />
                {utilizationTrend.map((value, index) => {
                  if (index % Math.max(1, Math.floor(utilizationTrend.length / 10)) !== 0 && index !== utilizationTrend.length - 1) return null;
                  const x = index * (620 / Math.max(1, utilizationTrend.length - 1));
                  const y = 180 - (value / 100) * 168 + 12;
                  return <circle key={`${value}-${index}`} cx={x} cy={y} r="3.2" className="analytics-chart-dot" />;
                })}
              </svg>
            </div>
            <div className="analytics-chart-legend"><span><i /> Utilization (%)</span></div>
          </article>

          <article className="analytics-board-card analytics-chart-card">
            <div className="analytics-card-header">
              <h3>Fuel Spend by {rangeDayCount <= 14 ? "Day" : "Week"}</h3>
              <span>{rangeLabel}</span>
            </div>
            <div className="analytics-bar-chart" style={{ "--analytics-bar-count": fuelSpendBuckets.length } as CSSProperties}>
              {fuelSpendBuckets.map((row) => (
                <div className="analytics-bar" key={row.label}>
                  <strong>{formatShortMoney(row.value).replace("LKR ", "")}</strong>
                  <div><span style={{ height: `${Math.max(4, (row.value / maxFuelSpendBucket) * 100)}%` }} /></div>
                  <small>{row.label}</small>
                </div>
              ))}
            </div>
            <div className="analytics-chart-legend"><span><i /> Fuel Spend (LKR)</span></div>
          </article>

          <article className="analytics-board-card analytics-chart-card">
            <div className="analytics-card-header"><h3>Maintenance Cost by Category</h3><span>{rangeLabel}</span></div>
            <div className="analytics-horizontal-bars">
              {maintenanceCategories.length === 0 ? <p className="empty">No maintenance costs in this range.</p> : maintenanceCategories.slice(0, 6).map((row) => (
                <div key={row.category}>
                  <span>{row.category}</span>
                  <div><i style={{ width: `${Math.max(6, (row.value / maxMaintenanceCategory) * 100)}%` }} /></div>
                  <b>{formatShortMoney(row.value)}</b>
                </div>
              ))}
            </div>
          </article>

          <article className="analytics-board-card analytics-chart-card">
            <div className="analytics-card-header"><h3>Driver Score Distribution</h3><span>Current scores</span></div>
            <div className="analytics-donut-panel">
              <div className="analytics-score-donut" style={{ background: scoreDonut } as CSSProperties}>
                <div><strong>{props.driverCount}</strong><span>Drivers</span></div>
              </div>
              <div className="analytics-donut-legend">
                {scoreBuckets.map((bucket) => (
                  <span key={bucket.label}><i style={{ background: bucket.color }} />{bucket.label}<b>{bucket.count} ({((bucket.count / totalScores) * 100).toFixed(1)}%)</b></span>
                ))}
              </div>
            </div>
          </article>
        </section>

        <section className="analytics-bottom-grid">
          <AnalyticsTableCard title="Top Performers" linkLabel="View full leaderboard" columns={["#", "Vehicle / Driver", "Utilization", "Fuel", "Score"]} variant="performer" onViewAll={() => setAnalyticsReportModal("performer")}>
            {topPerformers.length === 0 ? <p className="empty">No driver scores available.</p> : topPerformers.map((driver, index) => (
              <div className="analytics-table-row analytics-table-row--performer" key={driver.driverId}>
                <span>{index + 1}</span><strong>{driver.driverName}</strong><span>{Math.max(0, fleetUtilization - index * 2).toFixed(1)}%</span><span>{avgFuelPerVehicle.toFixed(1)} L</span><b>{driver.score}</b>
              </div>
            ))}
          </AnalyticsTableCard>
          <AnalyticsTableCard title="Cost Hotspots" linkLabel="View cost analysis" columns={["Item", "Vehicle / Category", "Impact", "% of Total"]} variant="cost" onViewAll={() => setAnalyticsReportModal("cost")}>
            {costHotspots.length === 0 ? <p className="empty">No cost hotspots in this range.</p> : costHotspots.map((row) => (
              <div className="analytics-table-row analytics-table-row--cost" key={row.id}>
                <strong>{row.item}</strong><span>{row.asset}</span><b>{currency.format(row.cost)}</b><span>{((row.cost / totalHotspotCost) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </AnalyticsTableCard>
          <AnalyticsTableCard title="Vehicle Risk Ranking" linkLabel="View risk report" columns={["#", "Vehicle", "Risk Level", "Risk Score", "Trend"]} variant="risk" onViewAll={() => setAnalyticsReportModal("risk")}>
            {riskRows.length === 0 ? <p className="empty">No ML risk predictions available.</p> : riskRows.map((row, index) => (
              <div className="analytics-table-row analytics-table-row--risk" key={`${row.vehicle}-${index}`}>
                <span>{index + 1}</span><strong>{row.vehicle}</strong><b className={`analytics-risk analytics-risk--${row.level}`}>{row.level}</b><span>{row.score}</span><em>{row.level === "low" ? "↓" : row.level === "medium" ? "→" : "↑"}</em>
              </div>
            ))}
          </AnalyticsTableCard>
        </section>

        {analyticsReportModal && (
          <div className="modal-backdrop" role="presentation">
            <div className="modal modal--wide modal--details" role="dialog" aria-modal="true" aria-label="Analytics detail report">
              <div className="modal__header">
                <div>
                  <h3>
                    {analyticsReportModal === "performer"
                      ? "Driver Performance Leaders"
                      : analyticsReportModal === "cost"
                        ? "Cost Hotspots"
                        : "Vehicle Risk Ranking"}
                  </h3>
                  <p className="modal__subtle">{rangeLabel} analytics detail view.</p>
                </div>
                <button className="modal__close" type="button" onClick={() => setAnalyticsReportModal(null)} aria-label="Close analytics report">
                  ✕
                </button>
              </div>
              <div className="modal-report-list">
                {analyticsReportModal === "performer" && (
                  allTopPerformers.length === 0 ? (
                    <p className="empty">No driver scores available.</p>
                  ) : (
                    allTopPerformers.map((driver, index) => (
                      <div className="modal-report-item" key={driver.driverId}>
                        <div className="modal-report-item__meta">
                          <span>#{index + 1} Driver</span>
                          <strong>{driver.driverName}</strong>
                          <small>{Math.max(0, fleetUtilization - index * 2).toFixed(1)}% utilization • {avgFuelPerVehicle.toFixed(1)} L average fuel</small>
                        </div>
                        <div className="modal-report-item__value">
                          <strong>{driver.score}</strong>
                          <small>Score</small>
                        </div>
                      </div>
                    ))
                  )
                )}
                {analyticsReportModal === "cost" && (
                  allCostHotspots.length === 0 ? (
                    <p className="empty">No cost hotspots in this range.</p>
                  ) : (
                    allCostHotspots.map((row, index) => (
                      <div className="modal-report-item" key={row.id}>
                        <div className="modal-report-item__meta">
                          <span>#{index + 1} Cost Hotspot</span>
                          <strong>{row.item}</strong>
                          <small>{row.asset}</small>
                        </div>
                        <div className="modal-report-item__value">
                          <strong>{currency.format(row.cost)}</strong>
                          <small>{((row.cost / totalHotspotCost) * 100).toFixed(1)}% of spend</small>
                        </div>
                      </div>
                    ))
                  )
                )}
                {analyticsReportModal === "risk" && (
                  allRiskRows.length === 0 ? (
                    <p className="empty">No ML risk predictions available.</p>
                  ) : (
                    allRiskRows.map((row, index) => (
                      <div className="modal-report-item" key={`${row.vehicle}-${index}`}>
                        <div className="modal-report-item__meta">
                          <span>#{index + 1} Vehicle</span>
                          <strong>{row.vehicle}</strong>
                          <small>{row.level.toUpperCase()} risk • trend {row.level === "low" ? "down" : row.level === "medium" ? "steady" : "up"}</small>
                        </div>
                        <div className="modal-report-item__value">
                          <strong>{row.score}</strong>
                          <small>Risk score</small>
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}

function AnalyticsTableCard(props: { title: string; linkLabel: string; columns: string[]; variant: "performer" | "cost" | "risk"; children: ReactNode; onViewAll: () => void }) {
  return (
    <article className="analytics-board-card analytics-table-card">
      <div className="analytics-card-header analytics-card-header--compact">
        <h3>{props.title}</h3>
        <button type="button" onClick={props.onViewAll}>View all</button>
      </div>
      <div className="analytics-table-list">
        <div className={`analytics-table-head analytics-table-row--${props.variant}`}>
          {props.columns.map((column) => <span key={column}>{column}</span>)}
        </div>
        {props.children}
      </div>
      <button className="analytics-text-link" type="button" onClick={props.onViewAll}>{props.linkLabel}</button>
    </article>
  );
}
