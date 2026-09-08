import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface MapTrackerProps {
  latitude?: number;
  longitude?: number;
  zoom?: number;
  showUserLocation?: boolean;
  className?: string;
}

// OpenFreeMap style URLs (completely free, no API key needed)
const OPENFREEMAP_STYLES = {
  bright: 'https://tiles.openfreemap.org/styles/bright',
  positron: 'https://tiles.openfreemap.org/styles/positron',
  darkMatter: 'https://tiles.openfreemap.org/styles/darkMatter',
};

export function MapTracker({
  latitude = 20.5937,
  longitude = 78.9629,
  zoom = 12,
  showUserLocation = true,
  className = '',
}: MapTrackerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const [mapStyle, setMapStyle] = useState<keyof typeof OPENFREEMAP_STYLES>('bright');

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Initialize map with OpenFreeMap (completely free!)
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: OPENFREEMAP_STYLES[mapStyle],
      center: [longitude, latitude],
      zoom,
    });

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Add scale control
    map.current.addControl(new maplibregl.ScaleControl(), 'bottom-left');

    // Add user location marker if enabled
    if (showUserLocation) {
      marker.current = new maplibregl.Marker({
        color: '#2563eb',
        scale: 1.2,
      })
        .setLngLat([longitude, latitude])
        .addTo(map.current);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update map center when coordinates change
  useEffect(() => {
    if (map.current && latitude && longitude) {
      map.current.flyTo({
        center: [longitude, latitude],
        zoom: Math.max(map.current.getZoom(), 15),
        essential: true,
      });

      // Update marker position
      marker.current?.setLngLat([longitude, latitude]);
    }
  }, [latitude, longitude]);

  // Update map style
  useEffect(() => {
    if (map.current) {
      map.current.setStyle(OPENFREEMAP_STYLES[mapStyle]);
    }
  }, [mapStyle]);

  return (
    <div className={`map-wrapper ${className}`}>
      {/* Map Style Selector */}
      <div className="map-style-selector">
        <label>Map Style</label>
        <select
          value={mapStyle}
          onChange={(e) => setMapStyle(e.target.value as keyof typeof OPENFREEMAP_STYLES)}
        >
          <option value="bright">Bright</option>
          <option value="positron">Light</option>
          <option value="darkMatter">Dark</option>
        </select>
      </div>

      {/* Map Container */}
      <div ref={mapContainer} className="map-container" />

      {/* Attribution */}
      <div className="map-attribution">
        © OpenStreetMap contributors
      </div>
    </div>
  );
}
