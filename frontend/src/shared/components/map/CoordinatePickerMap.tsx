import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface CoordinatePickerMapProps {
  currentLat: number | null;
  currentLon: number | null;
  /** Stable initial center — set once when modal opens, never causes re-center on marker picks */
  centerLat?: number | null;
  centerLon?: number | null;
  valueLat: number | null;
  valueLon: number | null;
  onChange: (lat: number, lon: number) => void;
  zoom?: number;
}

const DEFAULT_CENTER = {
  lat: 16.0471,
  lon: 108.2068,
};

export function CoordinatePickerMap({
  currentLat,
  currentLon,
  centerLat,
  centerLon,
  valueLat,
  valueLon,
  onChange,
  zoom = 12,
}: CoordinatePickerMapProps) {
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const currentMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const valueMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  // Capture initial zoom once — never re-apply it when markers change
  const initialZoomRef = useRef(zoom);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!token || !mapContainerRef.current || mapRef.current) {
      return;
    }

    mapboxgl.accessToken = token;

    const initLat = centerLat ?? valueLat ?? currentLat ?? DEFAULT_CENTER.lat;
    const initLon = centerLon ?? valueLon ?? currentLon ?? DEFAULT_CENTER.lon;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [initLon, initLat],
      zoom: initialZoomRef.current,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");

    map.on("click", (event) => {
      onChangeRef.current(event.lngLat.lat, event.lngLat.lng);
    });

    mapRef.current = map;

    return () => {
      currentMarkerRef.current?.remove();
      valueMarkerRef.current?.remove();
      map.remove();
      currentMarkerRef.current = null;
      valueMarkerRef.current = null;
      mapRef.current = null;
    };
  }, [token]); // intentionally omit all coords — map init runs once per mount

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const map = mapRef.current;

    if (currentLat !== null && currentLon !== null) {
      if (!currentMarkerRef.current) {
        currentMarkerRef.current = new mapboxgl.Marker({ color: "#1565d8" })
          .setLngLat([currentLon, currentLat])
          .addTo(map);
      } else {
        currentMarkerRef.current.setLngLat([currentLon, currentLat]);
      }
    } else if (currentMarkerRef.current) {
      currentMarkerRef.current.remove();
      currentMarkerRef.current = null;
    }

    if (valueLat !== null && valueLon !== null) {
      if (!valueMarkerRef.current) {
        valueMarkerRef.current = new mapboxgl.Marker({ color: "#d92d20" })
          .setLngLat([valueLon, valueLat])
          .addTo(map);
      } else {
        // Only move the existing marker — never touch the camera
        valueMarkerRef.current.setLngLat([valueLon, valueLat]);
      }
    } else if (valueMarkerRef.current) {
      valueMarkerRef.current.remove();
      valueMarkerRef.current = null;
    }
    // NOTE: zoom is intentionally NOT applied here — doing so would reset the
    // user's current zoom level every time they pick a new coordinate.
  }, [currentLat, currentLon, valueLat, valueLon]);

  if (!token) {
    return (
      <div className="map-error-card">
        <p className="error" style={{ margin: 0 }}>
          Missing Mapbox token. Set VITE_MAPBOX_ACCESS_TOKEN to render the map.
        </p>
      </div>
    );
  }

  return <div ref={mapContainerRef} className="mapbox-interactive-container" />;
}