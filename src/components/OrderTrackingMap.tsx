import { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useGPS } from '../hooks/useGPS';

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/bright';

// VVK WATER SUPPLY - Jeeva Complex, Alapakkam, Maduravoyal, Chennai
const SHOP_LOCATION: [number, number] = [80.170, 13.054]; // [lng, lat]

interface OrderTrackingMapProps {
  orderId: string;
  onClose: () => void;
}

export function OrderTrackingMap({ orderId, onClose }: OrderTrackingMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const shopMarker = useRef<maplibregl.Marker | null>(null);
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

  // Create shop marker (red pin with store icon)
  const createShopMarkerEl = useCallback(() => {
    const el = document.createElement('div');
    el.className = 'shop-marker';
    el.innerHTML = '<div class="shop-marker-pin">🏪</div>';
    el.title = 'VVK WATER SUPPLY - Jeeva Complex, Alapakkam, Maduravoyal';
    return el;
  }, []);

  // Create user marker (blue pulsing dot)
  const createUserMarkerEl = useCallback(() => {
    const el = document.createElement('div');
    el.className = 'gps-user-marker';
    el.innerHTML = '<div class="gps-marker-pulse"></div><div class="gps-marker-dot"></div>';
    return el;
  }, []);

  // Initialize map IMMEDIATELY at shop location
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: OPENFREEMAP_STYLE,
      center: SHOP_LOCATION,
      zoom: 15,
      attributionControl: false,
    });

    mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    mapInstance.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    mapInstance.on('load', () => {
      // Add shop marker at default location
      shopMarker.current = new maplibregl.Marker({
        element: createShopMarkerEl(),
        anchor: 'center',
      })
        .setLngLat(SHOP_LOCATION)
        .addTo(mapInstance);

      // Add user marker at shop location initially
      userMarker.current = new maplibregl.Marker({
        element: createUserMarkerEl(),
        anchor: 'center',
      })
        .setLngLat(SHOP_LOCATION)
        .addTo(mapInstance);
    });

    map.current = mapInstance;

    return () => {
      mapInstance.remove();
      map.current = null;
      userMarker.current = null;
      shopMarker.current = null;
    };
  }, []);

  // When GPS position arrives, update user marker to real location
  useEffect(() => {
    if (!map.current || !position) return;

    const lngLat: [number, number] = [position.longitude, position.latitude];

    userMarker.current?.setLngLat(lngLat);

    // Fly to real location
    map.current.flyTo({
      center: lngLat,
      zoom: 16,
      essential: true,
      duration: 1500,
    });
  }, [position]);

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
              <span className="otm-label">VVK WATER SUPPLY</span>
              <span className="otm-eta">
                {position ? '📍 Live tracking active' : '📍 Jeeva Complex, Alapakkam, Maduravoyal'}
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

        {/* Legend */}
        <div className="otm-legend">
          <span className="otm-legend-item">
            <span className="otm-legend-dot shop" /> Shop
          </span>
          <span className="otm-legend-item">
            <span className="otm-legend-dot user" /> You
          </span>
        </div>

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

        {/* Bottom info (compact mode) */}
        {!isFullscreen && (
          <div className="otm-bottom-info">
            <span className="otm-order-id">Order {orderId}</span>
            <span className="otm-accuracy">
              ±{position ? position.accuracy.toFixed(0) : '?'}m
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
