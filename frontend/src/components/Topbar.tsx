import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Menu, Settings } from "lucide-react";
import { useShell } from "../layout/AppLayout";
import NotificationBell from "./NotificationBell";

type TopbarProps = {
  title: string;
  subtitle?: string;
  userName?: string;
  userRole?: string;
  onSignOut?: () => void;
};

function MenuIcon() {
  return <Menu aria-hidden="true" className="topbar__icon-svg" />;
}

function UserSettingsIcon() {
  return <Settings aria-hidden="true" className="topbar__menu-icon" />;
}

function SignOutIcon() {
  return <LogOut aria-hidden="true" className="topbar__menu-icon" />;
}

function ChevronIcon({ open }: { open: boolean }) {
  return <ChevronDown aria-hidden="true" className={`topbar__chevron-icon${open ? " topbar__chevron-icon--open" : ""}`} />;
}

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
  const { canOpenSidebar, openSidebar } = useShell();

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
  const initials = userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "MG";

  return (
    <header className="topbar">
      <div className="topbar__title-group">
        {canOpenSidebar && (
          <button
            className="topbar__menu-btn"
            type="button"
            aria-label="Open navigation"
            onClick={openSidebar}
          >
            <MenuIcon />
          </button>
        )}
        <div className="topbar__title">
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
      </div>

      <div className="topbar__actions">
        <NotificationBell />

        <div className="topbar__profile" ref={dropdownRef}>
          <button
            className="topbar__profile-btn"
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <div className="topbar__avatar">{initials}</div>
            <div className="topbar__user-info">
              <span className="topbar__user-name">{userName}</span>
              <span className="topbar__user-role">{roleLabel}</span>
            </div>
            <ChevronIcon open={showDropdown} />
          </button>

          {showDropdown && (
            <div className="topbar__dropdown">
              <div className="topbar__dropdown-head">
                <span className="topbar__dropdown-head-avatar">{initials}</span>
                <div>
                  <strong>{userName}</strong>
                  <span>{roleLabel}</span>
                </div>
              </div>
              <button
                className="topbar__dropdown-item"
                onClick={() => {
                  setShowDropdown(false);
                  navigate("/profile");
                }}
              >
                <UserSettingsIcon />
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
                  <SignOutIcon />
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
