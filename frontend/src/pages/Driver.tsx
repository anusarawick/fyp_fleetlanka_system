import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../services/api";
import { useAuth } from "../context/AuthContext";

type Vehicle = {
  id: string;
  plate_no: string;
};

type Trip = {
  id: string;
  vehicle_id?: string;
  start_time: string;
  end_time?: string;
  distance_km?: number;
  duration_min?: number;
  avg_speed_kmh?: number;
  idle_min?: number;
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

type DriverProfile = {
  id: string;
  role: string;
  status?: string;
  full_name?: string;
  phone?: string;
};

type DriverProps = {
  vehicles: Vehicle[];
  trips: Trip[];
  loading: boolean;
  selectedVehicle: string;
  setSelectedVehicle: (v: string) => void;
  activeTripId: string | null;
  tripTrackingStatus: "inactive" | "tracking" | "stale" | "error";
  tripTrackingLastUpdated: string | null;
  driverScore: number;
  driverScoreLabel: "Excellent" | "Good" | "Average" | "Needs work";
  driverScoreBreakdown: {
    speed: number;
    idle: number;
    distance: number;
    consistency: number;
  };
  startTrip: () => void;
  stopTrip: () => void;
  geoSupported?: boolean;
  onSignOut: () => void;
};

type TabType = "home" | "trips" | "fuel" | "profile";

function formatDateTime(value?: string) {
  if (!value) return "Unavailable";
  return new Date(value).toLocaleString();
}

function formatDuration(minutes?: number) {
  if (!minutes || minutes <= 0) return "0 min";
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (!hours) return `${mins} min`;
  if (!mins) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export default function DriverTrips(props: DriverProps) {
  const {
    token,
    fullName,
    phone,
    email,
    role,
    loading: authLoading,
    handleUpdateProfile,
    handleChangePassword,
    setError,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [fuelLoading, setFuelLoading] = useState(false);
  const [fuelDate, setFuelDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fuelLiters, setFuelLiters] = useState("");
  const [fuelCost, setFuelCost] = useState("");
  const [fuelOdometer, setFuelOdometer] = useState("");
  const [fuelVendor, setFuelVendor] = useState("");
  const [profileName, setProfileName] = useState(fullName || "");
  const [profilePhone, setProfilePhone] = useState(phone || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const activeTrip = props.trips.find((t) => t.id === props.activeTripId);
  const activeVehicle = props.vehicles.find((vehicle) => vehicle.id === activeTrip?.vehicle_id);
  const completedTrips = useMemo(
    () =>
      props.trips
        .filter((t) => t.end_time)
        .sort((a, b) => new Date(b.end_time || b.start_time).getTime() - new Date(a.end_time || a.start_time).getTime()),
    [props.trips]
  );
  const selectedTrip = completedTrips.find((trip) => trip.id === selectedTripId) || completedTrips[0] || null;
  const scorePillClass =
    props.driverScore >= 85
      ? "pwa-pill--success"
      : props.driverScore >= 70
        ? "pwa-pill--active"
        : "pwa-pill--scheduled";

  useEffect(() => {
    setProfileName(fullName || "");
    setProfilePhone(phone || "");
  }, [fullName, phone]);

  useEffect(() => {
    if (!token) return;
    apiGet<DriverProfile>("/profiles/me", token)
      .then(setProfile)
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setFuelLoading(true);
    apiGet<FuelLog[]>("/fuel-logs", token)
      .then((rows) => setFuelLogs(rows))
      .catch((err: any) => setError(err.message || "Failed to load fuel logs"))
      .finally(() => setFuelLoading(false));
  }, [token, setError]);

  async function handleAddFuel(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    try {
      if (!fuelDate || !fuelLiters) throw new Error("Fuel date and liters are required");
      const vehicleId = props.activeTripId && activeVehicle ? activeVehicle.id : props.selectedVehicle;
      if (!vehicleId) throw new Error("Select a vehicle before logging fuel");
      const created = await apiPost<FuelLog>(
        "/fuel-logs",
        {
          vehicle_id: vehicleId,
          fuel_date: fuelDate,
          liters: Number(fuelLiters),
          cost_lkr: fuelCost ? Number(fuelCost) : undefined,
          odometer_km: fuelOdometer ? Number(fuelOdometer) : undefined,
          vendor: fuelVendor || undefined,
        },
        token
      );
      setFuelLogs((prev) => [created, ...prev]);
      setFuelDate(new Date().toISOString().slice(0, 10));
      setFuelLiters("");
      setFuelCost("");
      setFuelOdometer("");
      setFuelVendor("");
    } catch (err: any) {
      setError(err.message || "Fuel log failed");
    }
  }

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    await handleUpdateProfile(profileName, profilePhone);
    setProfile((prev) =>
      prev
        ? { ...prev, full_name: profileName, phone: profilePhone }
        : prev
    );
  }

  async function handlePasswordSave(e: FormEvent) {
    e.preventDefault();
    await handleChangePassword(currentPassword, newPassword);
    setCurrentPassword("");
    setNewPassword("");
  }

  const todayTrips = completedTrips.filter((trip) => {
    const compareDate = trip.end_time || trip.start_time;
    return new Date(compareDate).toDateString() === new Date().toDateString();
  });

  const totalKmToday = todayTrips.reduce((sum, trip) => sum + (trip.distance_km || 0), 0);

  const homeRecentTrips = completedTrips.slice(0, 3);

  const currentVehicleForFuel = activeVehicle || props.vehicles.find((vehicle) => vehicle.id === props.selectedVehicle);

  return (
    <div className="pwa-app">
      <header className="pwa-header">
        <div className="pwa-header__user">
          <div className="pwa-avatar">{(profileName || "D").slice(0, 2).toUpperCase()}</div>
          <div className="pwa-header__info">
            <div className="pwa-header__name">{profileName || "Driver"}</div>
            <div className="pwa-header__id">{email || "driver@fleetlanka.lk"}</div>
          </div>
        </div>
        <div className="pwa-header__actions">
          <span className="pwa-status-badge">
            {profile?.status === "inactive" ? "Inactive" : props.activeTripId ? "On Trip" : "Available"}
          </span>
          <button className="pwa-notif-btn" type="button" onClick={props.onSignOut} aria-label="Sign out">
            ⎋
          </button>
        </div>
      </header>

      <main className="pwa-main">
        {activeTab === "home" && (
          <>
            {props.activeTripId && activeTrip ? (
              <div className="pwa-trip-card">
                <div className="pwa-trip-card__header">
                  <span className="pwa-trip-card__label">Current Trip</span>
                  <span className="pwa-pill pwa-pill--active">In Progress</span>
                </div>
                <div className="pwa-trip-card__route pwa-trip-card__route--stacked">
                  <span>{activeVehicle?.plate_no || "Assigned Vehicle"}</span>
                  <span className="pwa-trip-card__subroute">
                    Started {new Date(activeTrip.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="pwa-trip-card__stats">
                  <div>
                    <span className="pwa-trip-card__stats-label">Tracking</span>
                    <span className="pwa-trip-card__stats-value">{props.tripTrackingStatus}</span>
                  </div>
                  <div>
                    <span className="pwa-trip-card__stats-label">Last update</span>
                    <span className="pwa-trip-card__stats-value">
                      {props.tripTrackingLastUpdated
                        ? new Date(props.tripTrackingLastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "Waiting"}
                    </span>
                  </div>
                </div>
                <div className="pwa-trip-card__tracking">
                  <span className={`pwa-pill ${
                    props.tripTrackingStatus === "tracking"
                      ? "pwa-pill--success"
                      : props.tripTrackingStatus === "stale"
                        ? "pwa-pill--scheduled"
                        : "pwa-pill--active"
                  }`}>
                    {props.tripTrackingStatus === "tracking"
                      ? "Live location active"
                      : props.tripTrackingStatus === "stale"
                        ? "Location stale"
                        : props.tripTrackingStatus === "error"
                          ? "Tracking issue"
                          : "Tracking inactive"}
                  </span>
                </div>
                <div className="pwa-trip-card__actions">
                  <button className="pwa-btn pwa-btn--outline" disabled>
                    <span>📍</span> {props.geoSupported ? "Driver tracking on" : "GPS not supported"}
                  </button>
                <button
                  className="pwa-btn pwa-btn--dark"
                  type="button"
                  onClick={props.stopTrip}
                  disabled={props.loading}
                >
                    {props.loading ? "Ending..." : "End Trip"}
                  </button>
                </div>
              </div>
            ) : (
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
                  type="button"
                  onClick={props.startTrip}
                  disabled={props.loading || !props.selectedVehicle}
                >
                  {props.loading ? "Starting..." : "Start Trip"}
                </button>
              </div>
            )}

            <div className="pwa-score-card">
              <div className="pwa-score-circle">
                <svg viewBox="0 0 100 100">
                  <circle className="pwa-score-circle__bg" cx="50" cy="50" r="45" />
                  <circle
                    className="pwa-score-circle__progress"
                    cx="50"
                    cy="50"
                    r="45"
                    strokeDasharray={`${props.driverScore * 2.83} 283`}
                  />
                </svg>
                <div className="pwa-score-circle__value">
                  <span className="pwa-score-circle__number">{props.driverScore}</span>
                  <span className="pwa-score-circle__max">/100</span>
                </div>
              </div>
              <div className="pwa-score-info">
                <span className="pwa-score-label">Driver Score</span>
                <span className={`pwa-pill ${scorePillClass}`}>{props.driverScoreLabel}</span>
              </div>
            </div>

            <div className="pwa-section">
              <div className="pwa-section__title">Score Breakdown</div>
              <p className="pwa-section__subtitle">Real driving metrics from completed trips.</p>
              <div className="pwa-summary-grid">
                <div className="pwa-summary-item">
                  <span className="pwa-summary-item__value">{props.driverScoreBreakdown.speed}</span>
                  <span className="pwa-summary-item__label">Speed</span>
                </div>
                <div className="pwa-summary-item">
                  <span className="pwa-summary-item__value">{props.driverScoreBreakdown.idle}</span>
                  <span className="pwa-summary-item__label">Idle</span>
                </div>
                <div className="pwa-summary-item">
                  <span className="pwa-summary-item__value">{props.driverScoreBreakdown.distance}</span>
                  <span className="pwa-summary-item__label">Distance</span>
                </div>
                <div className="pwa-summary-item">
                  <span className="pwa-summary-item__value">{props.driverScoreBreakdown.consistency}</span>
                  <span className="pwa-summary-item__label">Consistency</span>
                </div>
              </div>
            </div>

            <div className="pwa-actions-grid">
              <button className="pwa-action-btn" onClick={() => setActiveTab("fuel")}>
                <span className="pwa-action-btn__icon pwa-action-btn__icon--blue">⛽</span>
                <span>Log Fuel</span>
              </button>
              <button className="pwa-action-btn" onClick={() => setActiveTab("trips")}>
                <span className="pwa-action-btn__icon pwa-action-btn__icon--green">📋</span>
                <span>Trip History</span>
              </button>
              <button className="pwa-action-btn" onClick={() => setActiveTab("profile")}>
                <span className="pwa-action-btn__icon pwa-action-btn__icon--gray">👤</span>
                <span>Profile</span>
              </button>
            </div>

            <div className="pwa-section">
              <div className="pwa-section__header">
                <span>Today's Summary</span>
              </div>
              <div className="pwa-summary-grid">
                <div className="pwa-summary-item">
                  <span className="pwa-summary-item__value">{todayTrips.length}</span>
                  <span className="pwa-summary-item__label">Trips</span>
                </div>
                <div className="pwa-summary-item">
                  <span className="pwa-summary-item__value">{totalKmToday.toFixed(0)}</span>
                  <span className="pwa-summary-item__label">Km</span>
                </div>
                <div className="pwa-summary-item">
                  <span className="pwa-summary-item__value">{fuelLogs.length}</span>
                  <span className="pwa-summary-item__label">Fuel Logs</span>
                </div>
              </div>
            </div>

            <div className="pwa-section">
              <div className="pwa-section__title">Recent Trips</div>
              <p className="pwa-section__subtitle">Your latest completed trips and results.</p>
              {homeRecentTrips.length === 0 ? (
                <div className="pwa-empty">
                  <span>📭</span>
                  <span>No completed trips yet</span>
                </div>
              ) : (
                <div className="pwa-trip-list">
                  {homeRecentTrips.map((trip) => {
                    const vehicle = props.vehicles.find((v) => v.id === trip.vehicle_id);
                    return (
                      <button
                        type="button"
                        key={trip.id}
                        className="pwa-trip-item pwa-trip-item--button"
                        onClick={() => {
                          setSelectedTripId(trip.id);
                          setActiveTab("trips");
                        }}
                      >
                        <div className="pwa-trip-item__header">
                          <span className="pwa-trip-item__route">{vehicle?.plate_no || "Vehicle"}</span>
                          <span className="pwa-pill pwa-pill--success">Completed</span>
                        </div>
                        <div className="pwa-trip-item__time">{formatDateTime(trip.end_time || trip.start_time)}</div>
                        <div className="pwa-trip-item__footer">
                          <span className="pwa-trip-item__duration">
                            {trip.distance_km?.toFixed(1) || "0.0"} km • {formatDuration(trip.duration_min)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "trips" && (
          <>
            <div className="pwa-section">
              <div className="pwa-section__title">Trip History</div>
              <p className="pwa-section__subtitle">Open any trip to see the full driving summary.</p>
              {completedTrips.length === 0 ? (
                <div className="pwa-empty">
                  <span>🗺️</span>
                  <span>No completed trips available</span>
                </div>
              ) : (
                <div className="pwa-driver-grid">
                  <div className="pwa-trip-list">
                    {completedTrips.map((trip) => {
                      const vehicle = props.vehicles.find((v) => v.id === trip.vehicle_id);
                      return (
                        <button
                          type="button"
                          key={trip.id}
                          className={`pwa-trip-item pwa-trip-item--button ${selectedTrip?.id === trip.id ? "pwa-trip-item--selected" : ""}`}
                          onClick={() => setSelectedTripId(trip.id)}
                        >
                          <div className="pwa-trip-item__header">
                            <span className="pwa-trip-item__route">{vehicle?.plate_no || "Vehicle"}</span>
                            <span className="pwa-pill pwa-pill--success">Completed</span>
                          </div>
                          <div className="pwa-trip-item__time">{formatDateTime(trip.end_time || trip.start_time)}</div>
                          <div className="pwa-trip-item__footer">
                            <span className="pwa-trip-item__duration">
                              {trip.distance_km?.toFixed(1) || "0.0"} km • {formatDuration(trip.duration_min)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {selectedTrip && (
                    <div className="pwa-section pwa-section--detail">
                      <div className="pwa-section__title">Trip Details</div>
                      <div className="pwa-detail-grid">
                        <div className="pwa-detail-item">
                          <span className="pwa-detail-item__label">Vehicle</span>
                          <strong>{props.vehicles.find((v) => v.id === selectedTrip.vehicle_id)?.plate_no || "Vehicle"}</strong>
                        </div>
                        <div className="pwa-detail-item">
                          <span className="pwa-detail-item__label">Started</span>
                          <strong>{formatDateTime(selectedTrip.start_time)}</strong>
                        </div>
                        <div className="pwa-detail-item">
                          <span className="pwa-detail-item__label">Ended</span>
                          <strong>{formatDateTime(selectedTrip.end_time)}</strong>
                        </div>
                        <div className="pwa-detail-item">
                          <span className="pwa-detail-item__label">Distance</span>
                          <strong>{selectedTrip.distance_km?.toFixed(1) || "0.0"} km</strong>
                        </div>
                        <div className="pwa-detail-item">
                          <span className="pwa-detail-item__label">Duration</span>
                          <strong>{formatDuration(selectedTrip.duration_min)}</strong>
                        </div>
                        <div className="pwa-detail-item">
                          <span className="pwa-detail-item__label">Average Speed</span>
                          <strong>{selectedTrip.avg_speed_kmh?.toFixed(1) || "0.0"} km/h</strong>
                        </div>
                        <div className="pwa-detail-item">
                          <span className="pwa-detail-item__label">Idle Time</span>
                          <strong>{formatDuration(selectedTrip.idle_min)}</strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "fuel" && (
          <>
            <div className="pwa-section">
              <div className="pwa-section__title">Fuel Log</div>
              <p className="pwa-section__subtitle">Record fuel against the active or selected vehicle.</p>
              <form className="pwa-form" onSubmit={handleAddFuel}>
                <label className="pwa-form__field">
                  <span>Vehicle</span>
                  <input value={currentVehicleForFuel?.plate_no || ""} readOnly placeholder="Select or start a trip first" />
                </label>
                <label className="pwa-form__field">
                  <span>Date</span>
                  <input type="date" value={fuelDate} onChange={(e) => setFuelDate(e.target.value)} required />
                </label>
                <label className="pwa-form__field">
                  <span>Liters</span>
                  <input type="number" min="0" step="0.1" value={fuelLiters} onChange={(e) => setFuelLiters(e.target.value)} required />
                </label>
                <label className="pwa-form__field">
                  <span>Cost (LKR)</span>
                  <input type="number" min="0" step="0.01" value={fuelCost} onChange={(e) => setFuelCost(e.target.value)} />
                </label>
                <label className="pwa-form__field">
                  <span>Odometer</span>
                  <input type="number" min="0" step="1" value={fuelOdometer} onChange={(e) => setFuelOdometer(e.target.value)} />
                </label>
                <label className="pwa-form__field">
                  <span>Vendor</span>
                  <input value={fuelVendor} onChange={(e) => setFuelVendor(e.target.value)} placeholder="Station or vendor" />
                </label>
                <button className="pwa-btn pwa-btn--primary pwa-btn--full" type="submit" disabled={props.loading || authLoading}>
                  Save Fuel Log
                </button>
              </form>
            </div>

            <div className="pwa-section">
              <div className="pwa-section__title">Recent Fuel Logs</div>
              {fuelLoading ? (
                <p className="empty">Loading fuel logs...</p>
              ) : fuelLogs.length === 0 ? (
                <div className="pwa-empty">
                  <span>⛽</span>
                  <span>No fuel logs yet</span>
                </div>
              ) : (
                <div className="pwa-trip-list">
                  {fuelLogs.slice(0, 5).map((log) => {
                    const vehicle = props.vehicles.find((v) => v.id === log.vehicle_id);
                    return (
                      <div key={log.id} className="pwa-trip-item">
                        <div className="pwa-trip-item__header">
                          <span className="pwa-trip-item__route">{vehicle?.plate_no || "Vehicle"}</span>
                          <span className="pwa-pill pwa-pill--active">{log.liters.toFixed(1)} L</span>
                        </div>
                        <div className="pwa-trip-item__time">{formatDateTime(log.fuel_date)}</div>
                        <div className="pwa-trip-item__footer">
                          <span className="pwa-trip-item__duration">
                            {(log.cost_lkr || 0).toFixed(0)} LKR{log.vendor ? ` • ${log.vendor}` : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "profile" && (
          <>
            <div className="pwa-section">
              <div className="pwa-section__title">Profile</div>
              <p className="pwa-section__subtitle">Your driver account details and current status.</p>
              <div className="pwa-detail-grid">
                <div className="pwa-detail-item">
                  <span className="pwa-detail-item__label">Email</span>
                  <strong>{email || "Unavailable"}</strong>
                </div>
                <div className="pwa-detail-item">
                  <span className="pwa-detail-item__label">Role</span>
                  <strong>{role || "driver"}</strong>
                </div>
                <div className="pwa-detail-item">
                  <span className="pwa-detail-item__label">Status</span>
                  <strong>{profile?.status || "active"}</strong>
                </div>
              </div>
            </div>

            <div className="pwa-section">
              <div className="pwa-section__title">Update Details</div>
              <form className="pwa-form" onSubmit={handleProfileSave}>
                <label className="pwa-form__field">
                  <span>Full Name</span>
                  <input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
                </label>
                <label className="pwa-form__field">
                  <span>Phone</span>
                  <input value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} />
                </label>
                <button className="pwa-btn pwa-btn--primary pwa-btn--full" type="submit" disabled={authLoading}>
                  Save Profile
                </button>
              </form>
            </div>

            <div className="pwa-section">
              <div className="pwa-section__title">Change Password</div>
              <form className="pwa-form" onSubmit={handlePasswordSave}>
                <label className="pwa-form__field">
                  <span>Current Password</span>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                </label>
                <label className="pwa-form__field">
                  <span>New Password</span>
                  <input type="password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </label>
                <button className="pwa-btn pwa-btn--dark pwa-btn--full" type="submit" disabled={authLoading}>
                  Update Password
                </button>
              </form>
            </div>
          </>
        )}
      </main>

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
