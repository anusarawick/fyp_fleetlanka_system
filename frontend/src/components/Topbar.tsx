import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

type TopbarProps = {
  title: string;
  subtitle?: string;
  userName?: string;
  userRole?: string;
  onSignOut?: () => void;
};

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="topbar__icon-svg">
      <path
        d="M15 17H5.5a1.5 1.5 0 0 1-1.18-2.43L6 12.5V10a6 6 0 1 1 12 0v2.5l1.68 2.07A1.5 1.5 0 0 1 18.5 17H15Zm0 0a3 3 0 0 1-6 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserSettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="topbar__menu-icon">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="topbar__menu-icon">
      <path d="M10 17H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4m5 8 5-3-5-3m5 3H9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`topbar__chevron-icon${open ? " topbar__chevron-icon--open" : ""}`}>
      <path d="m7 10 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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
      <div className="topbar__title">
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>

      <div className="topbar__actions">
        <button className="topbar__icon-btn" title="Notifications" type="button" aria-label="Notifications">
          <BellIcon />
        </button>

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
