import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useSettings } from '../../context/SettingsContext.jsx';

const pin = (label, cls) => L.divIcon({ className: '', html: `<span class="nx-pin ${cls}">${label}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] });
const SOURCE_ICON = pin('S', 'nx-pin-source');
const DEST_ICON = pin('D', 'nx-pin-dest');

function ClickHandler({ enabled, onPick }) {
  useMapEvents({ click(e) { if (enabled) onPick({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
  return null;
}

function FitRoute({ line, enabled }) {
  const map = useMap();
  useEffect(() => {
    if (enabled && line && line.length > 1) map.fitBounds(L.latLngBounds(line), { padding: [40, 40] });
  }, [line, map, enabled]);
  return null;
}

/**
 * Leaflet + OpenStreetMap map. `route` is the REAL road geometry returned by the backend ([lat, lng][]).
 * Honors Settings > Map: tile style (dark tint or standard colors) and whether to auto-fit the route.
 * @param {{center: [number, number], zoom?: number, source?: {lat: number, lng: number}|null,
 *   destination?: {lat: number, lng: number}|null, route?: [number, number][]|null,
 *   picking?: boolean, onPick?: (p: {lat: number, lng: number}) => void}} props
 */
export default function MapView({ center, zoom = 13, source, destination, route, picking = false, onPick = () => {} }) {
  const { settings, resolved, palette } = useSettings();
  const classes = ['nx-map', 'h-[24rem] w-full border border-border lg:h-[34rem]', resolved.tiles === 'dark' ? 'nx-map--dark' : '', picking ? 'nx-map--picking' : ''].join(' ');
  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom className={classes}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
      <ClickHandler enabled={picking} onPick={onPick} />
      {route && route.length > 1 && <Polyline positions={route} pathOptions={{ color: palette.primary, weight: 5, opacity: 0.9 }} />}
      {source && <Marker position={[source.lat, source.lng]} icon={SOURCE_ICON} />}
      {destination && <Marker position={[destination.lat, destination.lng]} icon={DEST_ICON} />}
      <FitRoute line={route} enabled={settings.mapAutoFit} />
    </MapContainer>
  );
}
