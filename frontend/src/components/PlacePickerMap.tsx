import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import { divIcon } from "leaflet";

type PlacePickerMapProps = {
  lat: number | null;
  lon: number | null;
  onPick: (lat: number, lon: number) => void;
};

function PickMarker({
  lat,
  lon,
  onPick,
}: {
  lat: number | null;
  lon: number | null;
  onPick: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });

  if (lat == null || lon == null) return null;

  return (
    <Marker
      position={[lat, lon]}
      icon={divIcon({
        className: "",
        html: '<span class="trip-route-marker trip-route-marker--origin"></span>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })}
    />
  );
}

export default function PlacePickerMap({ lat, lon, onPick }: PlacePickerMapProps) {
  const center: [number, number] = lat != null && lon != null ? [lat, lon] : [6.9271, 79.8612];

  return (
    <MapContainer center={center} zoom={11} scrollWheelZoom={false} className="place-picker-map">
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <PickMarker lat={lat} lon={lon} onPick={onPick} />
    </MapContainer>
  );
}
