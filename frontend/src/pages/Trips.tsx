import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  CalendarClock,
  Car,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  FileText,
  Home,
  MapPin,
  Pencil,
  Search,
  Plus,
  Route,
  Trash2,
  Truck,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import MapView from "../components/MapView";
import TripRoutePreview from "../components/TripRoutePreview";
import PlacePickerMap from "../components/PlacePickerMap";
import { apiDelete, apiGet, apiPatch, apiPost } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../context/FeedbackContext";
import { Driver, LiveTrip, SavedPlace, Trip, Vehicle } from "../types";

const FREQUENT_TRIP_TITLES = [
  "Airport Pickup",
  "Airport Drop-off",
  "Delivery Run",
  "Staff Transport",
  "Client Meeting",
  "Site Visit",
  "Parts Collection",
  "Other",
];

type TripsProps = {
  trips: Trip[];
  vehicles: Vehicle[];
  drivers: Driver[];
  liveTrips: LiveTrip[];
  loading: boolean;
  onCreateTripAssignment: (payload: {
    vehicle_id: string;
    driver_id: string;
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
    status?: string;
  }) => Promise<void>;
  onUpdateTripAssignment: (
    tripId: string,
    payload: {
      vehicle_id?: string;
      driver_id?: string;
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
      status?: string;
    }
  ) => Promise<void>;
  onDeleteTrip: (tripId: string) => Promise<void>;
};

type TripsTab = "workflow" | "history" | "places";
type LiveTripFilter = "all" | "live" | "stale";
type TripStatusFilter = "all" | "assigned" | "in_progress" | "delayed";

type TripsIconName = "assigned" | "active" | "completed" | "vehicles";

function TripsIcon({ name }: { name: TripsIconName }) {
  const icons: Record<TripsIconName, LucideIcon> = {
    assigned: Route,
    active: Truck,
    completed: CheckCircle2,
    vehicles: Car,
  };
  const Icon = icons[name];
  return <Icon aria-hidden="true" />;
}

function formatDateTime(value?: string) {
  if (!value) return "--";
  return new Date(value).toLocaleString("en-LK", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCompactDateTime(value?: string) {
  if (!value) return "--";
  return new Date(value).toLocaleString("en-LK", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(value?: number) {
  if (!value || value <= 0) return "--";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

function deriveTripStatus(trip: Trip) {
  if (trip.status) return trip.status;
  if (trip.end_time) return "completed";
  if (trip.start_time) return "in_progress";
  return "assigned";
}

function isTripDelayedStart(trip: Trip, referenceTime = Date.now()) {
  const status = deriveTripStatus(trip);
  if (status !== "assigned" || !trip.scheduled_start) return false;
  const scheduledAt = new Date(trip.scheduled_start).getTime();
  return Number.isFinite(scheduledAt) && scheduledAt < referenceTime;
}

function formatRouteLabel(trip: Trip) {
  const origin = trip.origin_label || "Origin";
  const destination = trip.destination_label || "Destination";
  return `${origin} -> ${destination}`;
}

function tripStatusLabel(status: string) {
  if (status === "in_progress") return "In Progress";
  if (status === "assigned") return "Assigned";
  if (status === "cancelled") return "Cancelled";
  if (status === "completed") return "Completed";
  return status.replace(/_/g, " ");
}

function tripStatusClass(status: string) {
  if (status === "completed") return "status-badge--success";
  if (status === "in_progress") return "status-badge--warning";
  if (status === "assigned") return "status-badge--info";
  if (status === "cancelled") return "status-badge--danger";
  return "status-badge--warning";
}

function formatPlaceDisplay(place?: SavedPlace | null) {
  if (!place) return "";
  const name = place.name?.trim();
  const label = place.label?.trim();
  if (name && label && name !== label) return `${name} - ${label}`;
  return name || label || "";
}

function formatCoordinates(lat: number, lon: number) {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

export default function TripsPage({ trips, vehicles, drivers, liveTrips, loading, onCreateTripAssignment, onUpdateTripAssignment, onDeleteTrip }: TripsProps) {
  const { token } = useAuth();
  const feedback = useFeedback();
  const [activeTab, setActiveTab] = useState<TripsTab>("workflow");
  const [liveTripFilter, setLiveTripFilter] = useState<LiveTripFilter>("all");
  const [search, setSearch] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [workflowStatusFilter, setWorkflowStatusFilter] = useState<TripStatusFilter>("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | "completed" | "cancelled">("all");
  const [workflowRowsPerPage, setWorkflowRowsPerPage] = useState(10);
  const [historyRowsPerPage, setHistoryRowsPerPage] = useState(10);
  const [workflowPage, setWorkflowPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [showTripModal, setShowTripModal] = useState(false);
  const [tripVehicle, setTripVehicle] = useState("");
  const [tripDriver, setTripDriver] = useState("");
  const [tripTitle, setTripTitle] = useState("");
  const [tripTitleOption, setTripTitleOption] = useState("");
  const [tripScheduledStart, setTripScheduledStart] = useState("");
  const [tripOriginLabel, setTripOriginLabel] = useState("");
  const [tripDestinationLabel, setTripDestinationLabel] = useState("");
  const [tripOriginLat, setTripOriginLat] = useState("");
  const [tripOriginLon, setTripOriginLon] = useState("");
  const [tripDestinationLat, setTripDestinationLat] = useState("");
  const [tripDestinationLon, setTripDestinationLon] = useState("");
  const [tripContactName, setTripContactName] = useState("");
  const [tripContactPhone, setTripContactPhone] = useState("");
  const [tripPriority, setTripPriority] = useState("normal");
  const [tripNotes, setTripNotes] = useState("");
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [placeSearch, setPlaceSearch] = useState("");
  const [placeRowsPerPage, setPlaceRowsPerPage] = useState(10);
  const [placePage, setPlacePage] = useState(1);
  const [originPlaceId, setOriginPlaceId] = useState("");
  const [destinationPlaceId, setDestinationPlaceId] = useState("");
  const [showPlaceModal, setShowPlaceModal] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<SavedPlace | null>(null);
  const [placeTarget, setPlaceTarget] = useState<"origin" | "destination">("origin");
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
  const [placeDeleteTarget, setPlaceDeleteTarget] = useState<SavedPlace | null>(null);
  const [placeName, setPlaceName] = useState("");
  const [placeLabel, setPlaceLabel] = useState("");
  const [placeLat, setPlaceLat] = useState("");
  const [placeLon, setPlaceLon] = useState("");
  const [placeContactName, setPlaceContactName] = useState("");
  const [placeContactPhone, setPlaceContactPhone] = useState("");
  const [placeNotes, setPlaceNotes] = useState("");
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Trip | null>(null);

  useEffect(() => {
    if (!token) return;
    apiGet<SavedPlace[]>("/saved-places", token)
      .then(setSavedPlaces)
      .catch((err: any) => feedback.error("Saved places unavailable", err.message || "Failed to load saved places"));
  }, [token, feedback]);

  const vehicleLabelMap = useMemo(
    () =>
      vehicles.reduce<Record<string, string>>((acc, vehicle) => {
        acc[vehicle.id] = vehicle.plate_no;
        return acc;
      }, {}),
    [vehicles]
  );

  const driverLabelMap = useMemo(
    () =>
      drivers.reduce<Record<string, string>>((acc, driver) => {
        acc[driver.id] = driver.full_name || driver.email || driver.phone || "Driver";
        return acc;
      }, {}),
    [drivers]
  );

  const liveTripMap = useMemo(
    () =>
      liveTrips.reduce<Record<string, LiveTrip>>((acc, trip) => {
        acc[trip.trip_id] = trip;
        return acc;
      }, {}),
    [liveTrips]
  );

  const completedTrips = trips.filter((trip) => deriveTripStatus(trip) === "completed");
  const activeTrips = trips.filter((trip) => deriveTripStatus(trip) === "in_progress");
  const assignedTrips = trips.filter((trip) => deriveTripStatus(trip) === "assigned");
  const liveTrackedTrips = liveTrips.filter((trip) => !trip.stale);
  const staleTrackedTrips = liveTrips.filter((trip) => trip.stale);
  const liveVehicleCount = new Set(liveTrips.map((trip) => trip.vehicle_id).filter(Boolean)).size;
  const now = Date.now();
  const delayedTrips = trips.filter((trip) => isTripDelayedStart(trip, now));
  const latestLiveUpdate = liveTrips
    .map((trip) => new Date(trip.recorded_at).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];
  const filteredLiveTrips = useMemo(() => {
    if (liveTripFilter === "live") return liveTrips.filter((trip) => !trip.stale);
    if (liveTripFilter === "stale") return liveTrips.filter((trip) => trip.stale);
    return liveTrips;
  }, [liveTripFilter, liveTrips]);
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayTrips = trips.filter((trip) => {
    const tripDate = trip.scheduled_start || trip.start_time || trip.end_time;
    return tripDate ? String(tripDate).slice(0, 10) === todayKey : false;
  });
  const todayAssignedTrips = todayTrips.filter((trip) => deriveTripStatus(trip) === "assigned");
  const todayActiveTrips = todayTrips.filter((trip) => deriveTripStatus(trip) === "in_progress");
  const todayCompletedTrips = todayTrips.filter((trip) => deriveTripStatus(trip) === "completed");
  const assignmentQueue = [...assignedTrips]
    .sort(
      (a, b) =>
        new Date(a.scheduled_start || 0).getTime() -
        new Date(b.scheduled_start || 0).getTime()
    )
    .slice(0, 5);
  const nextAssignedTrip = assignmentQueue[0] || null;
  const savedPlacePreview = savedPlaces.slice(0, 4);

  const filteredTrips = useMemo(() => {
    return trips
      .filter((trip) => {
        const status = deriveTripStatus(trip);
        if (vehicleFilter && trip.vehicle_id !== vehicleFilter) return false;

        const query = search.trim().toLowerCase();
        if (!query) return true;

        return [
          vehicleLabelMap[trip.vehicle_id] || "",
          driverLabelMap[trip.driver_id || ""] || "",
          trip.trip_title || "",
          trip.scheduled_start || "",
          trip.origin_label || "",
          trip.destination_label || "",
          trip.contact_name || "",
          trip.contact_phone || "",
          trip.priority || "",
          trip.start_time,
          trip.end_time || "",
          trip.notes || "",
          trip.distance_km ? String(trip.distance_km) : "",
          trip.avg_speed_kmh ? String(trip.avg_speed_kmh) : "",
          trip.idle_min ? String(trip.idle_min) : "",
          status,
          isTripDelayedStart(trip, now) ? "delayed start" : "",
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort(
        (a, b) =>
          new Date(b.end_time || b.start_time || b.scheduled_start || 0).getTime() -
          new Date(a.end_time || a.start_time || a.scheduled_start || 0).getTime()
      );
  }, [trips, vehicleFilter, search, vehicleLabelMap, driverLabelMap, now]);

  const workflowTrips = useMemo(
    () => filteredTrips.filter((trip) => {
      const status = deriveTripStatus(trip);
      const inWorkflow = status === "assigned" || status === "in_progress";
      if (!inWorkflow) return false;
      if (workflowStatusFilter === "all") return true;
      if (workflowStatusFilter === "delayed") return isTripDelayedStart(trip, now);
      return status === workflowStatusFilter;
    }),
    [filteredTrips, workflowStatusFilter, now]
  );

  const historyTrips = useMemo(
    () => filteredTrips.filter((trip) => {
      const status = deriveTripStatus(trip);
      const isHistory = status === "completed" || status === "cancelled";
      if (!isHistory) return false;
      if (historyStatusFilter !== "all" && status !== historyStatusFilter) return false;
      return true;
    }),
    [filteredTrips, historyStatusFilter]
  );

  const workflowTotalPages = Math.max(1, Math.ceil(workflowTrips.length / workflowRowsPerPage));
  const currentWorkflowPage = Math.min(workflowPage, workflowTotalPages);
  const paginatedWorkflowTrips = workflowTrips.slice(
    (currentWorkflowPage - 1) * workflowRowsPerPage,
    currentWorkflowPage * workflowRowsPerPage
  );

  const historyTotalPages = Math.max(1, Math.ceil(historyTrips.length / historyRowsPerPage));
  const currentHistoryPage = Math.min(historyPage, historyTotalPages);
  const paginatedHistoryTrips = historyTrips.slice(
    (currentHistoryPage - 1) * historyRowsPerPage,
    currentHistoryPage * historyRowsPerPage
  );

  const filteredPlaces = useMemo(() => {
    const query = placeSearch.trim().toLowerCase();
    if (!query) return savedPlaces;
    return savedPlaces.filter((place) =>
      [
        place.name,
        place.label,
        place.contact_name || "",
        place.contact_phone || "",
        place.notes || "",
        formatCoordinates(Number(place.lat), Number(place.lon)),
      ].some((value) => value.toLowerCase().includes(query))
    );
  }, [savedPlaces, placeSearch]);

  const placeTotalPages = Math.max(1, Math.ceil(filteredPlaces.length / placeRowsPerPage));
  const currentPlacePage = Math.min(placePage, placeTotalPages);
  const paginatedPlaces = filteredPlaces.slice(
    (currentPlacePage - 1) * placeRowsPerPage,
    currentPlacePage * placeRowsPerPage
  );

  useEffect(() => {
    setWorkflowPage(1);
  }, [search, vehicleFilter, workflowStatusFilter, workflowRowsPerPage, trips.length]);

  useEffect(() => {
    setHistoryPage(1);
  }, [search, vehicleFilter, historyStatusFilter, historyRowsPerPage, trips.length]);

  useEffect(() => {
    setPlacePage(1);
  }, [placeSearch, placeRowsPerPage, savedPlaces.length]);

  function assignOriginFromPlace(placeId: string) {
    setOriginPlaceId(placeId);
    const place = savedPlaces.find((row) => String(row.id) === String(placeId));
    if (!place) {
      setTripOriginLabel("");
      setTripOriginLat("");
      setTripOriginLon("");
      return;
    }
    setTripOriginLabel(place.label);
    setTripOriginLat(String(place.lat));
    setTripOriginLon(String(place.lon));
    if (place.contact_name) setTripContactName(place.contact_name);
    if (place.contact_phone) setTripContactPhone(place.contact_phone);
  }

  function applyOriginPlace(place: SavedPlace) {
    setOriginPlaceId(place.id);
    setTripOriginLabel(formatPlaceDisplay(place));
    setTripOriginLat(String(place.lat));
    setTripOriginLon(String(place.lon));
  }

  function assignDestinationFromPlace(placeId: string) {
    setDestinationPlaceId(placeId);
    const place = savedPlaces.find((row) => String(row.id) === String(placeId));
    if (!place) {
      setTripDestinationLabel("");
      setTripDestinationLat("");
      setTripDestinationLon("");
      return;
    }
    setTripDestinationLabel(place.label);
    setTripDestinationLat(String(place.lat));
    setTripDestinationLon(String(place.lon));
    if (place.contact_name) setTripContactName(place.contact_name);
    if (place.contact_phone) setTripContactPhone(place.contact_phone);
  }

  function applyDestinationPlace(place: SavedPlace) {
    setDestinationPlaceId(place.id);
    setTripDestinationLabel(formatPlaceDisplay(place));
    setTripDestinationLat(String(place.lat));
    setTripDestinationLon(String(place.lon));
    if (place.contact_name) setTripContactName(place.contact_name);
    if (place.contact_phone) setTripContactPhone(place.contact_phone);
  }

  function openPlaceModal(target: "origin" | "destination") {
    setPlaceTarget(target);
    setEditingPlaceId(null);
    setPlaceName("");
    setPlaceLabel("");
    setPlaceLat("");
    setPlaceLon("");
    setPlaceContactName("");
    setPlaceContactPhone("");
    setPlaceNotes("");
    setShowPlaceModal(true);
  }

  function openStandalonePlaceModal() {
    setPlaceTarget("origin");
    setEditingPlaceId(null);
    setPlaceName("");
    setPlaceLabel("");
    setPlaceLat("");
    setPlaceLon("");
    setPlaceContactName("");
    setPlaceContactPhone("");
    setPlaceNotes("");
    setShowPlaceModal(true);
  }

  function openEditPlaceModal(place: SavedPlace) {
    setEditingPlaceId(place.id);
    setPlaceTarget("origin");
    setPlaceName(place.name);
    setPlaceLabel(place.label);
    setPlaceLat(String(place.lat));
    setPlaceLon(String(place.lon));
    setPlaceContactName(place.contact_name || "");
    setPlaceContactPhone(place.contact_phone || "");
    setPlaceNotes(place.notes || "");
    setShowPlaceModal(true);
  }

  function openCreateModal() {
    setEditingTripId(null);
    setTripVehicle("");
    setTripDriver("");
    setTripTitle("");
    setTripTitleOption("");
    setTripScheduledStart("");
    setOriginPlaceId("");
    setDestinationPlaceId("");
    setTripOriginLabel("");
    setTripDestinationLabel("");
    setTripOriginLat("");
    setTripOriginLon("");
    setTripDestinationLat("");
    setTripDestinationLon("");
    setTripContactName("");
    setTripContactPhone("");
    setTripPriority("normal");
    setTripNotes("");
    setShowTripModal(true);
  }

  function openEditModal(trip: Trip) {
    setEditingTripId(trip.id);
    setTripVehicle(trip.vehicle_id);
    setTripDriver(trip.driver_id || "");
    setTripTitle(trip.trip_title || "");
    setTripTitleOption(
      trip.trip_title && FREQUENT_TRIP_TITLES.includes(trip.trip_title) && trip.trip_title !== "Other"
        ? trip.trip_title
        : trip.trip_title
          ? "Other"
          : ""
    );
    setTripScheduledStart(trip.scheduled_start ? String(trip.scheduled_start).slice(0, 16) : "");
    const matchedOrigin = savedPlaces.find(
      (place) => Number(place.lat) === Number(trip.origin_lat) && Number(place.lon) === Number(trip.origin_lon)
    );
    const matchedDestination = savedPlaces.find(
      (place) =>
        Number(place.lat) === Number(trip.destination_lat) &&
        Number(place.lon) === Number(trip.destination_lon)
    );
    setOriginPlaceId(matchedOrigin?.id || "");
    setDestinationPlaceId(matchedDestination?.id || "");
    setTripOriginLabel(trip.origin_label || "");
    setTripDestinationLabel(trip.destination_label || "");
    setTripOriginLat(trip.origin_lat != null ? String(trip.origin_lat) : "");
    setTripOriginLon(trip.origin_lon != null ? String(trip.origin_lon) : "");
    setTripDestinationLat(trip.destination_lat != null ? String(trip.destination_lat) : "");
    setTripDestinationLon(trip.destination_lon != null ? String(trip.destination_lon) : "");
    setTripContactName(trip.contact_name || "");
    setTripContactPhone(trip.contact_phone || "");
    setTripPriority(trip.priority || "normal");
    setTripNotes(trip.notes || "");
    setShowTripModal(true);
  }

  async function handleSavePlace(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    try {
      if (!placeName.trim() || !placeLabel.trim()) {
        throw new Error("Name and address are required");
      }
      if (Number.isNaN(Number(placeLat)) || Number.isNaN(Number(placeLon))) {
        throw new Error("Latitude and longitude must be valid numbers");
      }
      if (Number(placeLat) < -90 || Number(placeLat) > 90) {
        throw new Error("Latitude must be between -90 and 90");
      }
      if (Number(placeLon) < -180 || Number(placeLon) > 180) {
        throw new Error("Longitude must be between -180 and 180");
      }
      const duplicate = savedPlaces.find(
        (row) =>
          row.id !== editingPlaceId &&
          row.name.trim().toLowerCase() === placeName.trim().toLowerCase()
      );
      if (duplicate) {
        throw new Error("A saved place with this name already exists");
      }
      const payload = {
        name: placeName,
        label: placeLabel,
        lat: Number(placeLat),
        lon: Number(placeLon),
        contact_name: placeContactName || undefined,
        contact_phone: placeContactPhone || undefined,
        notes: placeNotes || undefined,
      };
      const saved = editingPlaceId
        ? await apiPatch<SavedPlace>(`/saved-places/${editingPlaceId}`, payload, token)
        : await apiPost<SavedPlace>("/saved-places", payload, token);
      setSavedPlaces((prev) => {
        const next = editingPlaceId ? prev.map((row) => (row.id === saved.id ? saved : row)) : [...prev, saved];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      if (!editingPlaceId) {
        if (placeTarget === "origin") {
          applyOriginPlace(saved);
        } else {
          applyDestinationPlace(saved);
        }
      } else {
        if (String(originPlaceId) === String(saved.id)) {
          applyOriginPlace(saved);
        }
        if (String(destinationPlaceId) === String(saved.id)) {
          applyDestinationPlace(saved);
        }
      }
      setShowPlaceModal(false);
      feedback.success(editingPlaceId ? "Saved place updated" : "Saved place created");
    } catch (err: any) {
      feedback.error("Saved place failed", err.message || "Failed to save place");
    }
  }

  async function confirmPlaceDelete() {
    if (!token || !placeDeleteTarget) return;
    try {
      await apiDelete(`/saved-places/${placeDeleteTarget.id}`, token);
      setSavedPlaces((prev) => prev.filter((row) => row.id !== placeDeleteTarget.id));
      if (String(originPlaceId) === String(placeDeleteTarget.id)) {
        setOriginPlaceId("");
        setTripOriginLabel("");
        setTripOriginLat("");
        setTripOriginLon("");
      }
      if (String(destinationPlaceId) === String(placeDeleteTarget.id)) {
        setDestinationPlaceId("");
        setTripDestinationLabel("");
        setTripDestinationLat("");
        setTripDestinationLon("");
      }
      setPlaceDeleteTarget(null);
      feedback.success("Saved place deleted");
    } catch (err: any) {
      feedback.error("Saved place delete failed", err.message || "Failed to delete place");
    }
  }

  async function handleSubmitAssignment(e: FormEvent) {
    e.preventDefault();
    if (!tripVehicle || !tripDriver) return;
    const selectedOriginPlace = savedPlaces.find((place) => String(place.id) === String(originPlaceId));
    const selectedDestinationPlace = savedPlaces.find((place) => String(place.id) === String(destinationPlaceId));
    const payload = {
      vehicle_id: tripVehicle,
      driver_id: tripDriver,
      trip_title: tripTitle || undefined,
      scheduled_start: tripScheduledStart ? new Date(tripScheduledStart).toISOString() : undefined,
      origin_label: formatPlaceDisplay(selectedOriginPlace) || tripOriginLabel || undefined,
      destination_label: formatPlaceDisplay(selectedDestinationPlace) || tripDestinationLabel || undefined,
      origin_lat: selectedOriginPlace?.lat ?? (tripOriginLat ? Number(tripOriginLat) : undefined),
      origin_lon: selectedOriginPlace?.lon ?? (tripOriginLon ? Number(tripOriginLon) : undefined),
      destination_lat: selectedDestinationPlace?.lat ?? (tripDestinationLat ? Number(tripDestinationLat) : undefined),
      destination_lon: selectedDestinationPlace?.lon ?? (tripDestinationLon ? Number(tripDestinationLon) : undefined),
      contact_name: tripContactName || undefined,
      contact_phone: tripContactPhone || undefined,
      priority: tripPriority || undefined,
      notes: tripNotes || undefined,
      status: "assigned",
    };
    if (editingTripId) {
      await onUpdateTripAssignment(editingTripId, payload);
    } else {
      await onCreateTripAssignment(payload);
    }
    setShowTripModal(false);
    setEditingTripId(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await onDeleteTrip(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <section className="section">
      <section className="admin-page trips-page">
      <div className="dashboard-kpis trips-kpi-grid" aria-label="Trip dispatch summary">
        <article className="dashboard-kpi-card dashboard-kpi-card--teal trips-kpi-card">
          <span className="dashboard-kpi-card__icon trips-kpi-card__icon"><TripsIcon name="assigned" /></span>
          <div>
            <span className="dashboard-kpi-card__label">Assigned Trips</span>
            <strong>{assignedTrips.length}</strong>
            <small className="dashboard-trend">{delayedTrips.length > 0 ? `${delayedTrips.length} delayed` : "Ready for drivers"}</small>
          </div>
        </article>
        <article className="dashboard-kpi-card dashboard-kpi-card--blue trips-kpi-card">
          <span className="dashboard-kpi-card__icon trips-kpi-card__icon"><TripsIcon name="active" /></span>
          <div>
            <span className="dashboard-kpi-card__label">In Progress</span>
            <strong>{activeTrips.length}</strong>
            <small className="dashboard-trend">{staleTrackedTrips.length > 0 ? `${staleTrackedTrips.length} stale GPS` : "Live workflow"}</small>
          </div>
        </article>
        <article className="dashboard-kpi-card dashboard-kpi-card--green trips-kpi-card">
          <span className="dashboard-kpi-card__icon trips-kpi-card__icon"><TripsIcon name="completed" /></span>
          <div>
            <span className="dashboard-kpi-card__label">Completed Today</span>
            <strong>{todayCompletedTrips.length}</strong>
            <small className="dashboard-trend">{completedTrips.length} completed total</small>
          </div>
        </article>
        <article className="dashboard-kpi-card dashboard-kpi-card--orange trips-kpi-card">
          <span className="dashboard-kpi-card__icon trips-kpi-card__icon"><TripsIcon name="vehicles" /></span>
          <div>
            <span className="dashboard-kpi-card__label">Live Vehicles</span>
            <strong>{liveVehicleCount}</strong>
            <small className="dashboard-trend">{liveTrips.length} tracked trips</small>
          </div>
        </article>
      </div>

      <div className="trips-dispatch-layout">
        <section className="trips-board-card trips-map-card">
          <div className="trips-card-header">
            <div>
              <h3>Live Dispatch Map</h3>
              <p>{latestLiveUpdate ? `Updated ${formatCompactDateTime(new Date(latestLiveUpdate).toISOString())}` : "Waiting for live tracking updates"}</p>
            </div>
            <div className="trips-map-status">
              <span className="trips-status-dot trips-status-dot--live" />
              Live
            </div>
          </div>
          <div className="trips-map-panel">
            <MapView trips={filteredLiveTrips} />
            <div className="trips-map-legend">
              <span><i className="trips-status-dot trips-status-dot--live" /> Live ({liveTrackedTrips.length})</span>
              <span><i className="trips-status-dot trips-status-dot--route" /> In Progress ({activeTrips.length})</span>
              <span><i className="trips-status-dot trips-status-dot--stale" /> Stale ({staleTrackedTrips.length})</span>
            </div>
          </div>
          <div className="trips-filter-row">
            <button className={`filter-chip ${liveTripFilter === "all" ? "filter-chip--active" : ""}`} type="button" onClick={() => setLiveTripFilter("all")}>
              All ({liveTrips.length})
            </button>
            <button className={`filter-chip ${liveTripFilter === "live" ? "filter-chip--active" : ""}`} type="button" onClick={() => setLiveTripFilter("live")}>
              Live ({liveTrackedTrips.length})
            </button>
            <button className={`filter-chip ${liveTripFilter === "stale" ? "filter-chip--active" : ""}`} type="button" onClick={() => setLiveTripFilter("stale")}>
              Stale ({staleTrackedTrips.length})
            </button>
          </div>
        </section>

        <aside className="trips-side-stack" aria-label="Dispatch controls">
          <button className="trips-assign-button" type="button" onClick={openCreateModal}>
            <Plus aria-hidden="true" />
            Assign Trip
          </button>

          <section className="trips-board-card trips-quick-card">
            <div className="trips-card-header trips-card-header--compact">
              <h3>Quick Trip Setup</h3>
            </div>
            {nextAssignedTrip ? (
              <div className="trips-quick-list">
                <div><Route aria-hidden="true" /><span>Route</span><strong>{formatRouteLabel(nextAssignedTrip)}</strong></div>
                <div><Truck aria-hidden="true" /><span>Vehicle</span><strong>{vehicleLabelMap[nextAssignedTrip.vehicle_id] || "Vehicle"}</strong></div>
                <div><UserRound aria-hidden="true" /><span>Driver</span><strong>{driverLabelMap[nextAssignedTrip.driver_id || ""] || "Driver"}</strong></div>
                <div><Clock aria-hidden="true" /><span>Start Time</span><strong>{formatCompactDateTime(nextAssignedTrip.scheduled_start)}</strong></div>
                <div><Activity aria-hidden="true" /><span>Est. Distance</span><strong>{nextAssignedTrip.distance_km ? `${nextAssignedTrip.distance_km.toFixed(1)} km` : "--"}</strong></div>
                <button className="trips-text-action" type="button" onClick={() => openEditModal(nextAssignedTrip)}>Edit Details</button>
              </div>
            ) : (
              <div className="trips-empty-state trips-empty-state--compact">
                <CalendarClock aria-hidden="true" />
                <div>
                  <strong>No upcoming assigned trip</strong>
                  <span>Create an assignment to populate this setup preview.</span>
                </div>
              </div>
            )}
          </section>

          <section className="trips-board-card trips-saved-preview-card">
            <div className="trips-card-header trips-card-header--compact trips-card-header--inline">
              <h3>Saved Places</h3>
              <button type="button" onClick={() => setActiveTab("places")}>Manage Places</button>
            </div>
            {savedPlacePreview.length === 0 ? (
              <div className="trips-empty-state trips-empty-state--compact">
                <MapPin aria-hidden="true" />
                <div>
                  <strong>No saved places</strong>
                  <span>Add frequent dispatch points for faster assignments.</span>
                </div>
              </div>
            ) : (
              <div className="trips-place-shortcuts">
                {savedPlacePreview.map((place, index) => {
                  const icons = [Home, Building2, Wrench, MapPin];
                  const PlaceIcon = icons[index] || MapPin;
                  return (
                    <button key={place.id} type="button" onClick={() => setSelectedPlace(place)}>
                      <PlaceIcon aria-hidden="true" />
                      <span>{place.name}</span>
                      <small>{place.label}</small>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="trips-board-card trips-overview-card">
            <div className="trips-card-header trips-card-header--compact">
              <h3>Today's Dispatch Overview</h3>
            </div>
            <div className="trips-overview-grid">
              <div><CalendarClock aria-hidden="true" /><span>Awaiting Assignment</span><strong>{todayAssignedTrips.length}</strong></div>
              <div><AlertTriangle aria-hidden="true" /><span>Delayed Starts</span><strong>{delayedTrips.length}</strong></div>
              <div><Truck aria-hidden="true" /><span>Active Deliveries</span><strong>{todayActiveTrips.length}</strong></div>
              <div><MapPin aria-hidden="true" /><span>Saved Places</span><strong>{savedPlaces.length}</strong></div>
            </div>
          </section>
        </aside>
      </div>

      <section className="trips-board-card trips-table-card">
      <nav className="trips-table-tabs" aria-label="Trip sections">
        <button
          type="button"
          className={`trips-table-tab ${activeTab === "workflow" ? "trips-table-tab--active" : ""}`}
          onClick={() => setActiveTab("workflow")}
        >
          Workflow Queue
        </button>
        <button
          type="button"
          className={`trips-table-tab ${activeTab === "history" ? "trips-table-tab--active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          Trip History
        </button>
        <button
          type="button"
          className={`trips-table-tab ${activeTab === "places" ? "trips-table-tab--active" : ""}`}
          onClick={() => setActiveTab("places")}
        >
          Saved Places
        </button>
      </nav>

      {activeTab === "workflow" && (
      <section className="trips-table-pane">
        <div className="trips-table-controls trips-table-controls--workflow">
          <label className="trips-search-control">
            <Search aria-hidden="true" />
            <input
              type="search"
              placeholder="Search trips, vehicles, drivers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="trips-select-control">
            <span>Status</span>
            <select value={workflowStatusFilter} onChange={(e) => setWorkflowStatusFilter(e.target.value as TripStatusFilter)}>
              <option value="all">All Statuses</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="delayed">Delayed</option>
            </select>
          </label>
          <label className="trips-select-control">
            <span>Vehicle</span>
            <select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}>
              <option value="">All Vehicles</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.plate_no}</option>
              ))}
            </select>
          </label>
          <label className="trips-select-control trips-select-control--rows">
            <span>Rows</span>
            <select value={workflowRowsPerPage} onChange={(e) => setWorkflowRowsPerPage(Number(e.target.value))}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>
        {workflowTrips.length === 0 ? (
          <p className="empty">No assigned or ongoing trips match the current filters.</p>
        ) : (
          <>
            <div className="table trips-table" style={{ ["--table-columns" as any]: 7 }}>
              <div className="table__head trips-table__head">
                <span>Trip</span>
                <span>Vehicle</span>
                <span>Driver</span>
                <span>Route</span>
                <span>Scheduled Start</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {paginatedWorkflowTrips.map((trip) => {
                const liveTrip = liveTripMap[trip.id];
                const baseStatus = deriveTripStatus(trip);
                const delayedStart = isTripDelayedStart(trip, now);
                const trackingWarning = baseStatus === "in_progress" && liveTrip?.stale;
                return (
                  <div className="table__row trips-table__row" key={trip.id}>
                    <span data-label="Trip"><strong>{trip.trip_title || trip.id.slice(0, 8)}</strong></span>
                    <span data-label="Vehicle">{vehicleLabelMap[trip.vehicle_id] || "Vehicle"}</span>
                    <span data-label="Driver">{driverLabelMap[trip.driver_id || ""] || "--"}</span>
                    <span data-label="Route">{formatRouteLabel(trip)}</span>
                    <span data-label="Scheduled Start">{trip.scheduled_start ? formatCompactDateTime(trip.scheduled_start) : "--"}</span>
                    <span className="trips-status-cell" data-label="Status">
                      <span className={`status-badge ${tripStatusClass(baseStatus)}`}>{tripStatusLabel(baseStatus)}</span>
                      <span className={`trips-status-note ${delayedStart || trackingWarning ? "" : "trips-status-note--empty"}`}>
                        {delayedStart ? "Delayed start" : trackingWarning ? "Stale GPS" : ""}
                      </span>
                    </span>
                      <span className="table__actions trips-table__actions" data-label="Actions">
                      {(baseStatus === "assigned" || baseStatus === "cancelled") ? (
                        <>
                          <span className="trips-action-slot">
                            <button
                              className="icon-action"
                              type="button"
                              onClick={() => setSelectedTrip(trip)}
                              aria-label="View trip"
                              title="View trip"
                            >
                              <Eye className="icon-action__svg icon-action__svg--view" aria-hidden="true" />
                            </button>
                          </span>
                          <span className="trips-action-slot">
                            <button className="icon-action" type="button" onClick={() => openEditModal(trip)} aria-label="Edit trip" title="Edit trip">
                              <Pencil className="icon-action__svg icon-action__svg--edit" aria-hidden="true" />
                            </button>
                          </span>
                          <span className="trips-action-slot">
                            <button className="icon-action icon-action--danger" type="button" onClick={() => setDeleteTarget(trip)} aria-label="Delete trip" title="Delete trip">
                              <Trash2 className="icon-action__svg icon-action__svg--delete" aria-hidden="true" />
                            </button>
                          </span>
                        </>
                      ) : (
                        <span className="trips-action-slot">
                          <button
                            className="icon-action"
                            type="button"
                            onClick={() => setSelectedTrip(trip)}
                            aria-label="View trip"
                            title="View trip"
                          >
                            <Eye className="icon-action__svg icon-action__svg--view" aria-hidden="true" />
                          </button>
                        </span>
                      )}
                      </span>
                  </div>
                );
              })}
            </div>
            <div className="trips-table-footer">
              <span>Showing {paginatedWorkflowTrips.length} of {workflowTrips.length} entries</span>
              <div>
                <button type="button" onClick={() => setWorkflowPage((prev) => Math.max(1, prev - 1))} disabled={currentWorkflowPage === 1}>Prev</button>
                <strong>{currentWorkflowPage}</strong>
                <button type="button" onClick={() => setWorkflowPage((prev) => Math.min(workflowTotalPages, prev + 1))} disabled={currentWorkflowPage === workflowTotalPages}>Next</button>
              </div>
            </div>
          </>
        )}
      </section>
      )}

      {activeTab === "history" && (
      <section className="trips-table-pane">
        <div className="trips-table-controls trips-table-controls--history">
          <label className="trips-search-control">
            <Search aria-hidden="true" />
            <input
              type="search"
              placeholder="Search trip history..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="trips-select-control">
            <span>Status</span>
            <select value={historyStatusFilter} onChange={(e) => setHistoryStatusFilter(e.target.value as any)}>
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="trips-select-control">
            <span>Vehicle</span>
            <select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}>
              <option value="">All Vehicles</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.plate_no}</option>
              ))}
            </select>
          </label>
          <label className="trips-select-control trips-select-control--rows">
            <span>Rows</span>
            <select value={historyRowsPerPage} onChange={(e) => setHistoryRowsPerPage(Number(e.target.value))}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>
        {historyTrips.length === 0 ? (
          <p className="empty">No completed trip history matches the current filters.</p>
        ) : (
          <>
            <div className="table trips-table" style={{ ["--table-columns" as any]: 7 }}>
              <div className="table__head trips-table__head">
                <span>Trip</span>
                <span>Vehicle</span>
                <span>Driver</span>
                <span>Route</span>
                <span>Scheduled Start</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {paginatedHistoryTrips.map((trip) => {
                const status = deriveTripStatus(trip);

                return (
                  <div className="table__row trips-table__row" key={trip.id}>
                    <span data-label="Trip"><strong>{trip.trip_title || trip.id.slice(0, 8)}</strong></span>
                    <span data-label="Vehicle">{vehicleLabelMap[trip.vehicle_id] || "Vehicle"}</span>
                    <span data-label="Driver">{driverLabelMap[trip.driver_id || ""] || "--"}</span>
                    <span data-label="Route">{formatRouteLabel(trip)}</span>
                    <span data-label="Scheduled Start">{trip.scheduled_start ? formatCompactDateTime(trip.scheduled_start) : "--"}</span>
                    <span className="trips-status-cell" data-label="Status">
                      <span className={`status-badge ${tripStatusClass(status)}`}>{tripStatusLabel(status)}</span>
                      <span className="trips-status-note trips-status-note--empty" />
                    </span>
                    <span className="table__actions trips-table__actions" data-label="Actions">
                      <span className="trips-action-slot">
                        <button
                          className="icon-action"
                          type="button"
                          onClick={() => setSelectedTrip(trip)}
                          aria-label="View trip"
                          title="View trip"
                        >
                          <Eye className="icon-action__svg icon-action__svg--view" aria-hidden="true" />
                        </button>
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="trips-table-footer">
              <span>Showing {paginatedHistoryTrips.length} of {historyTrips.length} entries</span>
              <div>
                <button type="button" onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))} disabled={currentHistoryPage === 1}>Prev</button>
                <strong>{currentHistoryPage}</strong>
                <button type="button" onClick={() => setHistoryPage((prev) => Math.min(historyTotalPages, prev + 1))} disabled={currentHistoryPage === historyTotalPages}>Next</button>
              </div>
            </div>
          </>
        )}
      </section>
      )}

      {activeTab === "places" && (
      <section className="trips-table-pane">
        <div className="trips-table-controls trips-table-controls--places">
          <label className="trips-search-control">
            <Search aria-hidden="true" />
            <input
              type="search"
              placeholder="Search places, labels, contact..."
              value={placeSearch}
              onChange={(e) => setPlaceSearch(e.target.value)}
            />
          </label>
          <label className="trips-select-control trips-select-control--rows">
            <span>Rows</span>
            <select value={placeRowsPerPage} onChange={(e) => setPlaceRowsPerPage(Number(e.target.value))}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
          <button className="trips-table-action" type="button" onClick={openStandalonePlaceModal}>
            <Plus aria-hidden="true" />
            Add Place
          </button>
        </div>

        {savedPlaces.length === 0 ? (
          <p className="empty">No saved places yet. Add your frequent locations first.</p>
        ) : (
          <>
            <div className="table places-table" style={{ ["--table-columns" as any]: 5 }}>
              <div className="table__head places-table__head">
                <span>Name</span>
                <span>Label</span>
                <span>Contact</span>
                <span>Coordinates</span>
                <span>Actions</span>
              </div>
              {paginatedPlaces.map((place) => (
                <div className="table__row places-table__row" key={place.id}>
                  <span data-label="Name"><strong>{place.name}</strong></span>
                  <span data-label="Label">{place.label}</span>
                  <span data-label="Contact">{place.contact_phone || place.contact_name || "--"}</span>
                  <span data-label="Coordinates">{formatCoordinates(Number(place.lat), Number(place.lon))}</span>
                  <span className="table__actions places-table__actions" data-label="Actions">
                    <span className="trips-action-slot">
                      <button className="icon-action" type="button" onClick={() => setSelectedPlace(place)} aria-label="View place" title="View place">
                        <Eye className="icon-action__svg icon-action__svg--view" aria-hidden="true" />
                      </button>
                    </span>
                    <span className="trips-action-slot">
                      <button className="icon-action" type="button" onClick={() => openEditPlaceModal(place)} aria-label="Edit place" title="Edit place">
                        <Pencil className="icon-action__svg icon-action__svg--edit" aria-hidden="true" />
                      </button>
                    </span>
                    <span className="trips-action-slot">
                      <button className="icon-action icon-action--danger" type="button" onClick={() => setPlaceDeleteTarget(place)} aria-label="Delete place" title="Delete place">
                        <Trash2 className="icon-action__svg icon-action__svg--delete" aria-hidden="true" />
                      </button>
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <div className="trips-table-footer">
              <span>Showing {paginatedPlaces.length} of {filteredPlaces.length} entries</span>
              <div>
                <button type="button" onClick={() => setPlacePage((prev) => Math.max(1, prev - 1))} disabled={currentPlacePage === 1}>Prev</button>
                <strong>{currentPlacePage}</strong>
                <button type="button" onClick={() => setPlacePage((prev) => Math.min(placeTotalPages, prev + 1))} disabled={currentPlacePage === placeTotalPages}>Next</button>
              </div>
            </div>
          </>
        )}
      </section>
      )}

      </section>

      {selectedTrip && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--wide modal--details" role="dialog" aria-modal="true" aria-label="Trip details">
            <div className="modal__header">
              <div>
                <h3>Trip Details</h3>
                <p className="modal__subtle">
                  {vehicleLabelMap[selectedTrip.vehicle_id] || "Vehicle"} • {driverLabelMap[selectedTrip.driver_id || ""] || "Driver"}
                </p>
              </div>
              <button className="modal__close" type="button" onClick={() => setSelectedTrip(null)} aria-label="Close trip details">
                ✕
              </button>
            </div>

            <div className="modal__body">
              <section className="modal-detail-section">
                <h4 className="modal-detail-section__title">Assignment</h4>
                <div className="details-grid">
                  <div className="detail-item"><span>Trip Title</span><strong>{selectedTrip.trip_title || "--"}</strong></div>
                  <div className="detail-item"><span>Vehicle</span><strong>{vehicleLabelMap[selectedTrip.vehicle_id] || "--"}</strong></div>
                  <div className="detail-item"><span>Driver</span><strong>{driverLabelMap[selectedTrip.driver_id || ""] || "--"}</strong></div>
                  <div className="detail-item"><span>Trip ID</span><strong>{selectedTrip.id}</strong></div>
                  <div className="detail-item"><span>Contact Person</span><strong>{selectedTrip.contact_name || "--"}</strong></div>
                  <div className="detail-item"><span>Contact Phone</span><strong>{selectedTrip.contact_phone || "--"}</strong></div>
                </div>
              </section>

              <section className="modal-detail-section">
                <h4 className="modal-detail-section__title">Schedule & Status</h4>
                <div className="details-grid">
                  <div className="detail-item">
                    <span>Status</span>
                    <strong>
                      {deriveTripStatus(selectedTrip) === "in_progress"
                        ? liveTripMap[selectedTrip.id]?.stale
                          ? "In Progress • Stale"
                          : "In Progress"
                        : deriveTripStatus(selectedTrip) === "assigned"
                          ? "Assigned"
                          : deriveTripStatus(selectedTrip) === "cancelled"
                            ? "Cancelled"
                            : "Completed"}
                    </strong>
                  </div>
                  <div className="detail-item"><span>Priority</span><strong>{selectedTrip.priority || "normal"}</strong></div>
                  <div className="detail-item"><span>Scheduled Start</span><strong>{selectedTrip.scheduled_start ? formatDateTime(selectedTrip.scheduled_start) : "--"}</strong></div>
                  <div className="detail-item"><span>Started</span><strong>{formatDateTime(selectedTrip.start_time)}</strong></div>
                  <div className="detail-item"><span>Ended</span><strong>{selectedTrip.end_time ? formatDateTime(selectedTrip.end_time) : "--"}</strong></div>
                  {!selectedTrip.end_time && liveTripMap[selectedTrip.id] ? (
                    <>
                      <div className="detail-item"><span>Last GPS Update</span><strong>{formatDateTime(liveTripMap[selectedTrip.id].recorded_at)}</strong></div>
                      <div className="detail-item">
                        <span>Live Speed</span>
                        <strong>
                          {liveTripMap[selectedTrip.id].speed_kmh !== undefined && liveTripMap[selectedTrip.id].speed_kmh !== null
                            ? `${liveTripMap[selectedTrip.id].speed_kmh!.toFixed(1)} km/h`
                            : "--"}
                        </strong>
                      </div>
                    </>
                  ) : null}
                </div>
              </section>

              <section className="modal-detail-section">
                <h4 className="modal-detail-section__title">Route</h4>
                <div className="details-grid">
                  <div className="detail-item"><span>Origin</span><strong>{selectedTrip.origin_label || "--"}</strong></div>
                  <div className="detail-item"><span>Destination</span><strong>{selectedTrip.destination_label || "--"}</strong></div>
                  <div className="detail-item">
                    <span>Start Coordinates</span>
                    <strong>
                      {selectedTrip.start_lat != null && selectedTrip.start_lon != null
                        ? `${selectedTrip.start_lat.toFixed(5)}, ${selectedTrip.start_lon.toFixed(5)}`
                        : "--"}
                    </strong>
                  </div>
                  <div className="detail-item">
                    <span>End Coordinates</span>
                    <strong>
                      {selectedTrip.end_lat != null && selectedTrip.end_lon != null
                        ? `${selectedTrip.end_lat.toFixed(5)}, ${selectedTrip.end_lon.toFixed(5)}`
                        : "--"}
                    </strong>
                  </div>
                  <div className="modal-route-preview">
                    <TripRoutePreview
                      origin={
                        selectedTrip.origin_lat != null && selectedTrip.origin_lon != null
                          ? [selectedTrip.origin_lat, selectedTrip.origin_lon]
                          : null
                      }
                      destination={
                        selectedTrip.destination_lat != null && selectedTrip.destination_lon != null
                          ? [selectedTrip.destination_lat, selectedTrip.destination_lon]
                          : null
                      }
                    />
                  </div>
                </div>
              </section>

              <section className="modal-detail-section">
                <h4 className="modal-detail-section__title">Performance</h4>
                <div className="details-grid">
                  <div className="detail-item"><span>Distance</span><strong>{selectedTrip.distance_km ? `${selectedTrip.distance_km.toFixed(1)} km` : "--"}</strong></div>
                  <div className="detail-item"><span>Duration</span><strong>{formatDuration(selectedTrip.duration_min)}</strong></div>
                  <div className="detail-item"><span>Average Speed</span><strong>{selectedTrip.avg_speed_kmh ? `${selectedTrip.avg_speed_kmh.toFixed(1)} km/h` : "--"}</strong></div>
                  <div className="detail-item"><span>Idle Time</span><strong>{formatDuration(selectedTrip.idle_min)}</strong></div>
                </div>
              </section>

              <section className="modal-detail-section">
                <h4 className="modal-detail-section__title">Notes</h4>
                <div className="details-grid">
                  <div className="detail-item detail-item--full"><span>Dispatch Notes</span><strong>{selectedTrip.notes || "--"}</strong></div>
                </div>
              </section>
            </div>

            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={() => setSelectedTrip(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showTripModal && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--wide modal--form" role="dialog" aria-modal="true" aria-label="Trip assignment form">
            <div className="modal__header">
              <div>
                <h3>{editingTripId ? "Edit Trip Assignment" : "Assign Trip"}</h3>
                <p className="modal__subtle">Choose the driver and vehicle before the trip begins.</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setShowTripModal(false)} aria-label="Close trip form">
                ✕
              </button>
            </div>
            <form id="trip-assignment-form" className="form form--two-col form--scroll" onSubmit={handleSubmitAssignment}>
              <div className="form-section-title form__field--full">
                <Route aria-hidden="true" />
                <div>
                  <h4>Assignment</h4>
                  <p>Select the vehicle, driver, title, and dispatch time.</p>
                </div>
              </div>
              <label>
                Vehicle
                <select value={tripVehicle} onChange={(e) => setTripVehicle(e.target.value)} required>
                  <option value="">Select vehicle</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>{vehicle.plate_no}</option>
                  ))}
                </select>
              </label>
              <label>
                Driver
                <select value={tripDriver} onChange={(e) => setTripDriver(e.target.value)} required>
                  <option value="">Select driver</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.full_name || driver.email || driver.phone || driver.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Trip Title
                <select
                  value={tripTitleOption}
                  onChange={(e) => {
                    const value = e.target.value;
                    setTripTitleOption(value);
                    if (!value) {
                      setTripTitle("");
                    } else if (value !== "Other") {
                      setTripTitle(value);
                    } else {
                      setTripTitle("");
                    }
                  }}
                >
                  <option value="">Select trip title</option>
                  {FREQUENT_TRIP_TITLES.map((title) => (
                    <option key={title} value={title}>
                      {title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Scheduled Start
                <input type="datetime-local" value={tripScheduledStart} onChange={(e) => setTripScheduledStart(e.target.value)} />
              </label>
              {tripTitleOption === "Other" ? (
                <label className="form__field--full">
                  Custom Trip Title
                  <input value={tripTitle} onChange={(e) => setTripTitle(e.target.value)} placeholder="Enter trip title" />
                </label>
              ) : null}
              <div className="form-section-title form__field--full">
                <MapPin aria-hidden="true" />
                <div>
                  <h4>Route</h4>
                  <p>Use saved places so drivers receive clear pickup and destination details.</p>
                </div>
              </div>
              <label>
                Origin Place
                <select value={originPlaceId} onChange={(e) => assignOriginFromPlace(e.target.value)}>
                  <option value="">Select saved place</option>
                  {savedPlaces.map((place) => (
                    <option key={place.id} value={place.id}>
                      {place.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Destination Place
                <select value={destinationPlaceId} onChange={(e) => assignDestinationFromPlace(e.target.value)}>
                  <option value="">Select saved place</option>
                  {savedPlaces.map((place) => (
                    <option key={place.id} value={place.id}>
                      {place.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="trip-place-actions form__field--full">
                <button className="btn btn--secondary btn--compact" type="button" onClick={() => openPlaceModal("origin")}>
                  Add Place If Not Listed
                </button>
              </div>
              {(tripOriginLat && tripOriginLon) || (tripDestinationLat && tripDestinationLon) ? (
                <div className="form__field--full">
                  <label>Route Preview</label>
                  <TripRoutePreview
                    origin={tripOriginLat && tripOriginLon ? [Number(tripOriginLat), Number(tripOriginLon)] : null}
                    destination={
                      tripDestinationLat && tripDestinationLon ? [Number(tripDestinationLat), Number(tripDestinationLon)] : null
                    }
                  />
                </div>
              ) : null}
              <div className="form-section-title form__field--full">
                <Activity aria-hidden="true" />
                <div>
                  <h4>Contact</h4>
                  <p>Add the person drivers should call during pickup or delivery.</p>
                </div>
              </div>
              <label>
                Contact Person
                <input value={tripContactName} onChange={(e) => setTripContactName(e.target.value)} placeholder="Dispatch contact" />
              </label>
              <label>
                Contact Phone
                <input value={tripContactPhone} onChange={(e) => setTripContactPhone(e.target.value)} placeholder="+94..." />
              </label>
              <div className="form-section-title form__field--full">
                <CalendarClock aria-hidden="true" />
                <div>
                  <h4>Priority & Notes</h4>
                  <p>Set urgency and include instructions that should travel with the assignment.</p>
                </div>
              </div>
              <label>
                Priority
                <select value={tripPriority} onChange={(e) => setTripPriority(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <label className="form__field--full">
                Notes
                <textarea rows={3} value={tripNotes} onChange={(e) => setTripNotes(e.target.value)} placeholder="Optional trip instructions" />
              </label>
            </form>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={() => setShowTripModal(false)}>
                Cancel
              </button>
              <button className="btn" type="submit" form="trip-assignment-form" disabled={loading || !tripVehicle || !tripDriver}>
                {loading ? "Saving..." : editingTripId ? "Save Assignment" : "Assign Trip"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPlaceModal && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--wide modal--form" role="dialog" aria-modal="true" aria-label="Add saved place">
            <div className="modal__header">
              <div>
                <h3>{editingPlaceId ? "Edit Saved Place" : "Add Saved Place"}</h3>
                <p className="modal__subtle">Click the map or enter coordinates manually. The saved place library is shared across trip assignments.</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setShowPlaceModal(false)} aria-label="Close place form">
                ✕
              </button>
            </div>
            <form id="saved-place-form" className="form form--two-col form--scroll" onSubmit={handleSavePlace}>
              <div className="form-section-title form__field--full">
                <MapPin aria-hidden="true" />
                <div>
                  <h4>Location</h4>
                  <p>Name the place and pin its coordinates for route previews.</p>
                </div>
              </div>
              <label>
                Place Name
                <input value={placeName} onChange={(e) => setPlaceName(e.target.value)} placeholder="Airport Terminal 1" required />
              </label>
              <label>
                Address / Label
                <input value={placeLabel} onChange={(e) => setPlaceLabel(e.target.value)} placeholder="Bandaranaike International Airport" required />
              </label>
              <label>
                Latitude
                <input value={placeLat} onChange={(e) => setPlaceLat(e.target.value)} placeholder="7.1808" required />
              </label>
              <label>
                Longitude
                <input value={placeLon} onChange={(e) => setPlaceLon(e.target.value)} placeholder="79.8841" required />
              </label>
              <div className="form-section-title form__field--full">
                <Activity aria-hidden="true" />
                <div>
                  <h4>Contact</h4>
                  <p>Store a contact when the place has a regular receiver or dispatcher.</p>
                </div>
              </div>
              <label>
                Contact Person
                <input value={placeContactName} onChange={(e) => setPlaceContactName(e.target.value)} placeholder="Optional contact" />
              </label>
              <label>
                Contact Phone
                <input value={placeContactPhone} onChange={(e) => setPlaceContactPhone(e.target.value)} placeholder="+94..." />
              </label>
              <div className="form-section-title form__field--full">
                <ClipboardList aria-hidden="true" />
                <div>
                  <h4>Notes</h4>
                  <p>Add access instructions or delivery notes used by dispatch.</p>
                </div>
              </div>
              <label className="form__field--full">
                Notes
                <textarea rows={3} value={placeNotes} onChange={(e) => setPlaceNotes(e.target.value)} placeholder="Optional place notes" />
              </label>
              <div className="form__field--full">
                <label>Pick on Map</label>
                <PlacePickerMap
                  lat={placeLat ? Number(placeLat) : null}
                  lon={placeLon ? Number(placeLon) : null}
                  onPick={(lat, lon) => {
                    setPlaceLat(lat.toFixed(6));
                    setPlaceLon(lon.toFixed(6));
                  }}
                />
              </div>
            </form>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={() => setShowPlaceModal(false)}>
                Cancel
              </button>
              <button className="btn" type="submit" form="saved-place-form">
                Save Place
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPlace && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--wide modal--details" role="dialog" aria-modal="true" aria-label="Saved place details">
            <div className="modal__header">
              <div>
                <h3>Place Details</h3>
                <p className="modal__subtle">{selectedPlace.name}</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setSelectedPlace(null)} aria-label="Close place details">
                ✕
              </button>
            </div>
            <div className="details-grid details-grid--scroll">
              <div className="detail-item">
                <span>Place Name</span>
                <strong>{selectedPlace.name}</strong>
              </div>
              <div className="detail-item">
                <span>Address</span>
                <strong>{selectedPlace.label}</strong>
              </div>
              <div className="detail-item">
                <span>Latitude</span>
                <strong>{Number(selectedPlace.lat).toFixed(6)}</strong>
              </div>
              <div className="detail-item">
                <span>Longitude</span>
                <strong>{Number(selectedPlace.lon).toFixed(6)}</strong>
              </div>
              <div className="detail-item">
                <span>Contact Person</span>
                <strong>{selectedPlace.contact_name || "--"}</strong>
              </div>
              <div className="detail-item">
                <span>Contact Phone</span>
                <strong>{selectedPlace.contact_phone || "--"}</strong>
              </div>
              <div className="detail-item detail-item--full">
                <span>Notes</span>
                <strong>{selectedPlace.notes || "--"}</strong>
              </div>
              <div className="detail-item detail-item--full">
                <span>Map Preview</span>
                <PlacePickerMap
                  lat={Number(selectedPlace.lat)}
                  lon={Number(selectedPlace.lon)}
                  onPick={() => {}}
                />
              </div>
            </div>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={() => setSelectedPlace(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {placeDeleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Delete saved place">
            <div className="modal__header">
              <div>
                <h3>Delete Saved Place</h3>
                <p className="modal__subtle">This removes the place from future trip assignments only.</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setPlaceDeleteTarget(null)} aria-label="Close saved place delete dialog">
                ✕
              </button>
            </div>
            <p>
              Delete <strong>{placeDeleteTarget.name}</strong>?
            </p>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={() => setPlaceDeleteTarget(null)}>
                Cancel
              </button>
              <button className="btn btn--danger" type="button" onClick={confirmPlaceDelete} disabled={loading}>
                {loading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Delete trip">
            <div className="modal__header">
              <div>
                <h3>Delete Trip</h3>
                <p className="modal__subtle">Only trips that have not started should be deleted.</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setDeleteTarget(null)} aria-label="Close trip delete dialog">
                ✕
              </button>
            </div>
            <p>
              Delete the trip for <strong>{vehicleLabelMap[deleteTarget.vehicle_id] || "Vehicle"}</strong>?
            </p>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="btn btn--danger" type="button" onClick={confirmDelete} disabled={loading}>
                {loading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
      </section>
    </section>
  );
}
