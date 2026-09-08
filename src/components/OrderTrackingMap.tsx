import { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useGPS } from '../hooks/useGPS';

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/bright';

interface OrderTrackingMapProps {
  orderId: string;
  onClose: () => void;
}

export function OrderTrackingMap({ orderId, onClose }: OrderTrackingMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { position, error, isTracking, startTracking, stopTracking } = useGPS({
    enableHighAccuracy: true,
    maximumAge: 2000,
    timeout: 15000,
    watchPosition: true,
  });

  // Start GPS on mount
  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, []);

  // Create blue pulsing dot marker
  const createMarkerEl = useCallback(() => {
    const el = document.createElement('div');
    el.className = 'gps-user-marker';
    el.innerHTML = '<div class="gps-marker-pulse"></div><div class="gps-marker-dot"></div>';
    return el;
  }, []);

  // Initialize map IMMEDIATELY with a default center (India)
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const defaultCenter: [number, number] = [80.2707, 13.0827]; // Chennai, India

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: OPENFREEMAP_STYLE,
      center: defaultCenter,
      zoom: 13,
      attributionControl: false,
    });

    mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    mapInstance.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    // Add marker immediately at default location
    mapInstance.on('load', () => {
      userMarker.current = new maplibregl.Marker({
        element: createMarkerEl(),
        anchor: 'center',
      })
        .setLngLat(defaultCenter)
        .addTo(mapInstance);
    });

    map.current = mapInstance;

    return () => {
      mapInstance.remove();
      map.current = null;
      userMarker.current = null;
    };
  }, []); // Runs once on mount

  // When GPS position arrives, update the map to show real location
  useEffect(() => {
    if (!map.current || !position) return;

    const lngLat: [number, number] = [position.longitude, position.latitude];

    // Move marker to real GPS location
    userMarker.current?.setLngLat(lngLat);

    // Fly to real location
    map.current.flyTo({
      center: lngLat,
      zoom: 16,
      essential: true,
      duration: 1500,
    });
  }, [position]); // Runs every time GPS position updates

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
    setTimeout(() => map.current?.resize(), 350);
  }, []);

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString();

  return (
    <div className={`otm-container ${isFullscreen ? 'otm-fullscreen' : ''}`}>
      {isFullscreen && <div className="otm-backdrop" onClick={onClose} />}

      <div className={`otm-panel ${isFullscreen ? 'otm-panel-full' : ''}`}>
        {/* Header */}
        <div className="otm-header">
          <div className="otm-title">
            <span className="otm-icon">🚲</span>
            <div>
              <span className="otm-label">Delivery Partner</span>
              <span className="otm-eta">
                {position ? '📍 Live location active' : 'Waiting for GPS...'}
              </span>
            </div>
          </div>
          <div className="otm-header-actions">
            <button className="otm-fullscreen-btn" onClick={toggleFullscreen}>
              {isFullscreen ? '⬜' : '⛶'}
            </button>
            <button className="otm-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Map - always visible */}
        <div ref={mapContainer} className="otm-map" />

        {/* Footer */}
        <div className="otm-footer">
          <span className={`otm-status-dot ${isTracking ? 'live' : ''}`} />
          <span className="otm-status-text">
            {error
              ? `⚠️ ${error}`
              : isTracking
                ? `Live · ${position ? formatTime(position.timestamp) : 'Acquiring GPS...'}`
                : 'Tracking paused'}
          </span>
          {position && (
            <span className="otm-coords">
              {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}
            </span>
          )}
        </div>

        {/* Bottom info (compact mode only) */}
        {!isFullscreen && (
          <div className="otm-bottom-info">
            <span className="otm-order-id">Order {orderId}</span>
            <span className="otm-accuracy">
              ±{position ? position.accuracy.toFixed(0) : '?'}m accuracy
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
