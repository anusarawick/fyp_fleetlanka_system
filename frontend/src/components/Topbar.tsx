import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

type TopbarProps = {
  title: string;
  subtitle?: string;
  userName?: string;
  userRole?: string;
  onSignOut?: () => void;
};

export default function Topbar({
  title,
  subtitle,
  userName = "Manager",
  userRole = "manager",
  onSignOut
}: TopbarProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const roleLabel =
    userRole === "manager" || userRole === "owner"
      ? "Fleet Manager"
      : userRole === "service"
        ? "Service Center"
        : "Driver";
  const initials = userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "MG";

  return (
    <header className="topbar">
      <div className="topbar__title">
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>

      <div className="topbar__actions">
        {/* Notification Icon */}
        <button className="topbar__icon-btn" title="Notifications">
          <span className="topbar__icon">🔔</span>
        </button>

        {/* Profile Dropdown */}
        <div className="topbar__profile" ref={dropdownRef}>
          <button
            className="topbar__profile-btn"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <div className="topbar__avatar">{initials}</div>
            <div className="topbar__user-info">
              <span className="topbar__user-name">{userName}</span>
              <span className="topbar__user-role">{roleLabel}</span>
            </div>
            <span className="topbar__chevron">{showDropdown ? "▲" : "▼"}</span>
          </button>

          {showDropdown && (
            <div className="topbar__dropdown">
              <button
                className="topbar__dropdown-item"
                onClick={() => {
                  setShowDropdown(false);
                  navigate("/profile");
                }}
              >
                <span>👤</span>
                <span>Profile Settings</span>
              </button>
              <div className="topbar__dropdown-divider"></div>
              {onSignOut && (
                <button
                  className="topbar__dropdown-item topbar__dropdown-item--danger"
                  onClick={() => {
                    setShowDropdown(false);
                    onSignOut();
                  }}
                >
                  <span>🚪</span>
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
