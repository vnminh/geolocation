import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface MapboxMapProps {
  lat: number;
  lon: number;
  zoom?: number;
  showMarker?: boolean;
}

export function MapboxMap({ lat, lon, zoom = 12, showMarker = true }: MapboxMapProps) {
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!token || !mapContainerRef.current || mapRef.current) {
      return;
    }

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [lon, lat],
      zoom,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");

    if (showMarker) {
      const marker = new mapboxgl.Marker({ color: "#1565d8" })
        .setLngLat([lon, lat])
        .addTo(map);
      markerRef.current = marker;
    }

    mapRef.current = map;

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
      }
      map.remove();
      markerRef.current = null;
      mapRef.current = null;
    };
  }, [lat, lon, showMarker, token, zoom]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    if (showMarker) {
      if (!markerRef.current) {
        markerRef.current = new mapboxgl.Marker({ color: "#1565d8" }).setLngLat([lon, lat]).addTo(mapRef.current);
      } else {
        markerRef.current.setLngLat([lon, lat]);
      }
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    mapRef.current.flyTo({ center: [lon, lat], zoom, essential: true });
  }, [lat, lon, showMarker, zoom]);

  if (!token) {
    return (
      <div className="map-error-card">
        <p className="error" style={{ margin: 0 }}>
          Missing Mapbox token. Set VITE_MAPBOX_ACCESS_TOKEN to render the map.
        </p>
      </div>
    );
  }

  return (
    <div className="map-preview-wrap">
      <div ref={mapContainerRef} className="mapbox-interactive-container" />
    </div>
  );
}
