import { NavLink } from "react-router-dom";

type SidebarProps = {
  role?: string | null;
};

export default function Sidebar({ role }: SidebarProps) {
  const isDriver = role === "driver";
  const isService = role === "service";

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__brand-icon">🚐</span>
        FleetLanka
      </div>

      <nav className="sidebar__nav">
        {isDriver ? (
          <NavLink
            to="/driver"
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            <span className="nav-item__icon">🗺️</span>
            Driver Trips
          </NavLink>
        ) : isService ? (
          <>
            <NavLink
              to="/service"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <span className="nav-item__icon">🏪</span>
              Dashboard
            </NavLink>
          </>
        ) : (
          <>
            <NavLink
              to="/dashboard"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <span className="nav-item__icon">📊</span>
              Dashboard
            </NavLink>
            <NavLink
              to="/management"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <span className="nav-item__icon">🚚</span>
              Fleet Management
            </NavLink>
            <NavLink
              to="/drivers"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <span className="nav-item__icon">👤</span>
              Drivers
            </NavLink>
            <NavLink
              to="/maintenance"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <span className="nav-item__icon">🔧</span>
              Maintenance
            </NavLink>
            <NavLink
              to="/fuel"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <span className="nav-item__icon">⛽</span>
              Fuel Analytics
            </NavLink>
            <NavLink
              to="/documents"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <span className="nav-item__icon">📄</span>
              Documents
            </NavLink>
            <NavLink
              to="/compliance"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <span className="nav-item__icon">✅</span>
              Compliance
            </NavLink>
            <NavLink
              to="/analytics"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <span className="nav-item__icon">📈</span>
              Analytics
            </NavLink>
            <NavLink
              to="/ml"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <span className="nav-item__icon">🤖</span>
              ML Predictions
            </NavLink>
            <NavLink
              to="/reports"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <span className="nav-item__icon">📋</span>
              Reports
            </NavLink>
          </>
        )}
      </nav>

    </aside>
  );
}
