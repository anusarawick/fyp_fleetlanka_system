import { useEffect, useMemo, useState } from "react";
import { Driver, LiveTrip, Trip, Vehicle } from "../types";

type TripsProps = {
  trips: Trip[];
  vehicles: Vehicle[];
  drivers: Driver[];
  liveTrips: LiveTrip[];
};

type TripStatusFilter = "all" | "active" | "completed";

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

export default function TripsPage({ trips, vehicles, drivers, liveTrips }: TripsProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TripStatusFilter>("all");
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

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
  const completedTrips = trips.filter((trip) => !!trip.end_time);
  const activeTrips = trips.filter((trip) => !trip.end_time);
  const avgDuration =
    completedTrips.length > 0
      ? completedTrips.reduce((sum, trip) => sum + (trip.duration_min || 0), 0) / completedTrips.length
      : 0;

  const filteredTrips = useMemo(() => {
    return trips
      .filter((trip) => {
        const status = trip.end_time ? "completed" : "active";
        if (statusFilter !== "all" && statusFilter !== status) return false;
        if (vehicleFilter && trip.vehicle_id !== vehicleFilter) return false;

        const query = search.trim().toLowerCase();
        if (!query) return true;

        return [
          vehicleLabelMap[trip.vehicle_id] || "",
          driverLabelMap[trip.driver_id || ""] || "",
          trip.start_time,
          trip.end_time || "",
          trip.distance_km ? String(trip.distance_km) : "",
          trip.avg_speed_kmh ? String(trip.avg_speed_kmh) : "",
          trip.idle_min ? String(trip.idle_min) : "",
          status,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((a, b) => new Date(b.end_time || b.start_time).getTime() - new Date(a.end_time || a.start_time).getTime());
  }, [trips, statusFilter, vehicleFilter, search, vehicleLabelMap, driverLabelMap]);

  const totalPages = Math.max(1, Math.ceil(filteredTrips.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginatedTrips = filteredTrips.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, vehicleFilter, rowsPerPage, trips.length]);

  return (
    <section className="section">
      <div className="stats" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: "24px" }}>
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

      <section className="card">
        <div className="card__header">
          <h3>Trip Register</h3>
        </div>
        {trips.length === 0 ? (
          <p className="empty">No trips recorded yet.</p>
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
                  Status
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TripStatusFilter)}>
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
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
                  <select value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))}>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>
              <div className="table-pagination">
                <span className="table-pagination__meta">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Prev
                </button>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
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
              {paginatedTrips.map((trip) => {
                const liveTrip = liveTripMap[trip.id];
                const isActive = !trip.end_time;
                const statusLabel = isActive ? (liveTrip?.stale ? "Active • Stale" : "Active") : "Completed";
                const statusClass = isActive ? (liveTrip?.stale ? "pill--warning" : "pill--success") : "pill--info";

                return (
                  <div className="table__row trips-table__row" key={trip.id}>
                    <span data-label="Started">{formatCompactDateTime(trip.start_time)}</span>
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
                  {!selectedTrip.end_time
                    ? liveTripMap[selectedTrip.id]?.stale
                      ? "Active • Stale"
                      : "Active"
                    : "Completed"}
                </strong>
              </div>
              <div className="detail-item">
                <span>Vehicle</span>
                <strong>{vehicleLabelMap[selectedTrip.vehicle_id] || "--"}</strong>
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
                  {selectedTrip.start_lat !== undefined && selectedTrip.start_lon !== undefined
                    ? `${selectedTrip.start_lat.toFixed(5)}, ${selectedTrip.start_lon.toFixed(5)}`
                    : "--"}
                </strong>
              </div>
              <div className="detail-item">
                <span>End Coordinates</span>
                <strong>
                  {selectedTrip.end_lat !== undefined && selectedTrip.end_lon !== undefined
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
            </div>

            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={() => setSelectedTrip(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
