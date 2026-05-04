import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import { divIcon, LatLngBounds } from "leaflet";
import { apiBaseUrl } from "../services/api";
import { useAuth } from "../context/AuthContext";

type TripRoutePreviewProps = {
  origin?: [number, number] | null;
  destination?: [number, number] | null;
};

type RoutePreviewResponse = {
  coordinates: [number, number][];
  distance_m?: number | null;
  duration_s?: number | null;
  source: "openrouteservice" | "fallback";
};

function FitRoute({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    const bounds = new LatLngBounds(points);
    map.fitBounds(bounds, { padding: [28, 28] });
  }, [map, points]);

  return null;
}

function buildRouteIcon(kind: "origin" | "destination") {
  return divIcon({
    className: "",
    html: `<span class="trip-route-marker trip-route-marker--${kind}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export default function TripRoutePreview({ origin, destination }: TripRoutePreviewProps) {
  const { token } = useAuth();
  const [routePoints, setRoutePoints] = useState<[number, number][] | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const points = useMemo(
    () => [origin, destination].filter(Boolean) as [number, number][],
    [destination, origin]
  );
  const routeLinePoints = useMemo(() => {
    if (origin && destination) {
      if (routePoints && routePoints.length >= 2) return routePoints;
      if (routeLoading && token) return null;
      return [origin, destination];
    }
    return null;
  }, [destination, origin, routeLoading, routePoints, token]);
  const displayPoints = routeLinePoints || points;

  useEffect(() => {
    setRoutePoints(null);
    if (!origin || !destination || !token) {
      setRouteLoading(false);
      return;
    }

    const controller = new AbortController();
    setRouteLoading(true);
    const params = new URLSearchParams({
      origin_lat: String(origin[0]),
      origin_lon: String(origin[1]),
      destination_lat: String(destination[0]),
      destination_lon: String(destination[1]),
    });

    fetch(`${apiBaseUrl}/trips/route-preview?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Route preview unavailable");
        return response.json() as Promise<RoutePreviewResponse>;
      })
      .then((data) => {
        if (Array.isArray(data.coordinates) && data.coordinates.length >= 2) {
          setRoutePoints(data.coordinates);
        }
        setRouteLoading(false);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setRoutePoints(null);
          setRouteLoading(false);
        }
      });

    return () => controller.abort();
  }, [destination, origin, token]);

  if (!points.length) return null;

  return (
    <MapContainer center={points[0]} zoom={12} scrollWheelZoom={false} className="trip-route-map">
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitRoute points={displayPoints} />
      {origin ? <Marker position={origin} icon={buildRouteIcon("origin")} /> : null}
      {destination ? <Marker position={destination} icon={buildRouteIcon("destination")} /> : null}
      {routeLinePoints ? <Polyline positions={routeLinePoints} pathOptions={{ color: "#3366ff", weight: 4, opacity: 0.7 }} /> : null}
    </MapContainer>
  );
}
