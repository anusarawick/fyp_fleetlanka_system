import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";

type MapViewProps = {
  center?: [number, number];
  zoom?: number;
};

export default function MapView({ center = [6.9271, 79.8612], zoom = 11 }: MapViewProps) {
  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className="map-leaflet">
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={center}>
        <Popup>Fleet base area</Popup>
      </Marker>
    </MapContainer>
  );
}
