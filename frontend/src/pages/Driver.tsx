import { useState } from "react";

type Vehicle = {
  id: string;
  plate_no: string;
};

type Trip = {
  id: string;
  start_time: string;
  end_time?: string;
  distance_km?: number;
  start_location?: string;
  end_location?: string;
  status?: string;
};

type DriverProps = {
  vehicles: Vehicle[];
  trips: Trip[];
  loading: boolean;
  selectedVehicle: string;
  setSelectedVehicle: (v: string) => void;
  activeTripId: string | null;
  startTrip: () => void;
  stopTrip: () => void;
  geoSupported?: boolean;
  onSignOut: () => void;
};

type TabType = "home" | "trips" | "fuel" | "reports" | "profile";

export default function DriverTrips(props: DriverProps) {
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const activeTrip = props.trips.find(t => t.id === props.activeTripId);
  const completedTrips = props.trips.filter(t => t.end_time);
  const upcomingTrips = props.trips.filter(t => !t.end_time && t.id !== props.activeTripId);
  const driverScore = 87; // Mock score

  return (
    <div className="pwa-app">
      {/* Header */}
      <header className="pwa-header">
        <div className="pwa-header__user">
          <div className="pwa-avatar">KP</div>
          <div className="pwa-header__info">
            <div className="pwa-header__name">Driver</div>
            <div className="pwa-header__id">ID: #DRV-{Math.floor(Math.random() * 9000) + 1000}</div>
          </div>
        </div>
        <div className="pwa-header__actions">
          <span className="pwa-status-badge">On Duty</span>
          <button className="pwa-notif-btn" onClick={props.onSignOut}>
            🔔
          </button>
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="pwa-main">
        {/* Current Trip Card */}
        {props.activeTripId && activeTrip ? (
          <div className="pwa-trip-card">
            <div className="pwa-trip-card__header">
              <span className="pwa-trip-card__label">Current Trip</span>
              <span className="pwa-pill pwa-pill--active">In Progress</span>
            </div>
            <div className="pwa-trip-card__route">
              <span>Colombo</span>
              <span className="pwa-trip-card__arrow">→</span>
              <span>Kandy</span>
            </div>
            <div className="pwa-trip-card__progress">
              <div className="pwa-trip-card__progress-row">
                <span>Progress</span>
                <span>42.5 km / 115 km</span>
              </div>
              <div className="pwa-progress-bar">
                <div className="pwa-progress-bar__fill" style={{ width: "37%" }}></div>
              </div>
            </div>
            <div className="pwa-trip-card__stats">
              <div>
                <span className="pwa-trip-card__stats-label">ETA</span>
                <span className="pwa-trip-card__stats-value">2:45 PM</span>
              </div>
              <div>
                <span className="pwa-trip-card__stats-label">Remaining</span>
                <span className="pwa-trip-card__stats-value">1h 20m</span>
              </div>
            </div>
            <div className="pwa-trip-card__actions">
              <button className="pwa-btn pwa-btn--outline">
                <span>📍</span> View Route Map
              </button>
              <button
                className="pwa-btn pwa-btn--dark"
                onClick={props.stopTrip}
                disabled={props.loading}
              >
                {props.loading ? "Ending..." : "End Trip"}
              </button>
            </div>
          </div>
        ) : (
          /* Start Trip Card */
          <div className="pwa-start-card">
            <div className="pwa-start-card__header">
              <span>🚗</span>
              <span>Start a New Trip</span>
            </div>
            <div className="pwa-start-card__form">
              <label className="pwa-label">Select Vehicle</label>
              <select
                className="pwa-select"
                value={props.selectedVehicle}
                onChange={(e) => props.setSelectedVehicle(e.target.value)}
              >
                <option value="">Choose vehicle...</option>
                {props.vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.plate_no}</option>
                ))}
              </select>
            </div>
            <button
              className="pwa-btn pwa-btn--primary pwa-btn--full"
              onClick={props.startTrip}
              disabled={props.loading || !props.selectedVehicle}
            >
              {props.loading ? "Starting..." : "▶️ Start Trip"}
            </button>
          </div>
        )}

        {/* Driver Score */}
        <div className="pwa-score-card">
          <div className="pwa-score-circle">
            <svg viewBox="0 0 100 100">
              <circle className="pwa-score-circle__bg" cx="50" cy="50" r="45" />
              <circle
                className="pwa-score-circle__progress"
                cx="50" cy="50" r="45"
                strokeDasharray={`${driverScore * 2.83} 283`}
              />
            </svg>
            <div className="pwa-score-circle__value">
              <span className="pwa-score-circle__number">{driverScore}</span>
              <span className="pwa-score-circle__max">/100</span>
            </div>
          </div>
          <div className="pwa-score-info">
            <span className="pwa-score-label">Driver Score</span>
            <span className="pwa-pill pwa-pill--success">Excellent</span>
            <a className="pwa-link">View Details →</a>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="pwa-actions-grid">
          <button className="pwa-action-btn">
            <span className="pwa-action-btn__icon pwa-action-btn__icon--blue">⛽</span>
            <span>Log Fuel</span>
          </button>
          <button className="pwa-action-btn">
            <span className="pwa-action-btn__icon pwa-action-btn__icon--red">⚠️</span>
            <span>Report Issue</span>
          </button>
          <button className="pwa-action-btn">
            <span className="pwa-action-btn__icon pwa-action-btn__icon--green">📋</span>
            <span>My Trips</span>
          </button>
          <button className="pwa-action-btn">
            <span className="pwa-action-btn__icon pwa-action-btn__icon--gray">👤</span>
            <span>Profile</span>
          </button>
        </div>

        {/* Today's Summary */}
        <div className="pwa-section">
          <div className="pwa-section__header">
            <span>📊 Today's Summary</span>
            <span className="pwa-chevron">▼</span>
          </div>
          <div className="pwa-summary-grid">
            <div className="pwa-summary-item">
              <span className="pwa-summary-item__value">{completedTrips.length}</span>
              <span className="pwa-summary-item__label">Trips</span>
            </div>
            <div className="pwa-summary-item">
              <span className="pwa-summary-item__value">
                {completedTrips.reduce((sum, t) => sum + (t.distance_km || 0), 0).toFixed(0)}
              </span>
              <span className="pwa-summary-item__label">Km</span>
            </div>
            <div className="pwa-summary-item">
              <span className="pwa-summary-item__value">0</span>
              <span className="pwa-summary-item__label">Issues</span>
            </div>
          </div>
        </div>

        {/* Upcoming Trips */}
        <div className="pwa-section">
          <div className="pwa-section__title">Upcoming Trips</div>
          {upcomingTrips.length === 0 && !props.activeTripId ? (
            <div className="pwa-empty">
              <span>📭</span>
              <span>No upcoming trips scheduled</span>
            </div>
          ) : (
            <div className="pwa-trip-list">
              <div className="pwa-trip-item">
                <div className="pwa-trip-item__header">
                  <span className="pwa-trip-item__route">Kandy → Galle</span>
                  <span className="pwa-pill pwa-pill--scheduled">Scheduled</span>
                </div>
                <div className="pwa-trip-item__time">3:30 PM - 6:15 PM</div>
                <div className="pwa-trip-item__footer">
                  <span className="pwa-trip-item__duration">Duration: 2h 45m</span>
                  <a className="pwa-link">View Details</a>
                </div>
              </div>
              <div className="pwa-trip-item">
                <div className="pwa-trip-item__header">
                  <span className="pwa-trip-item__route">Galle → Matara</span>
                  <span className="pwa-pill pwa-pill--scheduled">Scheduled</span>
                </div>
                <div className="pwa-trip-item__time">7:00 PM - 8:30 PM</div>
                <div className="pwa-trip-item__footer">
                  <span className="pwa-trip-item__duration">Duration: 1h 30m</span>
                  <a className="pwa-link">View Details</a>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="pwa-nav">
        <button
          className={`pwa-nav__item ${activeTab === "home" ? "pwa-nav__item--active" : ""}`}
          onClick={() => setActiveTab("home")}
        >
          <span className="pwa-nav__icon">🏠</span>
          <span>Home</span>
        </button>
        <button
          className={`pwa-nav__item ${activeTab === "trips" ? "pwa-nav__item--active" : ""}`}
          onClick={() => setActiveTab("trips")}
        >
          <span className="pwa-nav__icon">🗺️</span>
          <span>Trips</span>
        </button>
        <button
          className={`pwa-nav__item ${activeTab === "fuel" ? "pwa-nav__item--active" : ""}`}
          onClick={() => setActiveTab("fuel")}
        >
          <span className="pwa-nav__icon">⛽</span>
          <span>Fuel</span>
        </button>
        <button
          className={`pwa-nav__item ${activeTab === "reports" ? "pwa-nav__item--active" : ""}`}
          onClick={() => setActiveTab("reports")}
        >
          <span className="pwa-nav__icon">📊</span>
          <span>Reports</span>
        </button>
        <button
          className={`pwa-nav__item ${activeTab === "profile" ? "pwa-nav__item--active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          <span className="pwa-nav__icon">👤</span>
          <span>Profile</span>
        </button>
      </nav>
    </div>
  );
}
