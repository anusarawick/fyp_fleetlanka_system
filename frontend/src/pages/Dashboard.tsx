import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Fuel,
  MapPinned,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import MapView from "../components/MapView";
import {
  DriverScore,
  FuelForecast,
  LiveTrip,
  Maintenance,
  MaintenancePrediction,
  ServiceBooking,
  Vehicle,
} from "../types";

type DashboardProps = {
  vehicleCount: number;
  activeTrips: number;
  fuelCostTotal: string;
  maintenance: Maintenance[];
  vehicles: Vehicle[];
  driverScores: DriverScore[];
  serviceBookings: ServiceBooking[];
  topPerformers: Array<{ driverId: string; driverName: string; score: number }>;
  maintenancePredictionMap: Record<string, MaintenancePrediction>;
  liveTrips: LiveTrip[];
  alerts: { title: string; meta: string }[];
  upcomingDocs: { id: string; doc_type: string; expiry_date?: string }[];
  fuelForecasts: FuelForecast[];
};

type DashboardIconName = "fleet" | "trips" | "fuel" | "risk";
type DashboardAlertFilter = "all" | "documents" | "maintenance" | "approvals" | "ml";
type DashboardAlertCategory = Exclude<DashboardAlertFilter, "all">;

type DashboardAlertRow = {
  id: string;
  priority: "High" | "Medium";
  category: "Documents" | "Maintenance" | "Approvals" | "ML Risk";
  filter: DashboardAlertCategory;
  item: string;
  details: string;
  dueDate: string;
  asset: string;
  action: string;
  to: string;
};

function DashboardIcon({ name }: { name: DashboardIconName }) {
  const icons: Record<DashboardIconName, LucideIcon> = {
    fleet: Car,
    trips: MapPinned,
    fuel: Fuel,
    risk: AlertTriangle,
  };
  const Icon = icons[name];
  return <Icon aria-hidden="true" />;
}

function formatDate(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

function formatRiskLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function bookingStatusClass(status?: string) {
  const normalized = (status || "pending").toLowerCase();
  if (normalized === "completed") return "status-badge--success";
  if (normalized === "confirmed" || normalized === "in_progress") return "status-badge--info";
  if (normalized === "cancelled" || normalized === "rejected") return "status-badge--danger";
  return "status-badge--warning";
}

function ratingForScore(score: number) {
  if (score >= 85) return { label: "Excellent", className: "status-badge--success" };
  if (score >= 70) return { label: "Good", className: "status-badge--info" };
  if (score >= 55) return { label: "Average", className: "status-badge--warning" };
  return { label: "Needs work", className: "status-badge--danger" };
}

function shortChartDate(daysFromToday: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function Dashboard({
  vehicleCount,
  activeTrips,
  fuelCostTotal,
  vehicles,
  driverScores,
  serviceBookings,
  topPerformers,
  maintenancePredictionMap,
  liveTrips,
  alerts,
  upcomingDocs,
  fuelForecasts,
}: DashboardProps) {
  const [activeAlertFilter, setActiveAlertFilter] = useState<DashboardAlertFilter>("all");

  const liveVehicleIds = useMemo(
    () => new Set(liveTrips.map((trip) => trip.vehicle_id).filter(Boolean)),
    [liveTrips]
  );

  const riskRows = useMemo(() => {
    const predictions = Object.values(maintenancePredictionMap);
    const counts = {
      high: predictions.filter((row) => row.risk_level === "high").length,
      medium: predictions.filter((row) => row.risk_level === "medium").length,
      low: predictions.filter((row) => row.risk_level === "low").length,
    };
    const none = Math.max(0, vehicles.length - predictions.length);
    const total = Math.max(1, vehicles.length);
    return [
      { key: "high", label: "High", count: counts.high, className: "dashboard-dot--danger" },
      { key: "medium", label: "Medium", count: counts.medium, className: "dashboard-dot--warning" },
      { key: "low", label: "Low", count: counts.low, className: "dashboard-dot--amber" },
      { key: "none", label: "None", count: none, className: "dashboard-dot--success" },
    ].map((row) => ({ ...row, percent: (row.count / total) * 100 }));
  }, [maintenancePredictionMap, vehicles.length]);

  const riskDonutStyle = useMemo(() => {
    let cursor = 0;
    const colors: Record<string, string> = {
      high: "#dc2626",
      medium: "#f97316",
      low: "#f59e0b",
      none: "#15803d",
    };
    const parts = riskRows.map((row) => {
      const start = cursor;
      cursor += row.percent;
      return `${colors[row.key]} ${start}% ${cursor}%`;
    });
    return { background: `conic-gradient(${parts.join(", ")})` };
  }, [riskRows]);

  const vehicleStatusRows = useMemo(() => {
    const statusOf = (vehicle: Vehicle) => (vehicle.status || "active").toLowerCase();
    const inMaintenance = vehicles.filter((vehicle) => statusOf(vehicle) === "maintenance").length;
    const outOfService = vehicles.filter((vehicle) =>
      ["inactive", "out_of_service", "out of service"].includes(statusOf(vehicle))
    ).length;
    const active = vehicles.filter((vehicle) => statusOf(vehicle) === "active" && liveVehicleIds.has(vehicle.id)).length;
    const idle = Math.max(
      0,
      vehicles.filter((vehicle) => statusOf(vehicle) === "active").length - active
    );
    const total = Math.max(1, vehicles.length);
    return [
      { label: "Active", count: active, className: "dashboard-meter--success" },
      { label: "Idle", count: idle, className: "dashboard-meter--info" },
      { label: "In Maintenance", count: inMaintenance, className: "dashboard-meter--warning" },
      { label: "Out of Service", count: outOfService, className: "dashboard-meter--danger" },
    ].map((row) => ({ ...row, percent: (row.count / total) * 100 }));
  }, [liveVehicleIds, vehicles]);

  const complianceRows = useMemo(() => {
    const docCount = (patterns: string[]) =>
      upcomingDocs.filter((doc) => {
        const label = doc.doc_type.toLowerCase();
        return patterns.some((pattern) => label.includes(pattern));
      }).length;
    return [
      { label: "Licences", value: docCount(["licence", "license"]), icon: FileText, className: "dashboard-compliance--danger" },
      { label: "Insurance", value: docCount(["insurance"]), icon: ShieldCheck, className: "dashboard-compliance--warning" },
      { label: "Road Tax", value: docCount(["tax"]), icon: ClipboardCheck, className: "dashboard-compliance--warning" },
      { label: "Fitness Certificates", value: docCount(["fitness", "certificate"]), icon: CheckCircle2, className: "dashboard-compliance--success" },
    ];
  }, [upcomingDocs]);

  const leaderboard = useMemo(() => {
    if (topPerformers.length > 0) {
      return topPerformers.slice(0, 5).map((row) => ({
        id: row.driverId,
        name: row.driverName,
        score: row.score,
      }));
    }
    const latestByDriver = new Map<string, DriverScore>();
    for (const row of driverScores) {
      if (!latestByDriver.has(row.driver_id)) latestByDriver.set(row.driver_id, row);
    }
    return Array.from(latestByDriver.values())
      .sort((a, b) => b.overall_score - a.overall_score)
      .slice(0, 5)
      .map((row) => ({
        id: row.driver_id,
        name: row.driver_name || "Driver",
        score: row.overall_score,
      }));
  }, [driverScores, topPerformers]);

  const serviceRows = useMemo(() => {
    return [...serviceBookings]
      .sort((a, b) => new Date(b.requested_date).getTime() - new Date(a.requested_date).getTime())
      .slice(0, 5)
      .map((booking) => {
        const vehicle = vehicles.find((item) => item.id === booking.vehicle_id);
        return {
          id: booking.id,
          vehicle: vehicle?.plate_no || "Vehicle",
          date: formatDate(booking.requested_date),
          workType: booking.work_type || booking.notes || "Service",
          status: booking.status || "pending",
        };
      });
  }, [serviceBookings, vehicles]);

  const alertRows = useMemo<DashboardAlertRow[]>(() => {
    const highRisk = Object.values(maintenancePredictionMap)
      .filter((row) => row.risk_level === "high")
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 2)
      .map<DashboardAlertRow>((row) => {
        const vehicle = vehicles.find((item) => item.id === row.vehicle_id);
        return {
          id: row.id,
          priority: "High",
          category: "ML Risk",
          filter: "ml",
          item: "High Risk Vehicle",
          details: `${formatRiskLabel(row.risk_level)} maintenance risk at ${(row.probability * 100).toFixed(1)}%`,
          dueDate: "--",
          asset: vehicle?.plate_no || "Vehicle",
          action: "View Insights",
          to: "/ml",
        };
      });
    const docRows = upcomingDocs.slice(0, 2).map<DashboardAlertRow>((doc) => ({
      id: doc.id,
      priority: "High",
      category: "Documents",
      filter: "documents",
      item: `${doc.doc_type} Expiry`,
      details: doc.expiry_date ? `Expires on ${formatDate(doc.expiry_date)}` : "Expiry date needs review",
      dueDate: formatDate(doc.expiry_date),
      asset: "Fleet record",
      action: "Renew Now",
      to: "/documents",
    }));
    const bookingRows = serviceBookings
      .filter((booking) => (booking.completion_review_status || "") === "pending")
      .slice(0, 1)
      .map<DashboardAlertRow>((booking) => {
        const vehicle = vehicles.find((item) => item.id === booking.vehicle_id);
        return {
          id: booking.id,
          priority: "Medium",
          category: "Approvals",
          filter: "approvals",
          item: "Booking Approval",
          details: "Completed service booking requires manager review",
          dueDate: formatDate(booking.requested_date),
          asset: vehicle?.plate_no || "Vehicle",
          action: "Review",
          to: "/maintenance",
        };
      });
    const builtAlerts = alerts.slice(0, 2).map<DashboardAlertRow>((alert, index) => ({
      id: `alert-${index}`,
      priority: index === 0 ? "High" : "Medium",
      category: "Maintenance",
      filter: "maintenance",
      item: alert.title,
      details: alert.meta,
      dueDate: "--",
      asset: "Fleet record",
      action: "Schedule Service",
      to: "/compliance",
    }));
    return [...docRows, ...bookingRows, ...highRisk, ...builtAlerts].slice(0, 6);
  }, [alerts, maintenancePredictionMap, serviceBookings, upcomingDocs, vehicles]);

  const fuelSummary = useMemo(() => {
    const forecastTotal = fuelForecasts.reduce((sum, row) => sum + row.forecast_liters_7d, 0);
    const recentTotal = fuelForecasts.reduce((sum, row) => sum + row.recent_7d_liters, 0);
    const maxValue = Math.max(1, forecastTotal, recentTotal);
    const hasForecastData = fuelForecasts.length > 0;
    const chartMax = Math.max(1, recentTotal, forecastTotal) * 1.12;
    const yForValue = (value: number) => 106 - (value / chartMax) * 78;
    const actualValues = [0.42, 0.56, 0.72, 0.9, 1].map((ratio) => recentTotal * ratio);
    const forecastValues = [recentTotal, recentTotal + (forecastTotal - recentTotal) * 0.34, recentTotal + (forecastTotal - recentTotal) * 0.68, forecastTotal];
    const actualPoints = actualValues.map((value, index) => ({
      x: 46 + index * 45,
      y: yForValue(value),
    }));
    const forecastPoints = forecastValues.map((value, index) => ({
      x: 226 + index * 40,
      y: yForValue(value),
    }));
    const yTicks = [chartMax, chartMax / 2, 0].map((value) => Math.round(value));
    return {
      forecastTotal,
      recentTotal,
      deltaPercent: ((forecastTotal - recentTotal) / maxValue) * 100,
      hasForecastData,
      actualPath: actualPoints.map((point) => `${point.x},${point.y}`).join(" "),
      forecastPath: forecastPoints.map((point) => `${point.x},${point.y}`).join(" "),
      actualAreaPath: `M ${actualPoints[0].x},106 ${actualPoints.map((point) => `L ${point.x},${point.y}`).join(" ")} L ${actualPoints[actualPoints.length - 1].x},106 Z`,
      forecastAreaPath: `M 226,106 ${forecastPoints.map((point) => `L ${point.x},${point.y}`).join(" ")} L ${forecastPoints[forecastPoints.length - 1].x},106 Z`,
      yTicks,
      xLabels: [
        { x: 46, label: shortChartDate(-14) },
        { x: 136, label: shortChartDate(-7) },
        { x: 226, label: shortChartDate(0) },
        { x: 306, label: shortChartDate(7) },
      ],
    };
  }, [fuelForecasts]);

  const staleTrips = liveTrips.filter((trip) => trip.stale).length;
  const openRiskCount = riskRows.find((row) => row.key === "high")?.count || 0;
  const alertCounts = {
    all: alertRows.length,
    documents: alertRows.filter((row) => row.filter === "documents").length,
    maintenance: alertRows.filter((row) => row.filter === "maintenance").length,
    approvals: alertRows.filter((row) => row.filter === "approvals").length,
    ml: alertRows.filter((row) => row.filter === "ml").length,
  };
  const filteredAlertRows =
    activeAlertFilter === "all"
      ? alertRows
      : alertRows.filter((row) => row.filter === activeAlertFilter);
  const alertTabs: Array<{
    key: DashboardAlertFilter;
    label: string;
    count: number;
    icon?: LucideIcon;
  }> = [
    { key: "all", label: "All", count: alertCounts.all },
    { key: "documents", label: "Documents", count: alertCounts.documents, icon: FileText },
    { key: "maintenance", label: "Maintenance", count: alertCounts.maintenance, icon: Wrench },
    { key: "approvals", label: "Approvals", count: alertCounts.approvals, icon: ClipboardCheck },
    { key: "ml", label: "ML Risk", count: alertCounts.ml, icon: AlertTriangle },
  ];

  return (
    <section className="dashboard-redesign">
      <section className="dashboard-kpis" aria-label="Fleet summary">
        <div className="dashboard-kpi-card dashboard-kpi-card--teal">
          <span className="dashboard-kpi-card__icon"><DashboardIcon name="fleet" /></span>
          <div>
            <span className="dashboard-kpi-card__label">Total Vehicles</span>
            <strong>{vehicleCount}</strong>
            <small className="dashboard-trend dashboard-trend--positive">Fleet register</small>
          </div>
        </div>
        <div className="dashboard-kpi-card dashboard-kpi-card--blue">
          <span className="dashboard-kpi-card__icon"><DashboardIcon name="trips" /></span>
          <div>
            <span className="dashboard-kpi-card__label">Active Trips</span>
            <strong>{activeTrips}</strong>
            <small className="dashboard-trend dashboard-trend--live">Live now</small>
          </div>
        </div>
        <div className="dashboard-kpi-card dashboard-kpi-card--green">
          <span className="dashboard-kpi-card__icon"><DashboardIcon name="fuel" /></span>
          <div>
            <span className="dashboard-kpi-card__label">Fuel Spend This Month</span>
            <strong>{fuelCostTotal}</strong>
            <small className="dashboard-trend dashboard-trend--danger">Logged spend</small>
          </div>
        </div>
        <div className="dashboard-kpi-card dashboard-kpi-card--orange">
          <span className="dashboard-kpi-card__icon"><DashboardIcon name="risk" /></span>
          <div>
            <span className="dashboard-kpi-card__label">Open Maintenance Risks</span>
            <strong>{openRiskCount}</strong>
            <small className="dashboard-trend dashboard-trend--warning">High priority</small>
          </div>
        </div>
      </section>

      <section className="dashboard-primary-grid">
        <article className="dashboard-panel dashboard-panel--map">
          <div className="dashboard-panel__header">
            <h2>Live Trips Map Snapshot</h2>
            <Link className="dashboard-outline-link" to="/trips">View All Trips</Link>
          </div>
          <div className="dashboard-map-frame">
            <MapView trips={liveTrips} />
            <div className="dashboard-map-legend">
              <span><i className="dashboard-dot dashboard-dot--live" />Live ({liveTrips.length})</span>
              <span><i className="dashboard-dot dashboard-dot--stale" />Stale ({staleTrips})</span>
            </div>
          </div>
        </article>

        <article className="dashboard-panel dashboard-panel--health">
          <div className="dashboard-panel__header">
            <h2>Fleet Health Summary</h2>
          </div>
          <div className="dashboard-health-grid">
            <div className="dashboard-health-block">
              <h3>Maintenance Risk Distribution</h3>
              <div className="dashboard-risk-layout">
                <div className="dashboard-risk-donut" style={riskDonutStyle}>
                  <span />
                </div>
                <div className="dashboard-risk-list">
                  {riskRows.map((row) => (
                    <div className="dashboard-risk-row" key={row.key}>
                      <span><i className={`dashboard-dot ${row.className}`} />{row.label}</span>
                      <strong>{row.count} ({formatPercent(row.percent)})</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="dashboard-health-block">
              <h3>Vehicle Activity</h3>
              <div className="dashboard-meter-list">
                {vehicleStatusRows.map((row) => (
                  <div className="dashboard-meter-row" key={row.label}>
                    <span>{row.label}</span>
                    <div className="dashboard-meter">
                      <i className={row.className} style={{ width: `${Math.max(4, row.percent)}%` }} />
                    </div>
                    <strong>{row.count} ({formatPercent(row.percent)})</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="dashboard-compliance">
            <h3>Compliance Priority</h3>
            <div className="dashboard-compliance-grid">
              {complianceRows.map(({ icon: Icon, ...row }) => (
                <Link className={`dashboard-compliance-item ${row.className}`} to="/documents" key={row.label}>
                  <Icon aria-hidden="true" />
                  <strong>{row.value}</strong>
                  <span>{row.label}</span>
                  <small>Expiring soon</small>
                </Link>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-secondary-grid">
        <article className="dashboard-panel dashboard-panel--bookings">
          <div className="dashboard-panel__header">
            <h2>Driver Performance</h2>
            <Link className="dashboard-outline-link" to="/drivers">View All Drivers</Link>
          </div>
          {leaderboard.length === 0 ? (
            <p className="dashboard-empty">No driver score snapshots available yet.</p>
          ) : (
            <div className="dashboard-mini-table dashboard-driver-table">
              <div className="dashboard-mini-table__head">
                <span>#</span><span>Driver</span><span>Score</span><span>Safety</span>
              </div>
              {leaderboard.map((driver, index) => {
                const rating = ratingForScore(driver.score);
                return (
                  <div className="dashboard-mini-table__row" key={driver.id}>
                    <span>{index + 1}</span>
                    <strong>{driver.name}</strong>
                    <span>{driver.score}</span>
                    <span className={`status-badge ${rating.className}`}>{rating.label}</span>
                  </div>
                );
              })}
            </div>
          )}
          <Link className="dashboard-text-link" to="/drivers">View full leaderboard</Link>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel__header">
            <h2>Fuel Forecast</h2>
            <span className="dashboard-static-chip">Next 7 Days</span>
          </div>
          <div className="dashboard-fuel-chart">
            <div className="dashboard-chart-heading">
              <span>Forecast vs Actual (L)</span>
              <div className="dashboard-chart-legend">
                <span><i className="dashboard-line dashboard-line--actual" />Actual</span>
                <span><i className="dashboard-line dashboard-line--forecast" />Forecast</span>
              </div>
            </div>
            {fuelSummary.hasForecastData ? (
              <svg className="dashboard-fuel-line-chart" viewBox="0 0 360 140" role="img" aria-label="Forecast versus actual fuel trend">
                <rect className="dashboard-chart-forecast-zone" x="226" y="18" width="126" height="88" />
                {fuelSummary.yTicks.map((tick, index) => {
                  const y = 18 + index * 44;
                  return (
                    <g className="dashboard-chart-gridline" key={`${tick}-${index}`}>
                      <text x="4" y={y + 4}>{tick}L</text>
                      <line x1="32" x2="352" y1={y} y2={y} />
                    </g>
                  );
                })}
                <path className="dashboard-chart-actual-area" d={fuelSummary.actualAreaPath} />
                <path className="dashboard-chart-forecast-area" d={fuelSummary.forecastAreaPath} />
                <polyline className="dashboard-chart-actual" points={fuelSummary.actualPath} />
                <polyline className="dashboard-chart-forecast" points={fuelSummary.forecastPath} />
                {fuelSummary.xLabels.map((label) => (
                  <text className="dashboard-chart-x-label" x={label.x} y="128" key={label.label}>{label.label}</text>
                ))}
              </svg>
            ) : (
              <p className="dashboard-empty dashboard-empty--chart">No fuel forecast available yet.</p>
            )}
          </div>
          <div className="dashboard-fuel-metrics">
            <div>
              <span>Forecast Demand</span>
              <strong>{fuelSummary.forecastTotal.toFixed(0)} L</strong>
            </div>
            <div>
              <span>Recent Usage</span>
              <strong>{fuelSummary.recentTotal.toFixed(0)} L</strong>
            </div>
            <div>
              <span>Forecast Gap</span>
              <strong>{fuelSummary.deltaPercent >= 0 ? "+" : ""}{fuelSummary.deltaPercent.toFixed(1)}%</strong>
            </div>
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel__header">
            <h2>Recent Service Bookings</h2>
            <Link className="dashboard-outline-link" to="/maintenance">View All</Link>
          </div>
          {serviceRows.length === 0 ? (
            <p className="dashboard-empty dashboard-empty--center">No recent service bookings yet.</p>
          ) : (
            <div className="dashboard-mini-table dashboard-booking-table">
              <div className="dashboard-mini-table__head">
                <span>Vehicle</span><span>Date</span><span>Work Type</span><span>Status</span>
              </div>
              {serviceRows.map((booking) => (
                <div className="dashboard-mini-table__row" key={booking.id}>
                  <strong>{booking.vehicle}</strong>
                  <span>{booking.date}</span>
                  <span>{booking.workType}</span>
                  <span className={`status-badge ${bookingStatusClass(booking.status)}`}>{booking.status.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <article className="dashboard-panel dashboard-panel--alerts">
        <div className="dashboard-panel__header">
          <h2>Alerts and Action Queue</h2>
          <Link className="dashboard-outline-link" to="/compliance">View All Alerts</Link>
        </div>
        <div className="dashboard-alert-tabs">
          {alertTabs.map(({ key, label, count, icon: Icon }) => (
            <button
              className={`dashboard-alert-tab ${activeAlertFilter === key ? "dashboard-alert-tab--active" : ""}`}
              type="button"
              key={key}
              onClick={() => setActiveAlertFilter(key)}
              aria-pressed={activeAlertFilter === key}
            >
              {Icon ? <Icon aria-hidden="true" /> : null}
              {label} ({count})
            </button>
          ))}
        </div>
        {filteredAlertRows.length === 0 ? (
          <p className="dashboard-empty">
            {activeAlertFilter === "all"
              ? "No alerts need review right now."
              : `No ${alertTabs.find((tab) => tab.key === activeAlertFilter)?.label.toLowerCase()} alerts need review right now.`}
          </p>
        ) : (
          <div className="dashboard-alert-table">
            <div className="dashboard-alert-table__head">
              <span>Priority</span><span>Category</span><span>Item</span><span>Details</span><span>Due Date</span><span>Vehicle / Driver</span><span>Action</span>
            </div>
            {filteredAlertRows.map((row) => (
              <div className="dashboard-alert-table__row" key={row.id}>
                <span className={`priority-pill priority-pill--${row.priority.toLowerCase()}`}>{row.priority}</span>
                <span>{row.category}</span>
                <strong>{row.item}</strong>
                <span>{row.details}</span>
                <span className={row.priority === "High" ? "dashboard-date-danger" : ""}>{row.dueDate}</span>
                <span>{row.asset}</span>
                <Link className="dashboard-table-action" to={row.to}>{row.action}</Link>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
