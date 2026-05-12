import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  Car,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  Clock3,
  CloudOff,
  Coins,
  Fuel,
  History,
  Home,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Play,
  Route,
  ShieldCheck,
  Square,
  User,
  Wifi,
} from "lucide-react";
import { apiGet, apiPatch, apiPost } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../context/FeedbackContext";
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
  pendingTripSyncCount: number;
  pendingGpsPointCount: number;
  syncingTripQueue: boolean;
  pendingTripStatusById: Record<string, "pending_start" | "pending_completion" | "sync_failed">;
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
  | "coins"
  | "bell"
  | "offline"
  | "lock"
  | "sync";

type CachedDriverData = {
  vehicles: Vehicle[];
  trips: Trip[];
  fuelLogs: FuelLog[];
  profile: DriverProfile | null;
  activeTripId: string | null;
  driverScore: number;
  driverScoreLabel: DriverProps["driverScoreLabel"];
  driverScoreBreakdown: DriverProps["driverScoreBreakdown"];
  fullName: string;
  phone: string;
  email: string;
  role: string;
  savedAt: string;
};

type PendingFuelLog = {
  temp_id: string;
  payload: {
    vehicle_id: string;
    fuel_date: string;
    liters: number;
    cost_lkr?: number;
    odometer_km?: number;
    vendor?: string;
  };
};

type PendingProfileEdit = {
  full_name: string;
  phone: string;
  savedAt: string;
};

const DRIVER_CACHE_KEY = "fleetlanka.driver.cache.v1";
const DRIVER_PENDING_FUEL_KEY = "fleetlanka.driver.pendingFuel.v1";
const DRIVER_PENDING_PROFILE_KEY = "fleetlanka.driver.pendingProfile.v1";

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

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

function getPendingTripLabel(status?: "pending_start" | "pending_completion" | "sync_failed") {
  switch (status) {
    case "pending_start":
      return "Pending Start";
    case "pending_completion":
      return "Pending Completion";
    case "sync_failed":
      return "Sync Failed";
    default:
      return null;
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

function buildGoogleMapsDirectionsUrl(trip?: Trip | null) {
  if (
    !trip ||
    trip.destination_lat == null ||
    trip.destination_lon == null ||
    !Number.isFinite(trip.destination_lat) ||
    !Number.isFinite(trip.destination_lon)
  ) {
    return null;
  }

  const params = new URLSearchParams({
    api: "1",
    destination: `${trip.destination_lat},${trip.destination_lon}`,
    travelmode: "driving",
  });

  if (
    trip.origin_lat != null &&
    trip.origin_lon != null &&
    Number.isFinite(trip.origin_lat) &&
    Number.isFinite(trip.origin_lon)
  ) {
    params.set("origin", `${trip.origin_lat},${trip.origin_lon}`);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function DriverIcon({ name, className }: { name: DriverIconName; className?: string }) {
  const icons = {
    home: Home,
    route: Route,
    fuel: Fuel,
    profile: User,
    signout: LogOut,
    details: Activity,
    location: MapPin,
    play: Play,
    stop: Square,
    vehicle: Car,
    history: History,
    calendar: CalendarDays,
    phone: Phone,
    mail: Mail,
    shield: ShieldCheck,
    chevron: ChevronRight,
    gauge: CircleGauge,
    clock: Clock3,
    distance: Navigation,
    coins: Coins,
    bell: Bell,
    offline: CloudOff,
    lock: Lock,
    sync: Wifi,
  } satisfies Record<DriverIconName, typeof Home>;
  const Icon = icons[name];
  return <Icon className={className} aria-hidden="true" />;
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
  const feedback = useFeedback();
  const {
    token,
    fullName,
    phone,
    email,
    role,
    loading: authLoading,
    handleUpdateProfile,
    handleChangePassword,
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
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [cachedDriverData, setCachedDriverData] = useState<CachedDriverData | null>(() => readStorage<CachedDriverData | null>(DRIVER_CACHE_KEY, null));
  const [pendingFuelLogs, setPendingFuelLogs] = useState<PendingFuelLog[]>(() => readStorage<PendingFuelLog[]>(DRIVER_PENDING_FUEL_KEY, []));
  const [pendingProfileEdit, setPendingProfileEdit] = useState<PendingProfileEdit | null>(() => readStorage<PendingProfileEdit | null>(DRIVER_PENDING_PROFILE_KEY, null));
  const [syncingOfflineQueue, setSyncingOfflineQueue] = useState(false);

  const usingCachedData = !isOnline && !!cachedDriverData;
  const displayVehicles = usingCachedData && props.vehicles.length === 0 ? cachedDriverData.vehicles : props.vehicles;
  const displayTrips = usingCachedData && props.trips.length === 0 ? cachedDriverData.trips : props.trips;
  const displayFuelLogs = usingCachedData && fuelLogs.length === 0 ? cachedDriverData.fuelLogs : fuelLogs;
  const displayProfile = usingCachedData ? cachedDriverData.profile : profile;
  const displayActiveTripId = props.activeTripId || (usingCachedData ? cachedDriverData.activeTripId : null);
  const displayDriverScore = usingCachedData ? cachedDriverData.driverScore : props.driverScore;
  const displayDriverScoreLabel = usingCachedData ? cachedDriverData.driverScoreLabel : props.driverScoreLabel;
  const displayDriverScoreBreakdown = usingCachedData ? cachedDriverData.driverScoreBreakdown : props.driverScoreBreakdown;
  const displayName = usingCachedData ? cachedDriverData.fullName : profileName;
  const displayPhone = usingCachedData ? cachedDriverData.phone : profilePhone;
  const displayEmail = usingCachedData ? cachedDriverData.email : email;
  const displayRole = usingCachedData ? cachedDriverData.role : role;

  const activeTrip = displayTrips.find((t) => t.id === displayActiveTripId);
  const activeVehicle = displayVehicles.find((vehicle) => vehicle.id === activeTrip?.vehicle_id);
  const assignedTrips = useMemo(
    () => displayTrips
      .filter((trip) => deriveTripStatus(trip) === "assigned")
      .sort((a, b) => new Date(a.scheduled_start || 0).getTime() - new Date(b.scheduled_start || 0).getTime()),
    [displayTrips]
  );
  const nextAssignedTrip = assignedTrips[0] || null;
  const nextAssignedVehicle = displayVehicles.find((vehicle) => vehicle.id === nextAssignedTrip?.vehicle_id);
  const selectedAssignedTrip = assignedTrips.find((trip) => trip.id === selectedAssignedTripId) || null;
  const selectedAssignedVehicle = displayVehicles.find((vehicle) => vehicle.id === selectedAssignedTrip?.vehicle_id);
  const completedTrips = useMemo(
    () => displayTrips
      .filter((t) => deriveTripStatus(t) === "completed" || (t.status || "").toLowerCase() === "cancelled")
      .sort((a, b) => new Date(b.end_time || b.start_time || "").getTime() - new Date(a.end_time || a.start_time || "").getTime()),
    [displayTrips]
  );
  const selectedTrip = completedTrips.find((trip) => trip.id === selectedTripId) || null;
  const scorePillClass = displayDriverScore >= 85 ? "pwa-pill--success" : displayDriverScore >= 70 ? "pwa-pill--scheduled" : "pwa-pill--danger";

  useEffect(() => {
    setProfileName(fullName || "");
    setProfilePhone(phone || "");
  }, [fullName, phone]);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    apiGet<DriverProfile>("/profiles/me", token).then(setProfile).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setFuelLoading(true);
    apiGet<FuelLog[]>("/fuel-logs", token)
      .then((rows) => setFuelLogs(rows))
      .catch((err: any) => feedback.error("Fuel logs unavailable", err.message || "Failed to load fuel logs"))
      .finally(() => setFuelLoading(false));
  }, [token, feedback]);

  useEffect(() => {
    if (!token || !isOnline) return;
    const cache: CachedDriverData = {
      vehicles: props.vehicles,
      trips: props.trips,
      fuelLogs,
      profile,
      activeTripId: props.activeTripId,
      driverScore: props.driverScore,
      driverScoreLabel: props.driverScoreLabel,
      driverScoreBreakdown: props.driverScoreBreakdown,
      fullName: profileName,
      phone: profilePhone,
      email: email || "",
      role: role || "driver",
      savedAt: new Date().toISOString(),
    };
    setCachedDriverData(cache);
    writeStorage(DRIVER_CACHE_KEY, cache);
  }, [
    token,
    isOnline,
    props.vehicles,
    props.trips,
    fuelLogs,
    profile,
    props.activeTripId,
    props.driverScore,
    props.driverScoreLabel,
    props.driverScoreBreakdown,
    profileName,
    profilePhone,
    email,
    role,
  ]);

  useEffect(() => {
    writeStorage(DRIVER_PENDING_FUEL_KEY, pendingFuelLogs);
  }, [pendingFuelLogs]);

  useEffect(() => {
    if (pendingProfileEdit) {
      writeStorage(DRIVER_PENDING_PROFILE_KEY, pendingProfileEdit);
    } else {
      window.localStorage.removeItem(DRIVER_PENDING_PROFILE_KEY);
    }
  }, [pendingProfileEdit]);

  useEffect(() => {
    if (!token || !isOnline || syncingOfflineQueue || (!pendingFuelLogs.length && !pendingProfileEdit)) return;

    let cancelled = false;
    async function syncOfflineQueue() {
      setSyncingOfflineQueue(true);
      try {
        for (const item of pendingFuelLogs) {
          if (cancelled) return;
          const created = await apiPost<FuelLog>("/fuel-logs", item.payload, token);
          setFuelLogs((prev) => [created, ...prev.filter((log) => log.id !== item.temp_id)]);
          setPendingFuelLogs((prev) => prev.filter((pending) => pending.temp_id !== item.temp_id));
        }

        if (pendingProfileEdit && !cancelled) {
          const updated = await apiPatch<{ full_name?: string; phone?: string }>(
            "/profiles/me",
            { full_name: pendingProfileEdit.full_name || undefined, phone: pendingProfileEdit.phone || undefined },
            token
          );
          const nameValue = updated.full_name || "";
          const phoneValue = updated.phone || "";
          setProfileName(nameValue);
          setProfilePhone(phoneValue);
          setProfile((prev) => prev ? { ...prev, full_name: nameValue, phone: phoneValue } : prev);
          window.localStorage.setItem("fleetlanka.profile.name", nameValue);
          window.localStorage.setItem("fleetlanka.profile.phone", phoneValue);
          setPendingProfileEdit(null);
        }
        if (!cancelled) feedback.success("Offline changes synced");
      } catch (err: any) {
        feedback.warning("Offline sync delayed", err.message || "Offline changes will retry when connected");
      } finally {
        if (!cancelled) setSyncingOfflineQueue(false);
      }
    }

    syncOfflineQueue();
    return () => {
      cancelled = true;
    };
  }, [token, isOnline, syncingOfflineQueue, pendingFuelLogs, pendingProfileEdit, feedback]);

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
    if (displayActiveTripId) {
      setSelectedAssignedTripId(null);
      return;
    }
    setShowActiveTripDetails(false);
  }, [displayActiveTripId]);

  async function handleAddFuel(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    try {
      if (!fuelDate || !fuelLiters) throw new Error("Fuel date and liters are required");
      const vehicleId = displayActiveTripId && activeVehicle ? activeVehicle.id : nextAssignedVehicle?.id;
      if (!vehicleId) throw new Error("Select a vehicle before logging fuel");
      const payload = {
        vehicle_id: vehicleId,
        fuel_date: fuelDate,
        liters: Number(fuelLiters),
        cost_lkr: fuelCost ? Number(fuelCost) : undefined,
        odometer_km: fuelOdometer ? Number(fuelOdometer) : undefined,
        vendor: fuelVendor || undefined,
      };
      const created = isOnline
        ? await apiPost<FuelLog>("/fuel-logs", payload, token)
        : {
            id: `offline-fuel-${Date.now()}`,
            ...payload,
          };
      setFuelLogs((prev) => [created, ...prev]);
      if (!isOnline) {
        setPendingFuelLogs((prev) => [...prev, { temp_id: created.id, payload }]);
        feedback.warning("Fuel log saved offline", "It will sync when the connection returns.");
      } else {
        feedback.success("Fuel log saved");
      }
      setFuelDate(new Date().toISOString().slice(0, 10));
      setFuelLiters("");
      setFuelCost("");
      setFuelOdometer("");
      setFuelVendor("");
    } catch (err: any) {
      feedback.error("Fuel log failed", err.message || "Fuel log failed");
    }
  }

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    if (!isOnline) {
      const pending = { full_name: profileName, phone: profilePhone, savedAt: new Date().toISOString() };
      setPendingProfileEdit(pending);
      setProfile((prev) => prev ? { ...prev, full_name: profileName, phone: profilePhone } : prev);
      window.localStorage.setItem("fleetlanka.profile.name", profileName || "");
      window.localStorage.setItem("fleetlanka.profile.phone", profilePhone || "");
      feedback.warning("Profile saved offline", "It will sync when the connection returns.");
      return;
    }
    await handleUpdateProfile(profileName, profilePhone);
    setProfile((prev) => prev ? { ...prev, full_name: profileName, phone: profilePhone } : prev);
  }

  async function handlePasswordSave(e: FormEvent) {
    e.preventDefault();
    if (!isOnline) {
      feedback.warning("Online required", "Password changes require an internet connection.");
      return;
    }
    await handleChangePassword(currentPassword, newPassword);
    setCurrentPassword("");
    setNewPassword("");
  }

  const todayTrips = completedTrips.filter((trip) => {
    const compareDate = trip.end_time || trip.start_time || "";
    return compareDate && new Date(compareDate).toDateString() === new Date().toDateString();
  });
  const todayFuelLogs = displayFuelLogs.filter((log) => new Date(log.fuel_date).toDateString() === new Date().toDateString());
  const totalKmToday = todayTrips.reduce((sum, trip) => sum + (trip.distance_km || 0), 0);
  const totalDurationToday = todayTrips.reduce((sum, trip) => sum + (trip.duration_min || 0), 0);
  const totalFuelToday = todayFuelLogs.reduce((sum, log) => sum + log.liters, 0);
  const totalFuelCostToday = todayFuelLogs.reduce((sum, log) => sum + (log.cost_lkr || 0), 0);
  const homeRecentTrips = completedTrips.filter((trip) => deriveTripStatus(trip) === "completed").slice(0, 3);
  const currentVehicleForFuel = activeVehicle || nextAssignedVehicle;
  const availabilityStatus = getAvailabilityStatus(displayProfile?.status, displayActiveTripId);
  const headerTitle = activeTab === "trips" ? "Trips" : activeTab === "fuel" ? "Fuel" : activeTab === "profile" ? "Profile" : "";
  const activeTripMapsUrl = buildGoogleMapsDirectionsUrl(activeTrip);
  const nextAssignedTripMapsUrl = buildGoogleMapsDirectionsUrl(nextAssignedTrip);
  const selectedAssignedTripMapsUrl = buildGoogleMapsDirectionsUrl(selectedAssignedTrip);
  const activeTripPendingStatus = activeTrip ? props.pendingTripStatusById[activeTrip.id] : undefined;
  const activeTripPendingLabel = getPendingTripLabel(activeTripPendingStatus);
  const nextAssignedTripPendingStatus = nextAssignedTrip ? props.pendingTripStatusById[nextAssignedTrip.id] : undefined;
  const selectedAssignedTripPendingStatus = selectedAssignedTrip ? props.pendingTripStatusById[selectedAssignedTrip.id] : undefined;
  const offlineQueueCount =
    pendingFuelLogs.length +
    (pendingProfileEdit ? 1 : 0) +
    props.pendingTripSyncCount +
    props.pendingGpsPointCount;

  return (
    <div className="pwa-app pwa-app--driver-ref">
      <header className={`pwa-header pwa-header--driver-ref ${activeTab === "home" ? "pwa-header--home" : "pwa-header--title"}`}>
        {activeTab === "home" ? (
          <>
            <div className="pwa-header__user pwa-header__user--greeting">
              <div className="pwa-avatar pwa-avatar--photo">{(displayName || "D").slice(0, 1).toUpperCase()}</div>
              <div className="pwa-header__info">
                <div className="pwa-header__name">Hello, {displayName?.split(" ")[0] || "Driver"}</div>
                <div className="pwa-header__id">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}</div>
                <div className="pwa-header__meta pwa-header__meta--online">
                  <span className={`pwa-dot pwa-dot--${isOnline ? availabilityStatus.modifier : "inactive"}`} />
                  {isOnline ? availabilityStatus.label : "Offline"}
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
        {!isOnline || offlineQueueCount || syncingOfflineQueue || props.syncingTripQueue ? (
          <section className={`pwa-offline-banner ${isOnline ? "pwa-offline-banner--sync" : ""}`}>
            <span className="pwa-offline-banner__icon"><DriverIcon name={isOnline ? "sync" : "offline"} /></span>
            <div>
              <strong>{isOnline ? "Sync ready" : "Offline mode"}</strong>
              <p>
                {syncingOfflineQueue || props.syncingTripQueue
                  ? "Syncing saved offline changes..."
                  : offlineQueueCount
                    ? `${offlineQueueCount} offline change${offlineQueueCount === 1 ? "" : "s"} waiting to sync.`
                    : "Showing cached driver data. Trip actions can be saved as pending offline."}
              </p>
            </div>
          </section>
        ) : null}
        {activeTab === "home" && (
          <>
            {displayActiveTripId && activeTrip ? (
              <section className="pwa-hero-card">
                <div className="pwa-hero-card__top">
                  <span className="pwa-hero-card__eyebrow">Current Trip</span>
                  <span className={`pwa-pill pwa-pill--light ${activeTripPendingStatus === "sync_failed" ? "pwa-pill--danger" : ""}`}>
                    {activeTripPendingLabel || (props.syncingTripQueue ? "Syncing Trip" : getTrackingLabel(props.tripTrackingStatus))}
                  </span>
                </div>
                <div className="pwa-hero-card__plate">{activeVehicle?.plate_no || "Assigned Vehicle"}</div>
                <div className="pwa-hero-card__title">{activeTrip.trip_title || "Active delivery route"}</div>
                <div className="pwa-hero-card__route-line">
                  <span>{activeTrip.origin_label || "Origin"}</span>
                  <span>{activeTrip.destination_label || "Destination"}</span>
                </div>
                <div className="pwa-hero-card__meta-row">
                  <span><DriverIcon name="location" /> {activeTripPendingLabel ? "Saved locally" : "Tracking"}</span>
                  <span><DriverIcon name="history" /> {activeTripPendingLabel || getTrackingLabel(props.tripTrackingStatus)}</span>
                </div>
                <div className="pwa-hero-card__subtle">
                  {activeTripPendingLabel
                    ? "This trip will be confirmed when the app reconnects."
                    : `Last update ${props.tripTrackingLastUpdated ? formatTime(props.tripTrackingLastUpdated) : "waiting"}`}
                </div>
                <div className="pwa-hero-card__actions pwa-hero-card__actions--two">
                  <button className="pwa-btn pwa-btn--hero-secondary" type="button" onClick={() => setShowActiveTripDetails(true)}>
                    View Details
                  </button>
                  <button className="pwa-btn pwa-btn--hero-primary" type="button" onClick={props.stopTrip} disabled={props.loading || props.syncingTripQueue}>
                    {props.loading ? "Ending..." : isOnline ? "End Trip" : "End Offline"}
                  </button>
                </div>
                {activeTripMapsUrl ? (
                  <div className="pwa-hero-card__nav-action">
                    {isOnline ? (
                      <a className="pwa-btn pwa-btn--maps pwa-btn--full" href={activeTripMapsUrl} target="_blank" rel="noreferrer">
                        <DriverIcon name="location" />
                        Open in Google Maps
                      </a>
                    ) : (
                      <button className="pwa-btn pwa-btn--maps pwa-btn--full" type="button" disabled>
                        <DriverIcon name="offline" />
                        Maps need internet
                      </button>
                    )}
                  </div>
                ) : null}
              </section>
            ) : (
              <section className={`pwa-hero-card pwa-hero-card--assigned ${nextAssignedTrip ? "" : "pwa-hero-card--empty"}`}>
                <div className="pwa-hero-card__top">
                  <span className="pwa-hero-card__eyebrow">Assigned Trip</span>
                  {nextAssignedTrip ? <span className="pwa-pill pwa-pill--light">Scheduled</span> : null}
                </div>
                {nextAssignedTrip ? (
                  <>
                    <div className="pwa-hero-card__plate">{nextAssignedVehicle?.plate_no || "Assigned Vehicle"}</div>
                    <div className="pwa-hero-card__title">{nextAssignedTrip.trip_title || "Assigned trip"}</div>
                    <div className="pwa-hero-card__route-line">
                      <span>{nextAssignedTrip.origin_label || "Origin"}</span>
                      <span>{nextAssignedTrip.destination_label || "Destination"}</span>
                    </div>
                    <div className="pwa-hero-card__subtle">{formatDate(nextAssignedTrip.scheduled_start)} • {formatTime(nextAssignedTrip.scheduled_start)}</div>
                    <div className="pwa-hero-card__actions pwa-hero-card__actions--two">
                      <button className="pwa-btn pwa-btn--hero-secondary" type="button" onClick={() => setSelectedAssignedTripId(nextAssignedTrip.id)}>
                        View Details
                      </button>
                      <button
                        className="pwa-btn pwa-btn--hero-primary"
                        type="button"
                        onClick={() => props.startTrip(nextAssignedTrip.id)}
                        disabled={props.loading || props.syncingTripQueue || Boolean(props.pendingTripSyncCount && !nextAssignedTripPendingStatus)}
                      >
                        {props.loading ? "Starting..." : isOnline ? "Start Trip" : "Start Offline"}
                      </button>
                    </div>
                    {nextAssignedTripMapsUrl ? (
                      <div className="pwa-hero-card__nav-action">
                        {isOnline ? (
                          <a className="pwa-btn pwa-btn--maps pwa-btn--full" href={nextAssignedTripMapsUrl} target="_blank" rel="noreferrer">
                            <DriverIcon name="location" />
                            Open in Google Maps
                          </a>
                        ) : (
                          <button className="pwa-btn pwa-btn--maps pwa-btn--full" type="button" disabled>
                            <DriverIcon name="offline" />
                            Maps need internet
                          </button>
                        )}
                      </div>
                    ) : null}
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
                  <div className="pwa-empty-trip">
                    <span className="pwa-empty-trip__icon"><DriverIcon name="route" /></span>
                    <div>
                      <h3>No assigned trip</h3>
                      <p>Waiting for your next route assignment.</p>
                    </div>
                  </div>
                )}
              </section>
            )}

            <section className="pwa-card pwa-card--score">
              <div>
                <div className="pwa-card__title-row">
                  <h3>Driver Score</h3>
                  <span className={`pwa-pill ${scorePillClass}`}>This Month</span>
                </div>
                <div className="pwa-score-line">
                  <strong>{displayDriverScore}</strong>
                  <span>/100</span>
                </div>
                <div className="pwa-score-caption">{displayDriverScoreLabel}</div>
              </div>
              <div className="pwa-score-ring-wrap">
                <div className="pwa-score-ring">
                  <svg viewBox="0 0 100 100">
                    <circle className="pwa-score-ring__bg" cx="50" cy="50" r="42" />
                    <circle className="pwa-score-ring__progress" cx="50" cy="50" r="42" strokeDasharray={`${displayDriverScore * 2.64} 264`} />
                  </svg>
                  <span className="pwa-score-ring__icon"><DriverIcon name="gauge" /></span>
                </div>
              </div>
            </section>

            <section className="pwa-card">
              <div className="pwa-card__title-row"><h3>Score Breakdown</h3></div>
              <div className="pwa-breakdown-grid">
                <Stat value={displayDriverScoreBreakdown.speed} label="Safety" icon="shield" />
                <Stat value={displayDriverScoreBreakdown.idle} label="Efficiency" icon="gauge" />
                <Stat value={displayDriverScoreBreakdown.distance} label="Compliance" icon="calendar" />
                <Stat value={displayDriverScoreBreakdown.consistency} label="Punctuality" icon="clock" />
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
                    const vehicle = displayVehicles.find((v) => v.id === trip.vehicle_id);
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
                            <span className={`pwa-list-item__status ${props.pendingTripStatusById[trip.id] === "sync_failed" ? "pwa-list-item__status--danger" : "pwa-list-item__status--success"}`}>
                              {getPendingTripLabel(props.pendingTripStatusById[trip.id]) || "Completed"}
                            </span>
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
                      const vehicle = displayVehicles.find((v) => v.id === trip.vehicle_id);
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
                      const vehicle = displayVehicles.find((v) => v.id === trip.vehicle_id);
                      const status = deriveTripStatus(trip);
                      const pendingStatus = props.pendingTripStatusById[trip.id];
                      return (
                        <button key={trip.id} type="button" className="pwa-trip-row pwa-trip-row--button" onClick={() => setSelectedTripId(trip.id)}>
                          <div className="pwa-trip-row__main">
                            <div className="pwa-trip-row__title-row">
                              <strong>{trip.trip_title || vehicle?.plate_no || "Trip"}</strong>
                              <span className={pendingStatus === "sync_failed" ? "pwa-pill pwa-pill--danger" : getStatusClass(status)}>
                                {getPendingTripLabel(pendingStatus) || getStatusLabel(status)}
                              </span>
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
                  {isOnline ? "Save Fuel Log" : "Save Offline"}
                </button>
              </form>
            </section>

            <section className="pwa-card">
              <div className="pwa-card__title-row"><h3>Recent Fuel Logs</h3></div>
              {fuelLoading ? (
                <div className="pwa-empty-inline">Loading fuel logs...</div>
              ) : displayFuelLogs.length === 0 ? (
                <div className="pwa-empty-inline">No fuel logs yet.</div>
              ) : (
                <div className="pwa-list">
                  {displayFuelLogs.slice(0, 5).map((log) => {
                    const vehicle = displayVehicles.find((v) => v.id === log.vehicle_id);
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
                          <div className="pwa-fuel-log-row__meta">
                            Odo: {(log.odometer_km || 0).toLocaleString()} km {log.vendor ? `• ${log.vendor}` : ""}
                            {log.id.startsWith("offline-fuel-") ? " • Pending sync" : ""}
                          </div>
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
                <div className="pwa-avatar pwa-avatar--large">{(displayName || "D").slice(0, 1).toUpperCase()}</div>
                <div className="pwa-profile-hero__body">
                  <div className="pwa-profile-hero__title-row">
                    <strong>{displayName || "Driver"}</strong>
                    <span className="pwa-pill pwa-pill--success">{displayProfile?.status || "Active"}</span>
                  </div>
                  <div className="pwa-profile-hero__line"><DriverIcon name="mail" /> {displayEmail || "Unavailable"}</div>
                  <div className="pwa-profile-hero__line"><DriverIcon name="phone" /> {displayPhone || "No phone"}</div>
                  <div className="pwa-profile-hero__line"><DriverIcon name="shield" /> {displayRole || "driver"}</div>
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
                  <input value={displayEmail || ""} readOnly />
                </label>
                <button className="pwa-btn pwa-btn--primary pwa-btn--full" type="submit" disabled={authLoading}>
                  {isOnline ? "Save Profile" : "Save Offline"}
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
                <button className="pwa-btn pwa-btn--primary pwa-btn--full" type="submit" disabled={authLoading || !isOnline}>
                  {isOnline ? "Update Password" : "Online Required"}
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
            <div className="modal__actions">
              {activeTripMapsUrl ? (
                isOnline ? (
                  <a className="btn btn--primary driver-maps-link" href={activeTripMapsUrl} target="_blank" rel="noreferrer">
                    Open in Google Maps
                  </a>
                ) : (
                  <button className="btn btn--primary driver-maps-link" type="button" disabled>
                    Maps need internet
                  </button>
                )
              ) : null}
              <button className="btn btn--secondary" type="button" onClick={() => setShowActiveTripDetails(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {selectedAssignedTrip && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--details" role="dialog" aria-modal="true" aria-label="Assigned trip details">
            <div className="modal__header">
              <div>
                <h3>Assigned Trip Details</h3>
                <p className="modal__subtle">
                  {selectedAssignedVehicle?.plate_no || "Assigned vehicle"} • {getPendingTripLabel(selectedAssignedTripPendingStatus) || "Ready to start"}
                </p>
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
            <div className="modal__actions">
              {selectedAssignedTripMapsUrl ? (
                isOnline ? (
                  <a className="btn btn--primary driver-maps-link" href={selectedAssignedTripMapsUrl} target="_blank" rel="noreferrer">
                    Open in Google Maps
                  </a>
                ) : (
                  <button className="btn btn--primary driver-maps-link" type="button" disabled>
                    Maps need internet
                  </button>
                )
              ) : null}
              <button className="btn btn--secondary" type="button" onClick={() => setSelectedAssignedTripId(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {selectedTrip && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--wide modal--details" role="dialog" aria-modal="true" aria-label="Trip history details">
            <div className="modal__header">
              <div>
                <h3>Trip Details</h3>
                <p className="modal__subtle">{displayVehicles.find((v) => v.id === selectedTrip.vehicle_id)?.plate_no || "Vehicle"} • {getStatusLabel(deriveTripStatus(selectedTrip))}</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setSelectedTripId(null)} aria-label="Close trip history details">✕</button>
            </div>
            <div className="details-grid details-grid--scroll">
              <div className="detail-item"><span>Trip Title</span><strong>{selectedTrip.trip_title || "Completed trip"}</strong></div>
              <div className="detail-item"><span>Vehicle</span><strong>{displayVehicles.find((v) => v.id === selectedTrip.vehicle_id)?.plate_no || "Vehicle"}</strong></div>
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
