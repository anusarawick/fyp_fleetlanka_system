import { useEffect } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import { divIcon, LatLngBounds } from "leaflet";

type TripRoutePreviewProps = {
  origin?: [number, number] | null;
  destination?: [number, number] | null;
};

function FitRoute({ origin, destination }: { origin?: [number, number] | null; destination?: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    const points = [origin, destination].filter(Boolean) as [number, number][];
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    const bounds = new LatLngBounds(points);
    map.fitBounds(bounds, { padding: [28, 28] });
  }, [map, origin, destination]);

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
  const points = [origin, destination].filter(Boolean) as [number, number][];

  if (!points.length) return null;

  return (
    <MapContainer center={points[0]} zoom={12} scrollWheelZoom={false} className="trip-route-map">
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitRoute origin={origin} destination={destination} />
      {origin ? <Marker position={origin} icon={buildRouteIcon("origin")} /> : null}
      {destination ? <Marker position={destination} icon={buildRouteIcon("destination")} /> : null}
      {origin && destination ? <Polyline positions={[origin, destination]} pathOptions={{ color: "#3366ff", weight: 4, opacity: 0.7 }} /> : null}
    </MapContainer>
  );
}
