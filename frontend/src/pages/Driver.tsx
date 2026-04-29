import { FormEvent, ReactNode, SVGProps, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../services/api";
import { useAuth } from "../context/AuthContext";
import TripRoutePreview from "../components/TripRoutePreview";

type Vehicle = {
  id: string;
  plate_no: string;
};

type Trip = {
  id: string;
  vehicle_id?: string;
  status?: string;
  trip_title?: string;
  scheduled_start?: string;
  origin_label?: string;
  destination_label?: string;
  origin_lat?: number;
  origin_lon?: number;
  destination_lat?: number;
  destination_lon?: number;
  contact_name?: string;
  contact_phone?: string;
  priority?: string;
  notes?: string;
  start_time?: string;
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
  startTrip: (tripId?: string) => void;
  stopTrip: () => void;
  geoSupported?: boolean;
  onSignOut: () => void;
};

type TabType = "home" | "trips" | "fuel" | "profile";
type TripsView = "assigned" | "history";
type DriverIconName =
  | "home"
  | "route"
  | "fuel"
  | "profile"
  | "signout"
  | "details"
  | "location"
  | "play"
  | "stop"
  | "vehicle"
  | "history"
  | "calendar"
  | "phone"
  | "mail"
  | "shield"
  | "chevron"
  | "gauge"
  | "clock"
  | "distance"
  | "coins";

function formatDateTime(value?: string) {
  if (!value) return "Unavailable";
  return new Date(value).toLocaleString();
}

function formatDate(value?: string) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(value?: string) {
  if (!value) return "--";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(minutes?: number) {
  if (!minutes || minutes <= 0) return "0 min";
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (!hours) return `${mins} min`;
  if (!mins) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function deriveTripStatus(trip: Trip) {
  if (trip.status) return trip.status;
  if (trip.end_time) return "completed";
  if (trip.start_time) return "in_progress";
  return "assigned";
}

function formatPriority(value?: string) {
  if (!value) return "Normal";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getTrackingLabel(status: DriverProps["tripTrackingStatus"]) {
  switch (status) {
    case "tracking":
      return "Live";
    case "stale":
      return "Stale";
    case "error":
      return "Issue";
    default:
      return "Inactive";
  }
}

function getAvailabilityStatus(profileStatus?: string, activeTripId?: string | null) {
  if (profileStatus === "inactive") return { label: "Inactive", modifier: "inactive" };
  if (activeTripId) return { label: "On Trip", modifier: "ontrip" };
  return { label: "Online", modifier: "available" };
}

function getStatusLabel(status: string) {
  switch (status) {
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "in_progress":
      return "Live";
    default:
      return "Scheduled";
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case "completed":
      return "pwa-pill pwa-pill--success";
    case "cancelled":
      return "pwa-pill pwa-pill--danger";
    case "in_progress":
      return "pwa-pill pwa-pill--live";
    default:
      return "pwa-pill pwa-pill--scheduled";
  }
}

function DriverIcon({ name, className }: { name: DriverIconName; className?: string }) {
  const props: SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": true,
  };

  switch (name) {
    case "home":
      return <svg {...props}><path d="M4 10.5 12 4l8 6.5" /><path d="M6.5 9.5V20h11V9.5" /></svg>;
    case "route":
      return <svg {...props}><circle cx="6.5" cy="7" r="2.5" /><circle cx="17.5" cy="17" r="2.5" /><path d="M8.5 8.5c2.8 0 3.3 3.4 6.1 3.4S18 15.3 18 15.3" /></svg>;
    case "fuel":
      return <svg {...props}><path d="M6 20V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v13" /><path d="M6 11h10" /><path d="M16 9 18.5 11.5A2 2 0 0 1 19 12.8V17a2 2 0 0 1-2 2h-1" /></svg>;
    case "profile":
      return <svg {...props}><circle cx="12" cy="8" r="4" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>;
    case "signout":
      return <svg {...props}><path d="M10 17 15 12 10 7" /><path d="M15 12H4" /><path d="M20 4v16" /></svg>;
    case "details":
      return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 10v6" /><path d="M12 7h.01" /></svg>;
    case "location":
      return <svg {...props}><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
    case "play":
      return <svg {...props}><path d="M8 6v12l9-6Z" /></svg>;
    case "stop":
      return <svg {...props}><rect x="6" y="6" width="12" height="12" rx="2" /></svg>;
    case "vehicle":
      return <svg {...props}><path d="M5 15 6.5 9.5A2 2 0 0 1 8.4 8H15.6a2 2 0 0 1 1.9 1.5L19 15" /><path d="M4 15h16v3a1 1 0 0 1-1 1h-1" /><path d="M6 19H5a1 1 0 0 1-1-1v-3" /><circle cx="7.5" cy="15.5" r="1.5" /><circle cx="16.5" cy="15.5" r="1.5" /></svg>;
    case "history":
      return <svg {...props}><path d="M3 12a9 9 0 1 0 2.6-6.4" /><path d="M3 4v4h4" /><path d="M12 7v6l4 2" /></svg>;
    case "calendar":
      return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
    case "phone":
      return <svg {...props}><path d="M6.5 4h3l1.5 4-2 1.5a15 15 0 0 0 5 5l1.5-2 4 1.5v3A2 2 0 0 1 18 20C10.8 20 5 14.2 5 7a2 2 0 0 1 1.5-3Z" /></svg>;
    case "mail":
      return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>;
    case "shield":
      return <svg {...props}><path d="M12 3 6 5v5c0 4 2.5 7.5 6 9 3.5-1.5 6-5 6-9V5Z" /></svg>;
    case "chevron":
      return <svg {...props}><path d="m9 6 6 6-6 6" /></svg>;
    case "gauge":
      return <svg {...props}><path d="M4.5 15a7.5 7.5 0 1 1 15 0" /><path d="m12 12 3.5-3.5" /></svg>;
    case "clock":
      return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "distance":
      return <svg {...props}><path d="M7 18h10" /><path d="m8 18 2-9h4l2 9" /><path d="M9.5 13h5" /></svg>;
    case "coins":
      return <svg {...props}><circle cx="9" cy="10" r="3" /><circle cx="15" cy="14" r="3" /><path d="M6.5 10h5M12.5 14h5" /></svg>;
    default:
      return null;
  }
}

function Stat({ value, label, icon }: { value: ReactNode; label: string; icon?: DriverIconName }) {
  return (
    <div className="pwa-stat">
      {icon ? <span className="pwa-stat__icon"><DriverIcon name={icon} /></span> : null}
      <div>
        <div className="pwa-stat__value">{value}</div>
        <div className="pwa-stat__label">{label}</div>
      </div>
    </div>
  );
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
  const [tripsView, setTripsView] = useState<TripsView>("assigned");
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
  const [selectedAssignedTripId, setSelectedAssignedTripId] = useState<string | null>(null);
  const [showActiveTripDetails, setShowActiveTripDetails] = useState(false);

  const activeTrip = props.trips.find((t) => t.id === props.activeTripId);
  const activeVehicle = props.vehicles.find((vehicle) => vehicle.id === activeTrip?.vehicle_id);
  const assignedTrips = useMemo(
    () => props.trips
      .filter((trip) => deriveTripStatus(trip) === "assigned")
      .sort((a, b) => new Date(a.scheduled_start || 0).getTime() - new Date(b.scheduled_start || 0).getTime()),
    [props.trips]
  );
  const nextAssignedTrip = assignedTrips[0] || null;
  const nextAssignedVehicle = props.vehicles.find((vehicle) => vehicle.id === nextAssignedTrip?.vehicle_id);
  const selectedAssignedTrip = assignedTrips.find((trip) => trip.id === selectedAssignedTripId) || null;
  const selectedAssignedVehicle = props.vehicles.find((vehicle) => vehicle.id === selectedAssignedTrip?.vehicle_id);
  const completedTrips = useMemo(
    () => props.trips
      .filter((t) => deriveTripStatus(t) === "completed" || (t.status || "").toLowerCase() === "cancelled")
      .sort((a, b) => new Date(b.end_time || b.start_time || "").getTime() - new Date(a.end_time || a.start_time || "").getTime()),
    [props.trips]
  );
  const selectedTrip = completedTrips.find((trip) => trip.id === selectedTripId) || null;
  const scorePillClass = props.driverScore >= 85 ? "pwa-pill--success" : props.driverScore >= 70 ? "pwa-pill--scheduled" : "pwa-pill--danger";

  useEffect(() => {
    setProfileName(fullName || "");
    setProfilePhone(phone || "");
  }, [fullName, phone]);

  useEffect(() => {
    if (!token) return;
    apiGet<DriverProfile>("/profiles/me", token).then(setProfile).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setFuelLoading(true);
    apiGet<FuelLog[]>("/fuel-logs", token)
      .then((rows) => setFuelLogs(rows))
      .catch((err: any) => setError(err.message || "Failed to load fuel logs"))
      .finally(() => setFuelLoading(false));
  }, [token, setError]);

  useEffect(() => {
    if (selectedAssignedTripId && !assignedTrips.some((trip) => trip.id === selectedAssignedTripId)) {
      setSelectedAssignedTripId(null);
    }
  }, [assignedTrips, selectedAssignedTripId]);

  useEffect(() => {
    if (selectedTripId && !completedTrips.some((trip) => trip.id === selectedTripId)) {
      setSelectedTripId(null);
    }
  }, [completedTrips, selectedTripId]);

  useEffect(() => {
    if (props.activeTripId) {
      setSelectedAssignedTripId(null);
      return;
    }
    setShowActiveTripDetails(false);
  }, [props.activeTripId]);

  async function handleAddFuel(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    try {
      if (!fuelDate || !fuelLiters) throw new Error("Fuel date and liters are required");
      const vehicleId = props.activeTripId && activeVehicle ? activeVehicle.id : nextAssignedVehicle?.id;
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
    setProfile((prev) => prev ? { ...prev, full_name: profileName, phone: profilePhone } : prev);
  }

  async function handlePasswordSave(e: FormEvent) {
    e.preventDefault();
    await handleChangePassword(currentPassword, newPassword);
    setCurrentPassword("");
    setNewPassword("");
  }

  const todayTrips = completedTrips.filter((trip) => {
    const compareDate = trip.end_time || trip.start_time || "";
    return compareDate && new Date(compareDate).toDateString() === new Date().toDateString();
  });
  const todayFuelLogs = fuelLogs.filter((log) => new Date(log.fuel_date).toDateString() === new Date().toDateString());
  const totalKmToday = todayTrips.reduce((sum, trip) => sum + (trip.distance_km || 0), 0);
  const totalDurationToday = todayTrips.reduce((sum, trip) => sum + (trip.duration_min || 0), 0);
  const totalFuelToday = todayFuelLogs.reduce((sum, log) => sum + log.liters, 0);
  const totalFuelCostToday = todayFuelLogs.reduce((sum, log) => sum + (log.cost_lkr || 0), 0);
  const homeRecentTrips = completedTrips.filter((trip) => deriveTripStatus(trip) === "completed").slice(0, 3);
  const currentVehicleForFuel = activeVehicle || nextAssignedVehicle;
  const availabilityStatus = getAvailabilityStatus(profile?.status, props.activeTripId);
  const headerTitle = activeTab === "trips" ? "Trips" : activeTab === "fuel" ? "Fuel" : activeTab === "profile" ? "Profile" : "";

  return (
    <div className="pwa-app pwa-app--driver-ref">
      <header className={`pwa-header pwa-header--driver-ref ${activeTab === "home" ? "pwa-header--home" : "pwa-header--title"}`}>
        {activeTab === "home" ? (
          <>
            <div className="pwa-header__user pwa-header__user--greeting">
              <div className="pwa-avatar pwa-avatar--photo">{(profileName || "D").slice(0, 1).toUpperCase()}</div>
              <div className="pwa-header__info">
                <div className="pwa-header__name">Hello, {profileName?.split(" ")[0] || "Driver"}</div>
                <div className="pwa-header__id">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}</div>
                <div className="pwa-header__meta pwa-header__meta--online">
                  <span className={`pwa-dot pwa-dot--${availabilityStatus.modifier}`} />
                  {availabilityStatus.label}
                </div>
              </div>
            </div>
            <div className="pwa-header__actions">
              <button className="pwa-header-icon-btn" type="button" onClick={props.onSignOut} aria-label="Sign out">
                <DriverIcon name="signout" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="pwa-header__title">{headerTitle}</div>
            <div className="pwa-header__actions">
              <button className="pwa-header-icon-btn" type="button" onClick={props.onSignOut} aria-label="Sign out">
                <DriverIcon name="signout" />
              </button>
            </div>
          </>
        )}
      </header>

      <main className="pwa-main pwa-main--driver-ref">
        {activeTab === "home" && (
          <>
            {props.activeTripId && activeTrip ? (
              <section className="pwa-hero-card">
                <div className="pwa-hero-card__top">
                  <span className="pwa-hero-card__eyebrow">Current Trip</span>
                  <span className="pwa-pill pwa-pill--light">{getTrackingLabel(props.tripTrackingStatus)}</span>
                </div>
                <div className="pwa-hero-card__plate">{activeVehicle?.plate_no || "Assigned Vehicle"}</div>
                <div className="pwa-hero-card__title">{activeTrip.trip_title || "Active delivery route"}</div>
                <div className="pwa-hero-card__route-line">
                  <span>{activeTrip.origin_label || "Origin"}</span>
                  <span>{activeTrip.destination_label || "Destination"}</span>
                </div>
                <div className="pwa-hero-card__meta-row">
                  <span><DriverIcon name="location" /> Tracking</span>
                  <span><DriverIcon name="history" /> {getTrackingLabel(props.tripTrackingStatus)}</span>
                </div>
                <div className="pwa-hero-card__subtle">Last update {props.tripTrackingLastUpdated ? formatTime(props.tripTrackingLastUpdated) : "waiting"}</div>
                <div className="pwa-hero-card__actions pwa-hero-card__actions--two">
                  <button className="pwa-btn pwa-btn--hero-secondary" type="button" onClick={() => setShowActiveTripDetails(true)}>
                    View Details
                  </button>
                  <button className="pwa-btn pwa-btn--hero-primary" type="button" onClick={props.stopTrip} disabled={props.loading}>
                    {props.loading ? "Ending..." : "End Trip"}
                  </button>
                </div>
              </section>
            ) : (
              <section className="pwa-hero-card pwa-hero-card--assigned">
                <div className="pwa-hero-card__top">
                  <span className="pwa-hero-card__eyebrow">Assigned Trip</span>
                  {nextAssignedTrip ? <span className="pwa-pill pwa-pill--light">Scheduled</span> : null}
                </div>
                <div className="pwa-hero-card__plate">{nextAssignedVehicle?.plate_no || "No vehicle assigned"}</div>
                <div className="pwa-hero-card__title">{nextAssignedTrip?.trip_title || "No trip assigned"}</div>
                {nextAssignedTrip ? (
                  <>
                    <div className="pwa-hero-card__route-line">
                      <span>{nextAssignedTrip.origin_label || "Origin"}</span>
                      <span>{nextAssignedTrip.destination_label || "Destination"}</span>
                    </div>
                    <div className="pwa-hero-card__subtle">{formatDate(nextAssignedTrip.scheduled_start)} • {formatTime(nextAssignedTrip.scheduled_start)}</div>
                    <div className="pwa-hero-card__actions pwa-hero-card__actions--two">
                      <button className="pwa-btn pwa-btn--hero-secondary" type="button" onClick={() => setSelectedAssignedTripId(nextAssignedTrip.id)}>
                        View Details
                      </button>
                      <button className="pwa-btn pwa-btn--hero-primary" type="button" onClick={() => props.startTrip(nextAssignedTrip.id)} disabled={props.loading}>
                        {props.loading ? "Starting..." : "Start Trip"}
                      </button>
                    </div>
                    {(nextAssignedTrip.origin_lat != null && nextAssignedTrip.origin_lon != null) ||
                    (nextAssignedTrip.destination_lat != null && nextAssignedTrip.destination_lon != null) ? (
                      <div className="pwa-hero-card__map">
                        <TripRoutePreview
                          origin={nextAssignedTrip.origin_lat != null && nextAssignedTrip.origin_lon != null ? [nextAssignedTrip.origin_lat, nextAssignedTrip.origin_lon] : null}
                          destination={nextAssignedTrip.destination_lat != null && nextAssignedTrip.destination_lon != null ? [nextAssignedTrip.destination_lat, nextAssignedTrip.destination_lon] : null}
                        />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="pwa-empty-inline">No trip assigned. Contact your manager.</div>
                )}
              </section>
            )}

            <section className="pwa-card pwa-card--score">
              <div>
                <div className="pwa-card__title-row">
                  <h3>Driver Score</h3>
                  <span className="pwa-card__hint">This Month</span>
                </div>
                <div className="pwa-score-line">
                  <strong>{props.driverScore}</strong>
                  <span>/100</span>
                </div>
                <div className="pwa-score-caption">{props.driverScoreLabel}</div>
              </div>
              <div className="pwa-score-ring-wrap">
                <div className="pwa-score-ring">
                  <svg viewBox="0 0 100 100">
                    <circle className="pwa-score-ring__bg" cx="50" cy="50" r="42" />
                    <circle className="pwa-score-ring__progress" cx="50" cy="50" r="42" strokeDasharray={`${props.driverScore * 2.64} 264`} />
                  </svg>
                  <span className="pwa-score-ring__icon"><DriverIcon name="shield" /></span>
                </div>
              </div>
            </section>

            <section className="pwa-card">
              <div className="pwa-card__title-row"><h3>Score Breakdown</h3></div>
              <div className="pwa-breakdown-grid">
                <Stat value={props.driverScoreBreakdown.speed} label="Safety" icon="shield" />
                <Stat value={props.driverScoreBreakdown.idle} label="Efficiency" icon="gauge" />
                <Stat value={props.driverScoreBreakdown.distance} label="Compliance" icon="calendar" />
                <Stat value={props.driverScoreBreakdown.consistency} label="Punctuality" icon="clock" />
              </div>
            </section>

            <div className="pwa-mini-card-grid">
              <section className="pwa-card pwa-card--mini">
                <div className="pwa-card__title-row"><h3>Today's Summary</h3></div>
                <div className="pwa-breakdown-grid pwa-breakdown-grid--three">
                  <Stat value={`${totalKmToday.toFixed(0)} km`} label="Distance" icon="distance" />
                  <Stat value={formatDuration(totalDurationToday)} label="Duration" icon="clock" />
                  <Stat value={todayTrips.length} label="Trips" icon="route" />
                </div>
              </section>
              <section className="pwa-card pwa-card--mini">
                <div className="pwa-card__title-row"><h3>Fuel Today</h3></div>
                <div className="pwa-breakdown-grid pwa-breakdown-grid--two">
                  <Stat value={`${totalFuelToday.toFixed(1)} L`} label="Liters" icon="fuel" />
                  <Stat value={`LKR ${totalFuelCostToday.toLocaleString()}`} label="Cost" icon="coins" />
                </div>
              </section>
            </div>

            <section className="pwa-card">
              <div className="pwa-card__title-row">
                <h3>Recent Trips</h3>
                <button className="pwa-link-btn" type="button" onClick={() => { setActiveTab("trips"); setTripsView("history"); }}>
                  View All
                </button>
              </div>
              {homeRecentTrips.length === 0 ? (
                <div className="pwa-empty-inline">No completed trips yet.</div>
              ) : (
                <div className="pwa-list pwa-list--compact">
                  {homeRecentTrips.map((trip) => {
                    const vehicle = props.vehicles.find((v) => v.id === trip.vehicle_id);
                    return (
                      <button
                        key={trip.id}
                        type="button"
                        className="pwa-list-item pwa-list-item--button"
                        onClick={() => {
                          setSelectedTripId(trip.id);
                          setActiveTab("trips");
                          setTripsView("history");
                        }}
                      >
                        <div className="pwa-list-item__body">
                          <div className="pwa-list-item__title-row">
                            <strong>{trip.trip_title || vehicle?.plate_no || "Trip"}</strong>
                            <span className="pwa-list-item__status pwa-list-item__status--success">Completed</span>
                          </div>
                          <div className="pwa-list-item__sub">{formatDate(trip.end_time || trip.start_time)}</div>
                          <div className="pwa-list-item__meta">{vehicle?.plate_no || "Vehicle"} • {trip.distance_km?.toFixed(0) || "0"} km</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === "trips" && (
          <>
            <div className="pwa-segmented-control">
              <button className={`pwa-segmented-control__item ${tripsView === "assigned" ? "is-active" : ""}`} type="button" onClick={() => setTripsView("assigned")}>Assigned</button>
              <button className={`pwa-segmented-control__item ${tripsView === "history" ? "is-active" : ""}`} type="button" onClick={() => setTripsView("history")}>History</button>
            </div>

            {tripsView === "assigned" ? (
              <section className="pwa-card">
                <div className="pwa-card__title-row"><h3>Assigned Trips</h3></div>
                {assignedTrips.length === 0 ? (
                  <div className="pwa-empty-inline">No assigned trips available.</div>
                ) : (
                  <div className="pwa-list">
                    {assignedTrips.map((trip) => {
                      const vehicle = props.vehicles.find((v) => v.id === trip.vehicle_id);
                      return (
                        <div key={trip.id} className="pwa-trip-row">
                          <div className="pwa-trip-row__main">
                            <div className="pwa-trip-row__title-row">
                              <strong>{trip.trip_title || "Assigned Trip"}</strong>
                              <span className={getStatusClass("assigned")}>Scheduled</span>
                            </div>
                            <div className="pwa-trip-row__vehicle">{vehicle?.plate_no || "Vehicle"} <span>{formatDate(trip.scheduled_start)} • {formatTime(trip.scheduled_start)}</span></div>
                            <div className="pwa-trip-row__points">
                              <span>{trip.origin_label || "Origin"}</span>
                              <span>{trip.destination_label || "Destination"}</span>
                            </div>
                            <div className="pwa-trip-row__footer">
                              <span><DriverIcon name="distance" /> {trip.distance_km?.toFixed(0) || "--"} km</span>
                              <span><DriverIcon name="clock" /> {formatDuration(trip.duration_min)}</span>
                            </div>
                          </div>
                          <button
                            className="pwa-trip-row__chevron"
                            type="button"
                            onClick={() => setSelectedAssignedTripId(trip.id)}
                            aria-label="View assigned trip details"
                          >
                            <DriverIcon name="chevron" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : (
              <section className="pwa-card">
                <div className="pwa-card__title-row"><h3>Trip History</h3></div>
                {completedTrips.length === 0 ? (
                  <div className="pwa-empty-inline">No trip history available.</div>
                ) : (
                  <div className="pwa-list">
                    {completedTrips.map((trip) => {
                      const vehicle = props.vehicles.find((v) => v.id === trip.vehicle_id);
                      const status = deriveTripStatus(trip);
                      return (
                        <button key={trip.id} type="button" className="pwa-trip-row pwa-trip-row--button" onClick={() => setSelectedTripId(trip.id)}>
                          <div className="pwa-trip-row__main">
                            <div className="pwa-trip-row__title-row">
                              <strong>{trip.trip_title || vehicle?.plate_no || "Trip"}</strong>
                              <span className={getStatusClass(status)}>{getStatusLabel(status)}</span>
                            </div>
                            <div className="pwa-trip-row__vehicle">{formatDate(trip.end_time || trip.start_time)} • {formatTime(trip.end_time || trip.start_time)}</div>
                            <div className="pwa-trip-row__footer">
                              <span><DriverIcon name="vehicle" /> {vehicle?.plate_no || "Vehicle"}</span>
                              <span><DriverIcon name="clock" /> {formatDuration(trip.duration_min)}</span>
                            </div>
                          </div>
                          <span className="pwa-trip-row__chevron pwa-trip-row__chevron--static"><DriverIcon name="chevron" /></span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {activeTab === "fuel" && (
          <>
            <section className="pwa-card">
              <div className="pwa-card__title-row pwa-card__title-row--icon">
                <span className="pwa-card__icon-box"><DriverIcon name="fuel" /></span>
                <h3>Add Fuel Log</h3>
              </div>
              <form className="pwa-form pwa-form--driver-ref" onSubmit={handleAddFuel}>
                <label className="pwa-form__field">
                  <span>Vehicle</span>
                  <input value={currentVehicleForFuel?.plate_no || ""} readOnly placeholder="Select or start a trip first" />
                </label>
                <label className="pwa-form__field">
                  <span>Date</span>
                  <input type="date" value={fuelDate} onChange={(e) => setFuelDate(e.target.value)} required />
                </label>
                <div className="pwa-form__row">
                  <label className="pwa-form__field">
                    <span>Liters (L)</span>
                    <input type="number" min="0" step="0.1" value={fuelLiters} onChange={(e) => setFuelLiters(e.target.value)} required />
                  </label>
                  <label className="pwa-form__field">
                    <span>Cost (LKR)</span>
                    <input type="number" min="0" step="0.01" value={fuelCost} onChange={(e) => setFuelCost(e.target.value)} />
                  </label>
                </div>
                <label className="pwa-form__field">
                  <span>Odometer (km)</span>
                  <input type="number" min="0" step="1" value={fuelOdometer} onChange={(e) => setFuelOdometer(e.target.value)} />
                </label>
                <label className="pwa-form__field">
                  <span>Vendor / Station</span>
                  <input value={fuelVendor} onChange={(e) => setFuelVendor(e.target.value)} placeholder="Station or vendor" />
                </label>
                <button className="pwa-btn pwa-btn--primary pwa-btn--full" type="submit" disabled={props.loading || authLoading}>
                  Save Fuel Log
                </button>
              </form>
            </section>

            <section className="pwa-card">
              <div className="pwa-card__title-row"><h3>Recent Fuel Logs</h3></div>
              {fuelLoading ? (
                <div className="pwa-empty-inline">Loading fuel logs...</div>
              ) : fuelLogs.length === 0 ? (
                <div className="pwa-empty-inline">No fuel logs yet.</div>
              ) : (
                <div className="pwa-list">
                  {fuelLogs.slice(0, 5).map((log) => {
                    const vehicle = props.vehicles.find((v) => v.id === log.vehicle_id);
                    return (
                      <div key={log.id} className="pwa-fuel-log-row">
                        <span className="pwa-fuel-log-row__icon"><DriverIcon name="fuel" /></span>
                        <div className="pwa-fuel-log-row__body">
                          <div className="pwa-fuel-log-row__title-row">
                            <strong>{formatDate(log.fuel_date)}</strong>
                            <div className="pwa-fuel-log-row__amount">
                              <strong>{log.liters.toFixed(1)} L</strong>
                              <span>LKR {(log.cost_lkr || 0).toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="pwa-fuel-log-row__sub">{vehicle?.plate_no || "Vehicle"}</div>
                          <div className="pwa-fuel-log-row__meta">Odo: {(log.odometer_km || 0).toLocaleString()} km {log.vendor ? `• ${log.vendor}` : ""}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === "profile" && (
          <>
            <section className="pwa-card pwa-card--profile-hero">
              <div className="pwa-profile-hero">
                <div className="pwa-avatar pwa-avatar--large">{(profileName || "D").slice(0, 1).toUpperCase()}</div>
                <div className="pwa-profile-hero__body">
                  <div className="pwa-profile-hero__title-row">
                    <strong>{profileName || "Driver"}</strong>
                    <span className="pwa-pill pwa-pill--success">{profile?.status || "Active"}</span>
                  </div>
                  <div className="pwa-profile-hero__line"><DriverIcon name="mail" /> {email || "Unavailable"}</div>
                  <div className="pwa-profile-hero__line"><DriverIcon name="phone" /> {profilePhone || "No phone"}</div>
                  <div className="pwa-profile-hero__line"><DriverIcon name="shield" /> {role || "driver"}</div>
                </div>
              </div>
            </section>

            <section className="pwa-card">
              <div className="pwa-card__title-row"><h3>Account Information</h3></div>
              <form className="pwa-form pwa-form--driver-ref" onSubmit={handleProfileSave}>
                <label className="pwa-form__field">
                  <span>Full Name</span>
                  <input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
                </label>
                <label className="pwa-form__field">
                  <span>Phone Number</span>
                  <input value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} />
                </label>
                <label className="pwa-form__field">
                  <span>Email</span>
                  <input value={email || ""} readOnly />
                </label>
                <button className="pwa-btn pwa-btn--primary pwa-btn--full" type="submit" disabled={authLoading}>
                  Save Profile
                </button>
              </form>
            </section>

            <section className="pwa-card">
              <div className="pwa-card__title-row"><h3>Change Password</h3></div>
              <form className="pwa-form pwa-form--driver-ref" onSubmit={handlePasswordSave}>
                <label className="pwa-form__field">
                  <span>Current Password</span>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                </label>
                <label className="pwa-form__field">
                  <span>New Password</span>
                  <input type="password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </label>
                <button className="pwa-btn pwa-btn--primary pwa-btn--full" type="submit" disabled={authLoading}>
                  Update Password
                </button>
              </form>
            </section>
          </>
        )}
      </main>

      {showActiveTripDetails && activeTrip && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--wide modal--details" role="dialog" aria-modal="true" aria-label="Current trip details">
            <div className="modal__header">
              <div>
                <h3>Current Trip Details</h3>
                <p className="modal__subtle">{activeVehicle?.plate_no || "Assigned vehicle"} • In Progress</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setShowActiveTripDetails(false)} aria-label="Close trip details">✕</button>
            </div>
            <div className="details-grid details-grid--scroll">
              <div className="detail-item"><span>Trip Title</span><strong>{activeTrip.trip_title || "Assigned trip"}</strong></div>
              <div className="detail-item"><span>Vehicle</span><strong>{activeVehicle?.plate_no || "--"}</strong></div>
              <div className="detail-item"><span>Started</span><strong>{formatDateTime(activeTrip.start_time)}</strong></div>
              <div className="detail-item"><span>Scheduled Start</span><strong>{activeTrip.scheduled_start ? formatDateTime(activeTrip.scheduled_start) : "--"}</strong></div>
              <div className="detail-item"><span>Origin</span><strong>{activeTrip.origin_label || "--"}</strong></div>
              <div className="detail-item"><span>Destination</span><strong>{activeTrip.destination_label || "--"}</strong></div>
              <div className="detail-item"><span>Priority</span><strong>{formatPriority(activeTrip.priority)}</strong></div>
              <div className="detail-item"><span>Contact Person</span><strong>{activeTrip.contact_name || "--"}</strong></div>
              <div className="detail-item"><span>Contact Phone</span><strong>{activeTrip.contact_phone || "--"}</strong></div>
              <div className="detail-item"><span>Tracking</span><strong>{props.tripTrackingStatus}</strong></div>
              <div className="detail-item"><span>Last Update</span><strong>{props.tripTrackingLastUpdated ? formatDateTime(props.tripTrackingLastUpdated) : "--"}</strong></div>
              <div className="detail-item detail-item--full"><span>Notes</span><strong>{activeTrip.notes || "--"}</strong></div>
              {(activeTrip.origin_lat != null && activeTrip.origin_lon != null) || (activeTrip.destination_lat != null && activeTrip.destination_lon != null) ? (
                <div className="detail-item detail-item--full">
                  <span>Route Preview</span>
                  <TripRoutePreview
                    origin={activeTrip.origin_lat != null && activeTrip.origin_lon != null ? [activeTrip.origin_lat, activeTrip.origin_lon] : null}
                    destination={activeTrip.destination_lat != null && activeTrip.destination_lon != null ? [activeTrip.destination_lat, activeTrip.destination_lon] : null}
                  />
                </div>
              ) : null}
            </div>
            <div className="modal__actions"><button className="btn btn--secondary" type="button" onClick={() => setShowActiveTripDetails(false)}>Close</button></div>
          </div>
        </div>
      )}

      {selectedAssignedTrip && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--details" role="dialog" aria-modal="true" aria-label="Assigned trip details">
            <div className="modal__header">
              <div>
                <h3>Assigned Trip Details</h3>
                <p className="modal__subtle">{selectedAssignedVehicle?.plate_no || "Assigned vehicle"} • Ready to start</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setSelectedAssignedTripId(null)} aria-label="Close assigned trip details">✕</button>
            </div>
            <div className="details-grid details-grid--scroll">
              <div className="detail-item"><span>Trip Title</span><strong>{selectedAssignedTrip.trip_title || "Assigned trip"}</strong></div>
              <div className="detail-item"><span>Vehicle</span><strong>{selectedAssignedVehicle?.plate_no || "--"}</strong></div>
              <div className="detail-item"><span>Scheduled Start</span><strong>{selectedAssignedTrip.scheduled_start ? formatDateTime(selectedAssignedTrip.scheduled_start) : "--"}</strong></div>
              <div className="detail-item"><span>Origin</span><strong>{selectedAssignedTrip.origin_label || "--"}</strong></div>
              <div className="detail-item"><span>Destination</span><strong>{selectedAssignedTrip.destination_label || "--"}</strong></div>
              <div className="detail-item"><span>Priority</span><strong>{formatPriority(selectedAssignedTrip.priority)}</strong></div>
              <div className="detail-item"><span>Contact Person</span><strong>{selectedAssignedTrip.contact_name || "--"}</strong></div>
              <div className="detail-item"><span>Contact Phone</span><strong>{selectedAssignedTrip.contact_phone || "--"}</strong></div>
              <div className="detail-item detail-item--full"><span>Notes</span><strong>{selectedAssignedTrip.notes || "--"}</strong></div>
              {(selectedAssignedTrip.origin_lat != null && selectedAssignedTrip.origin_lon != null) ||
              (selectedAssignedTrip.destination_lat != null && selectedAssignedTrip.destination_lon != null) ? (
                <div className="detail-item detail-item--full">
                  <span>Route Preview</span>
                  <TripRoutePreview
                    origin={selectedAssignedTrip.origin_lat != null && selectedAssignedTrip.origin_lon != null ? [selectedAssignedTrip.origin_lat, selectedAssignedTrip.origin_lon] : null}
                    destination={selectedAssignedTrip.destination_lat != null && selectedAssignedTrip.destination_lon != null ? [selectedAssignedTrip.destination_lat, selectedAssignedTrip.destination_lon] : null}
                  />
                </div>
              ) : null}
            </div>
            <div className="modal__actions"><button className="btn btn--secondary" type="button" onClick={() => setSelectedAssignedTripId(null)}>Close</button></div>
          </div>
        </div>
      )}

      {selectedTrip && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--wide modal--details" role="dialog" aria-modal="true" aria-label="Trip history details">
            <div className="modal__header">
              <div>
                <h3>Trip Details</h3>
                <p className="modal__subtle">{props.vehicles.find((v) => v.id === selectedTrip.vehicle_id)?.plate_no || "Vehicle"} • {getStatusLabel(deriveTripStatus(selectedTrip))}</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setSelectedTripId(null)} aria-label="Close trip history details">✕</button>
            </div>
            <div className="details-grid details-grid--scroll">
              <div className="detail-item"><span>Trip Title</span><strong>{selectedTrip.trip_title || "Completed trip"}</strong></div>
              <div className="detail-item"><span>Vehicle</span><strong>{props.vehicles.find((v) => v.id === selectedTrip.vehicle_id)?.plate_no || "Vehicle"}</strong></div>
              <div className="detail-item"><span>Scheduled Start</span><strong>{selectedTrip.scheduled_start ? formatDateTime(selectedTrip.scheduled_start) : "--"}</strong></div>
              <div className="detail-item"><span>Started</span><strong>{formatDateTime(selectedTrip.start_time)}</strong></div>
              <div className="detail-item"><span>Ended</span><strong>{formatDateTime(selectedTrip.end_time)}</strong></div>
              <div className="detail-item"><span>From</span><strong>{selectedTrip.origin_label || "--"}</strong></div>
              <div className="detail-item"><span>To</span><strong>{selectedTrip.destination_label || "--"}</strong></div>
              <div className="detail-item"><span>Distance</span><strong>{selectedTrip.distance_km?.toFixed(1) || "0.0"} km</strong></div>
              <div className="detail-item"><span>Duration</span><strong>{formatDuration(selectedTrip.duration_min)}</strong></div>
              <div className="detail-item"><span>Average Speed</span><strong>{selectedTrip.avg_speed_kmh?.toFixed(1) || "0.0"} km/h</strong></div>
              <div className="detail-item"><span>Idle Time</span><strong>{formatDuration(selectedTrip.idle_min)}</strong></div>
              <div className="detail-item detail-item--full"><span>Notes</span><strong>{selectedTrip.notes || "--"}</strong></div>
              {(selectedTrip.origin_lat != null && selectedTrip.origin_lon != null) || (selectedTrip.destination_lat != null && selectedTrip.destination_lon != null) ? (
                <div className="detail-item detail-item--full">
                  <span>Route Preview</span>
                  <TripRoutePreview
                    origin={selectedTrip.origin_lat != null && selectedTrip.origin_lon != null ? [selectedTrip.origin_lat, selectedTrip.origin_lon] : null}
                    destination={selectedTrip.destination_lat != null && selectedTrip.destination_lon != null ? [selectedTrip.destination_lat, selectedTrip.destination_lon] : null}
                  />
                </div>
              ) : null}
            </div>
            <div className="modal__actions"><button className="btn btn--secondary" type="button" onClick={() => setSelectedTripId(null)}>Close</button></div>
          </div>
        </div>
      )}

      <nav className="pwa-nav pwa-nav--driver-ref">
        <button className={`pwa-nav__item ${activeTab === "home" ? "pwa-nav__item--active" : ""}`} onClick={() => setActiveTab("home")}>
          <span className="pwa-nav__icon"><DriverIcon name="home" /></span><span className="pwa-nav__label">Home</span>
        </button>
        <button className={`pwa-nav__item ${activeTab === "trips" ? "pwa-nav__item--active" : ""}`} onClick={() => setActiveTab("trips")}>
          <span className="pwa-nav__icon"><DriverIcon name="route" /></span><span className="pwa-nav__label">Trips</span>
        </button>
        <button className={`pwa-nav__item ${activeTab === "fuel" ? "pwa-nav__item--active" : ""}`} onClick={() => setActiveTab("fuel")}>
          <span className="pwa-nav__icon"><DriverIcon name="fuel" /></span><span className="pwa-nav__label">Fuel</span>
        </button>
        <button className={`pwa-nav__item ${activeTab === "profile" ? "pwa-nav__item--active" : ""}`} onClick={() => setActiveTab("profile")}>
          <span className="pwa-nav__icon"><DriverIcon name="profile" /></span><span className="pwa-nav__label">Profile</span>
        </button>
      </nav>
    </div>
  );
}
