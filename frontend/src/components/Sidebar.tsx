import { NavLink } from "react-router-dom";
import {
  BarChart3,
  Bot,
  CalendarCheck,
  Car,
  ClipboardCheck,
  FileBarChart,
  FileText,
  Fuel,
  Gauge,
  LayoutDashboard,
  Map,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

type SidebarProps = {
  role?: string | null;
  collapsed?: boolean;
  onCollapseToggle?: () => void;
  onCloseMobile?: () => void;
};

type NavItemConfig = {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
};

type IconName =
  | "dashboard"
  | "trips"
  | "fleet"
  | "drivers"
  | "maintenance"
  | "bookings"
  | "fuel"
  | "documents"
  | "compliance"
  | "analytics"
  | "ml"
  | "reports"
  | "service";

function NavIcon({ name }: { name: IconName }) {
  const icons: Record<IconName, LucideIcon> = {
    dashboard: LayoutDashboard,
    trips: Map,
    fleet: Car,
    drivers: Users,
    maintenance: Wrench,
    bookings: CalendarCheck,
    fuel: Fuel,
    documents: FileText,
    compliance: ClipboardCheck,
    analytics: BarChart3,
    ml: Bot,
    reports: FileBarChart,
    service: Gauge,
  };
  const Icon = icons[name];
  return <Icon aria-hidden="true" />;
}

const managerNav: NavItemConfig[] = [
  { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/trips", label: "Trips", icon: "trips" },
  { to: "/management", label: "Fleet Management", icon: "fleet" },
  { to: "/drivers", label: "Drivers", icon: "drivers" },
  { to: "/maintenance", label: "Maintenance", icon: "maintenance" },
  { to: "/fuel", label: "Fuel Analytics", icon: "fuel" },
  { to: "/documents", label: "Documents", icon: "documents" },
  { to: "/compliance", label: "Compliance", icon: "compliance" },
  { to: "/analytics", label: "Analytics", icon: "analytics" },
  { to: "/ml", label: "ML Predictions", icon: "ml" },
  { to: "/reports", label: "Reports", icon: "reports" },
];

const managerNavGroups = [
  { label: "Operations", items: managerNav.slice(0, 5) },
  { label: "Insights", items: managerNav.slice(5, 10) },
  { label: "Outputs", items: managerNav.slice(10) },
];

const serviceNav: NavItemConfig[] = [
  { to: "/service", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/service/bookings", label: "Service Bookings", icon: "bookings" },
];

export default function Sidebar({
  role,
  collapsed = false,
  onCollapseToggle,
  onCloseMobile,
}: SidebarProps) {
  const isDriver = role === "driver";
  const isService = role === "service";
  const shellLabel = isDriver ? "Driver Console" : isService ? "Service Console" : "Manager Console";
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  function navClass(isActive: boolean) {
    return `nav-item${isActive ? " active" : ""}`;
  }

  return (
    <aside className={`sidebar${collapsed ? " sidebar--collapsed" : ""}`}>
      <div className="sidebar__brand">
        <span className="sidebar__brand-icon" aria-hidden="true">
          <img src="/icons/fleetlanka-logo.png" alt="" />
        </span>
        <div className="sidebar__brand-copy">
          <strong>FleetLanka</strong>
          <span>{shellLabel}</span>
        </div>
      </div>

      <nav className="sidebar__nav">
        {isDriver ? (
          <NavLink to="/driver" className={({ isActive }) => navClass(isActive)} onClick={onCloseMobile}>
            <span className="nav-item__icon">
              <NavIcon name="trips" />
            </span>
            <span className="nav-item__label">Driver Trips</span>
          </NavLink>
        ) : isService ? (
          serviceNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => navClass(isActive)}
              onClick={onCloseMobile}
              title={collapsed ? item.label : undefined}
            >
              <span className="nav-item__icon">
                <NavIcon name={item.icon} />
              </span>
              <span className="nav-item__label">{item.label}</span>
            </NavLink>
          ))
        ) : (
          managerNavGroups.map((group) => (
            <div className="sidebar__nav-section" key={group.label}>
              <div className="sidebar__nav-label">{group.label}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => navClass(isActive)}
                  onClick={onCloseMobile}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="nav-item__icon">
                    <NavIcon name={item.icon} />
                  </span>
                  <span className="nav-item__label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))
        )}
      </nav>

      {!isDriver && (
        <div className="sidebar__utility">
          <button
            className="sidebar__collapse"
            type="button"
            onClick={onCollapseToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <CollapseIcon aria-hidden="true" />
            <span>{collapsed ? "Expand" : "Collapse"}</span>
          </button>
        </div>
      )}
    </aside>
  );
}
