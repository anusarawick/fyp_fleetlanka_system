import { NavLink } from "react-router-dom";

type SidebarProps = {
  role?: string | null;
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
  switch (name) {
    case "dashboard":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 13h7V4H4v9Zm9 7h7V4h-7v16ZM4 20h7v-5H4v5Z" fill="currentColor" />
        </svg>
      );
    case "trips":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 18 19 6M13 6h6v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "fleet":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 16V9l3-3h9l3 3v7M7 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "drivers":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "maintenance":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m14.7 6.3 3 3-8.9 8.9-3.6.6.6-3.6 8.9-8.9ZM13 8l3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "bookings":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 3v3m8-3v3M5 8h14M6 5h12a1 1 0 0 1 1 1v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Zm3 7h6m-6 4h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "fuel":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 21h8V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v16Zm8-11h2l2 2v5a2 2 0 0 1-2 2h-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "documents":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 3h7l4 4v14H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 0v4h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "compliance":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m5 13 4 4L19 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "analytics":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 19V9m7 10V5m7 14v-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "ml":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 3v4m6-4v4m-9 4h12m-9 4h.01m6 0h.01M5 7h14a2 2 0 0 1 2 2v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "reports":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 18h12M6 14h12M6 10h7M8 3h8l3 3v15H5V6l3-3Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "service":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 19h16M6 19V9l6-4 6 4v10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
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

const serviceNav: NavItemConfig[] = [
  { to: "/service", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/service/bookings", label: "Service Bookings", icon: "bookings" },
];

export default function Sidebar({ role }: SidebarProps) {
  const isDriver = role === "driver";
  const isService = role === "service";
  const shellLabel = isDriver ? "Driver Console" : isService ? "Service Console" : "Manager Console";

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__brand-icon" aria-hidden="true">
          FL
        </span>
        <div className="sidebar__brand-copy">
          <strong>FleetLanka</strong>
          <span>{shellLabel}</span>
        </div>
      </div>

      <nav className="sidebar__nav">
        {isDriver ? (
          <NavLink to="/driver" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
            <span className="nav-item__icon">
              <NavIcon name="trips" />
            </span>
            Driver Trips
          </NavLink>
        ) : isService ? (
          serviceNav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
              <span className="nav-item__icon">
                <NavIcon name={item.icon} />
              </span>
              {item.label}
            </NavLink>
          ))
        ) : (
          managerNav.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
              <span className="nav-item__icon">
                <NavIcon name={item.icon} />
              </span>
              {item.label}
            </NavLink>
          ))
        )}
      </nav>
    </aside>
  );
}
