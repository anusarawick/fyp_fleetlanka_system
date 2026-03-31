import { FormEvent, useEffect, useMemo, useState } from "react";
import TripRoutePreview from "../components/TripRoutePreview";
import PlacePickerMap from "../components/PlacePickerMap";
import { apiDelete, apiGet, apiPatch, apiPost } from "../services/api";
import { useAuth } from "../context/AuthContext";
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
  const { token, setError } = useAuth();
  const [search, setSearch] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("");
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
  const [showPlacesManager, setShowPlacesManager] = useState(false);
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
      .catch((err: any) => setError(err.message || "Failed to load saved places"));
  }, [token, setError]);

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

  const totalDistance = trips.reduce((sum, trip) => sum + (trip.distance_km || 0), 0);
  const completedTrips = trips.filter((trip) => deriveTripStatus(trip) === "completed");
  const activeTrips = trips.filter((trip) => deriveTripStatus(trip) === "in_progress");
  const liveTrackedTrips = liveTrips.filter((trip) => !trip.stale);
  const staleTrackedTrips = liveTrips.filter((trip) => trip.stale);
  const avgDuration =
    completedTrips.length > 0
      ? completedTrips.reduce((sum, trip) => sum + (trip.duration_min || 0), 0) / completedTrips.length
      : 0;
  const avgSpeed =
    completedTrips.length > 0
      ? completedTrips.reduce((sum, trip) => sum + (trip.avg_speed_kmh || 0), 0) / completedTrips.length
      : 0;
  const totalIdleMinutes = completedTrips.reduce((sum, trip) => sum + (trip.idle_min || 0), 0);

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
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort(
        (a, b) =>
          new Date(b.end_time || b.start_time || b.scheduled_start || 0).getTime() -
          new Date(a.end_time || a.start_time || a.scheduled_start || 0).getTime()
      );
  }, [trips, vehicleFilter, search, vehicleLabelMap, driverLabelMap]);

  const workflowTrips = useMemo(
    () => filteredTrips.filter((trip) => {
      const status = deriveTripStatus(trip);
      return status === "assigned" || status === "in_progress";
    }),
    [filteredTrips]
  );

  const historyTrips = useMemo(
    () => filteredTrips.filter((trip) => {
      const status = deriveTripStatus(trip);
      return status === "completed" || status === "cancelled";
    }),
    [filteredTrips]
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
    setHistoryPage(1);
  }, [search, vehicleFilter, workflowRowsPerPage, historyRowsPerPage, trips.length]);

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
    } catch (err: any) {
      setError(err.message || "Failed to save place");
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
    } catch (err: any) {
      setError(err.message || "Failed to delete place");
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
      <div className="stats trips-stats">
        <div className="stat-card">
          <div className="stat-icon">🧭</div>
          <div className="stat-value">{trips.length}</div>
          <div className="stat-label">Total Trips</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🟢</div>
          <div className="stat-value">{activeTrips.length}</div>
          <div className="stat-label">Active Now</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📍</div>
          <div className="stat-value">{totalDistance.toFixed(0)} km</div>
          <div className="stat-label">Distance Logged</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-value">{avgDuration > 0 ? formatDuration(Math.round(avgDuration)) : "--"}</div>
          <div className="stat-label">Avg Completed Duration</div>
        </div>
      </div>

      <div className="grid" style={{ marginBottom: "24px" }}>
        <section className="card">
          <div className="card__header">
            <h3>Trip Actions</h3>
          </div>
          <div className="button-row">
            <button className="btn" type="button" onClick={openCreateModal}>
              + Assign Trip
            </button>
            <button className="btn" type="button" onClick={() => openPlaceModal("origin")}>
              + Add Place
            </button>
            <button className="btn btn--compact" type="button" onClick={() => setShowPlacesManager(true)}>
              Manage Places
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <h3>Trip Overview</h3>
          </div>
          <ul className="list">
            <li>
                <div className="list__title">Assigned Trips</div>
                <div className="list__meta">{trips.filter((trip) => deriveTripStatus(trip) === "assigned").length} jobs waiting for driver start</div>
              </li>
              <li>
                <div className="list__title">Completed Trips</div>
                <div className="list__meta">{completedTrips.length} finished journeys recorded</div>
              </li>
            <li>
              <div className="list__title">Average Speed</div>
              <div className="list__meta">{avgSpeed > 0 ? `${avgSpeed.toFixed(1)} km/h` : "--"}</div>
            </li>
            <li>
              <div className="list__title">Idle Time Logged</div>
              <div className="list__meta">{totalIdleMinutes > 0 ? formatDuration(totalIdleMinutes) : "--"}</div>
            </li>
          </ul>
        </section>

        <section className="card">
          <div className="card__header">
            <h3>Live Tracking Snapshot</h3>
          </div>
          {liveTrips.length === 0 ? (
            <p className="empty">No trips are currently reporting live driver tracking.</p>
          ) : (
            <ul className="list">
              <li>
                <div className="list__title">Live Signals</div>
                <div className="list__meta">{liveTrackedTrips.length} trips currently updating location</div>
              </li>
              <li>
                <div className="list__title">Stale Signals</div>
                <div className="list__meta">{staleTrackedTrips.length} active trips need a fresh GPS update</div>
              </li>
              {liveTrips.slice(0, 2).map((trip) => (
                <li key={trip.trip_id}>
                  <div className="list__title">{trip.vehicle_plate_no || vehicleLabelMap[trip.vehicle_id] || "Vehicle"}</div>
                  <div className="list__meta">
                    {trip.driver_name || "Driver"} • Updated {formatCompactDateTime(trip.recorded_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card__header">
          <h3>Assigned and Ongoing Trips</h3>
        </div>
        {workflowTrips.length === 0 ? (
          <p className="empty">No assigned or ongoing trips match the current filters.</p>
        ) : (
          <>
            <div className="table-controls">
              <div className="table-controls__filters">
                <label className="table-controls__label table-controls__label--search">
                  Search
                  <input
                    type="search"
                    placeholder="Vehicle, driver, time..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label className="table-controls__label">
                  Vehicle
                  <select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}>
                    <option value="">All</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.plate_no}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="table-controls__label">
                  Rows
                  <select value={workflowRowsPerPage} onChange={(e) => setWorkflowRowsPerPage(Number(e.target.value))}>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>
              <div className="table-pagination">
                <span className="table-pagination__meta">
                  Page {currentWorkflowPage} of {workflowTotalPages}
                </span>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setWorkflowPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentWorkflowPage === 1}
                >
                  Prev
                </button>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setWorkflowPage((prev) => Math.min(workflowTotalPages, prev + 1))}
                  disabled={currentWorkflowPage === workflowTotalPages}
                >
                  Next
                </button>
              </div>
            </div>

            <div className="table trips-table" style={{ ["--table-columns" as any]: 7 }}>
              <div className="table__head trips-table__head">
                <span>Started</span>
                <span>Ended</span>
                <span>Vehicle</span>
                <span>Driver</span>
                <span>Distance</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {paginatedWorkflowTrips.map((trip) => {
                const liveTrip = liveTripMap[trip.id];
                const status = deriveTripStatus(trip);
                const statusLabel =
                  status === "in_progress"
                    ? liveTrip?.stale
                      ? "In Progress • Stale"
                      : "In Progress"
                    : status === "assigned"
                      ? "Assigned"
                      : status === "cancelled"
                        ? "Cancelled"
                        : "Completed";
                const statusClass =
                  status === "in_progress"
                    ? liveTrip?.stale
                      ? "pill--warning"
                      : "pill--success"
                    : status === "assigned"
                      ? "pill--scheduled"
                      : status === "cancelled"
                        ? "pill--danger"
                        : "pill--info";

                return (
                  <div className="table__row trips-table__row" key={trip.id}>
                    <span data-label="Started">{trip.start_time ? formatCompactDateTime(trip.start_time) : trip.scheduled_start ? formatCompactDateTime(trip.scheduled_start) : "--"}</span>
                    <span data-label="Ended">{trip.end_time ? formatCompactDateTime(trip.end_time) : "--"}</span>
                    <span data-label="Vehicle">{vehicleLabelMap[trip.vehicle_id] || "Vehicle"}</span>
                    <span data-label="Driver">{driverLabelMap[trip.driver_id || ""] || "--"}</span>
                    <span data-label="Distance">{trip.distance_km ? `${trip.distance_km.toFixed(1)} km` : "--"}</span>
                    <span data-label="Status">
                      <span className={`pill ${statusClass}`}>{statusLabel}</span>
                    </span>
                    <span className="table__actions" data-label="Actions">
                      <button
                        className="icon-action"
                        type="button"
                        onClick={() => setSelectedTrip(trip)}
                        aria-label="View trip"
                        title="View trip"
                      >
                        <svg className="icon-action__svg icon-action__svg--view" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12Z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
                        </svg>
                      </button>
                      {(status === "assigned" || status === "cancelled") && (
                        <>
                          <button className="icon-action" type="button" onClick={() => openEditModal(trip)} aria-label="Edit trip" title="Edit trip">
                            <svg className="icon-action__svg icon-action__svg--edit" viewBox="0 0 24 24" aria-hidden="true">
                              <path d="m16.862 4.487 2.651 2.651m-1.616-4.687a2.25 2.25 0 1 1 3.182 3.182L7.5 19.212 3.75 20.25l1.038-3.75L17.897 2.451Z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <button className="icon-action icon-action--danger" type="button" onClick={() => setDeleteTarget(trip)} aria-label="Delete trip" title="Delete trip">
                            <svg className="icon-action__svg icon-action__svg--delete" viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M6 7.5h12m-10.5 0V6A1.5 1.5 0 0 1 9 4.5h6A1.5 1.5 0 0 1 16.5 6v1.5m-9 0 .664 9.294A1.5 1.5 0 0 0 9.66 18.75h4.68a1.5 1.5 0 0 0 1.496-1.956L16.5 7.5m-6 3v4.5m3-4.5v4.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="card" style={{ marginTop: "24px" }}>
        <div className="card__header">
          <h3>Trip History</h3>
        </div>
        {historyTrips.length === 0 ? (
          <p className="empty">No completed trip history matches the current filters.</p>
        ) : (
          <>
            <div className="table-controls">
              <div className="table-controls__filters">
                <label className="table-controls__label">
                  Rows
                  <select value={historyRowsPerPage} onChange={(e) => setHistoryRowsPerPage(Number(e.target.value))}>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>
              <div className="table-pagination">
                <span className="table-pagination__meta">
                  Page {currentHistoryPage} of {historyTotalPages}
                </span>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentHistoryPage === 1}
                >
                  Prev
                </button>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setHistoryPage((prev) => Math.min(historyTotalPages, prev + 1))}
                  disabled={currentHistoryPage === historyTotalPages}
                >
                  Next
                </button>
              </div>
            </div>

            <div className="table trips-table" style={{ ["--table-columns" as any]: 7 }}>
              <div className="table__head trips-table__head">
                <span>Started</span>
                <span>Ended</span>
                <span>Vehicle</span>
                <span>Driver</span>
                <span>Distance</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {paginatedHistoryTrips.map((trip) => {
                const status = deriveTripStatus(trip);
                const statusClass = status === "cancelled" ? "pill--danger" : "pill--info";
                const statusLabel = status === "cancelled" ? "Cancelled" : "Completed";

                return (
                  <div className="table__row trips-table__row" key={trip.id}>
                    <span data-label="Started">{trip.start_time ? formatCompactDateTime(trip.start_time) : trip.scheduled_start ? formatCompactDateTime(trip.scheduled_start) : "--"}</span>
                    <span data-label="Ended">{trip.end_time ? formatCompactDateTime(trip.end_time) : "--"}</span>
                    <span data-label="Vehicle">{vehicleLabelMap[trip.vehicle_id] || "Vehicle"}</span>
                    <span data-label="Driver">{driverLabelMap[trip.driver_id || ""] || "--"}</span>
                    <span data-label="Distance">{trip.distance_km ? `${trip.distance_km.toFixed(1)} km` : "--"}</span>
                    <span data-label="Status">
                      <span className={`pill ${statusClass}`}>{statusLabel}</span>
                    </span>
                    <span className="table__actions" data-label="Actions">
                      <button
                        className="icon-action"
                        type="button"
                        onClick={() => setSelectedTrip(trip)}
                        aria-label="View trip"
                        title="View trip"
                      >
                        <svg className="icon-action__svg icon-action__svg--view" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12Z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
                        </svg>
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </>
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

            <div className="details-grid details-grid--scroll">
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
              <div className="detail-item">
                <span>Scheduled Start</span>
                <strong>{selectedTrip.scheduled_start ? formatDateTime(selectedTrip.scheduled_start) : "--"}</strong>
              </div>
              <div className="detail-item">
                <span>Vehicle</span>
                <strong>{vehicleLabelMap[selectedTrip.vehicle_id] || "--"}</strong>
              </div>
              <div className="detail-item">
                <span>Trip Title</span>
                <strong>{selectedTrip.trip_title || "--"}</strong>
              </div>
              <div className="detail-item">
                <span>Driver</span>
                <strong>{driverLabelMap[selectedTrip.driver_id || ""] || "--"}</strong>
              </div>
              <div className="detail-item">
                <span>Trip ID</span>
                <strong>{selectedTrip.id}</strong>
              </div>
              <div className="detail-item">
                <span>Started</span>
                <strong>{formatDateTime(selectedTrip.start_time)}</strong>
              </div>
              <div className="detail-item">
                <span>Priority</span>
                <strong>{selectedTrip.priority || "normal"}</strong>
              </div>
              <div className="detail-item">
                <span>Origin</span>
                <strong>{selectedTrip.origin_label || "--"}</strong>
              </div>
              <div className="detail-item">
                <span>Destination</span>
                <strong>{selectedTrip.destination_label || "--"}</strong>
              </div>
              <div className="detail-item">
                <span>Contact Person</span>
                <strong>{selectedTrip.contact_name || "--"}</strong>
              </div>
              <div className="detail-item">
                <span>Contact Phone</span>
                <strong>{selectedTrip.contact_phone || "--"}</strong>
              </div>
              <div className="detail-item">
                <span>Ended</span>
                <strong>{selectedTrip.end_time ? formatDateTime(selectedTrip.end_time) : "--"}</strong>
              </div>
              <div className="detail-item">
                <span>Distance</span>
                <strong>{selectedTrip.distance_km ? `${selectedTrip.distance_km.toFixed(1)} km` : "--"}</strong>
              </div>
              <div className="detail-item">
                <span>Duration</span>
                <strong>{formatDuration(selectedTrip.duration_min)}</strong>
              </div>
              <div className="detail-item">
                <span>Average Speed</span>
                <strong>{selectedTrip.avg_speed_kmh ? `${selectedTrip.avg_speed_kmh.toFixed(1)} km/h` : "--"}</strong>
              </div>
              <div className="detail-item">
                <span>Idle Time</span>
                <strong>{formatDuration(selectedTrip.idle_min)}</strong>
              </div>
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
              {!selectedTrip.end_time && liveTripMap[selectedTrip.id] ? (
                <>
                  <div className="detail-item">
                    <span>Last GPS Update</span>
                    <strong>{formatDateTime(liveTripMap[selectedTrip.id].recorded_at)}</strong>
                  </div>
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
              <div className="detail-item detail-item--full">
                <span>Notes</span>
                <strong>{selectedTrip.notes || "--"}</strong>
              </div>
              <div className="detail-item detail-item--full">
                <span>Route Preview</span>
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
              <label>
                Contact Person
                <input value={tripContactName} onChange={(e) => setTripContactName(e.target.value)} placeholder="Dispatch contact" />
              </label>
              <label>
                Contact Phone
                <input value={tripContactPhone} onChange={(e) => setTripContactPhone(e.target.value)} placeholder="+94..." />
              </label>
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

      {showPlacesManager && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--wide modal--form" role="dialog" aria-modal="true" aria-label="Manage saved places">
            <div className="modal__header">
              <div>
                <h3>Manage Places</h3>
                <p className="modal__subtle">Manage the saved place library used by trip assignments.</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setShowPlacesManager(false)} aria-label="Close places manager">
                ✕
              </button>
            </div>
            <div className="form form--scroll">
              <div className="table-controls">
                <div className="table-controls__filters">
                  <label className="table-controls__label table-controls__label--search">
                    Search
                    <input
                      type="search"
                      placeholder="Name, address, contact..."
                      value={placeSearch}
                      onChange={(e) => setPlaceSearch(e.target.value)}
                    />
                  </label>
                  <label className="table-controls__label">
                    Rows
                    <select value={placeRowsPerPage} onChange={(e) => setPlaceRowsPerPage(Number(e.target.value))}>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                </div>
                <div className="table-pagination">
                  <span className="table-pagination__meta">
                    Page {currentPlacePage} of {placeTotalPages}
                  </span>
                  <button
                    className="btn btn--secondary btn--compact"
                    type="button"
                    onClick={() => setPlacePage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPlacePage === 1}
                  >
                    Prev
                  </button>
                  <button
                    className="btn btn--secondary btn--compact"
                    type="button"
                    onClick={() => setPlacePage((prev) => Math.min(placeTotalPages, prev + 1))}
                    disabled={currentPlacePage === placeTotalPages}
                  >
                    Next
                  </button>
                </div>
              </div>

              {savedPlaces.length === 0 ? (
                <p className="empty">No saved places yet. Add your frequent locations first.</p>
              ) : (
                <div className="table places-table" style={{ ["--table-columns" as any]: 5 }}>
                  <div className="table__head places-table__head">
                    <span>Place</span>
                    <span>Address</span>
                    <span>Contact</span>
                    <span>Coordinates</span>
                    <span>Actions</span>
                  </div>
                  {paginatedPlaces.map((place) => (
                    <div className="table__row places-table__row" key={place.id}>
                      <span data-label="Place">{place.name}</span>
                      <span data-label="Address">{place.label}</span>
                      <span data-label="Contact">{place.contact_phone || place.contact_name || "--"}</span>
                      <span data-label="Coordinates">{formatCoordinates(Number(place.lat), Number(place.lon))}</span>
                      <span className="table__actions places-table__actions" data-label="Actions">
                        <button className="icon-action" type="button" onClick={() => setSelectedPlace(place)} aria-label="View place" title="View place">
                          <svg className="icon-action__svg icon-action__svg--view" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12Z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
                          </svg>
                        </button>
                        <button className="icon-action" type="button" onClick={() => openEditPlaceModal(place)} aria-label="Edit place" title="Edit place">
                          <svg className="icon-action__svg icon-action__svg--edit" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="m16.862 4.487 2.651 2.651m-1.616-4.687a2.25 2.25 0 1 1 3.182 3.182L7.5 19.212 3.75 20.25l1.038-3.75L17.897 2.451Z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button className="icon-action icon-action--danger" type="button" onClick={() => setPlaceDeleteTarget(place)} aria-label="Delete place" title="Delete place">
                          <svg className="icon-action__svg icon-action__svg--delete" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M6 7.5h12m-10.5 0V6A1.5 1.5 0 0 1 9 4.5h6A1.5 1.5 0 0 1 16.5 6v1.5m-9 0 .664 9.294A1.5 1.5 0 0 0 9.66 18.75h4.68a1.5 1.5 0 0 0 1.496-1.956L16.5 7.5m-6 3v4.5m3-4.5v4.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={() => setShowPlacesManager(false)}>
                Close
              </button>
              <button className="btn" type="button" onClick={openStandalonePlaceModal}>
                + Add Place
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
              <label>
                Contact Person
                <input value={placeContactName} onChange={(e) => setPlaceContactName(e.target.value)} placeholder="Optional contact" />
              </label>
              <label>
                Contact Phone
                <input value={placeContactPhone} onChange={(e) => setPlaceContactPhone(e.target.value)} placeholder="+94..." />
              </label>
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
  );
}
