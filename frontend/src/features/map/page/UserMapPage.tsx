import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { MapboxMap } from "../../../shared/components/map/MapboxMap";

const DEFAULT_CENTER = {
  lat: 16.0471,
  lon: 108.2068,
};

const DEFAULT_VIEW_ZOOM = 4;
const DETAIL_VIEW_ZOOM = 12;

const toNumber = (value: string | null): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function UserMapPage() {
  const [searchParams] = useSearchParams();

  const lat = useMemo(() => toNumber(searchParams.get("lat")), [searchParams]);
  const lon = useMemo(() => toNumber(searchParams.get("lon")), [searchParams]);

  const hasCoordinates = lat !== null && lon !== null;
  const mapLat = lat ?? DEFAULT_CENTER.lat;
  const mapLon = lon ?? DEFAULT_CENTER.lon;
  const mapZoom = hasCoordinates ? DETAIL_VIEW_ZOOM : DEFAULT_VIEW_ZOOM;

  return (
    <div className="card map-page">
      <h3 style={{ marginTop: 0 }}>Map</h3>
      {!hasCoordinates ? (
        <p className="small" style={{ marginTop: 0 }}>
          No coordinates selected. Showing default center.
        </p>
      ) : (
        <p style={{ marginTop: 0 }}>
          <strong>Geolocation (lat, lon):</strong> ({lat}, {lon})
        </p>
      )}

      <p className="small" style={{ marginTop: 0 }}>
        Drag, zoom, and inspect the map below.
      </p>
      <MapboxMap lat={mapLat} lon={mapLon} zoom={mapZoom} showMarker={hasCoordinates} />
    </div>
  );
}
