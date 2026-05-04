import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { divIcon, LatLngBounds } from "leaflet";
import { LiveTrip } from "../types";

type MapViewProps = {
  trips?: LiveTrip[];
  center?: [number, number];
  zoom?: number;
};

function FitMapToTrips({ trips, fallbackCenter, fallbackZoom }: { trips: LiveTrip[]; fallbackCenter: [number, number]; fallbackZoom: number }) {
  const map = useMap();

  useEffect(() => {
    if (!trips.length) {
      map.setView(fallbackCenter, fallbackZoom);
      return;
    }
    if (trips.length === 1) {
      map.setView([trips[0].lat, trips[0].lon], 13);
      return;
    }
    const bounds = new LatLngBounds(trips.map((trip) => [trip.lat, trip.lon] as [number, number]));
    map.fitBounds(bounds, { padding: [32, 32] });
  }, [map, trips, fallbackCenter, fallbackZoom]);

  return null;
}

function buildTripIcon(stale: boolean) {
  return divIcon({
    className: "",
    html: `<span class="live-map-marker ${stale ? "live-map-marker--stale" : "live-map-marker--live"}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export default function MapView({ trips = [], center = [6.9271, 79.8612], zoom = 11 }: MapViewProps) {
  const normalizedTrips = trips.filter(
    (trip) => Number.isFinite(trip.lat) && Number.isFinite(trip.lon)
  );

  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className="map-leaflet">
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitMapToTrips trips={normalizedTrips} fallbackCenter={center} fallbackZoom={zoom} />
      {normalizedTrips.map((trip) => (
        <Marker
          key={trip.trip_id}
          position={[trip.lat, trip.lon]}
          icon={buildTripIcon(trip.stale)}
        >
          <Popup>
            <div className="live-map-popup">
              <strong>{trip.vehicle_plate_no || "Vehicle"}</strong>
              <div>{trip.vehicle_label || "Assigned vehicle"}</div>
              <div>{trip.driver_name || "Driver not assigned"}</div>
              <div>Started: {new Date(trip.start_time).toLocaleString()}</div>
              <div>Updated: {new Date(trip.recorded_at).toLocaleString()}</div>
              <div>
                Status: {trip.stale ? "Stale" : "Live"}
                {trip.speed_kmh !== undefined && trip.speed_kmh !== null
                  ? ` • ${trip.speed_kmh.toFixed(1)} km/h`
                  : ""}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
