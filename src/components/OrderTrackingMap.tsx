import { useEffect, useRef, useState } from 'react';
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
  const marker = useRef<maplibregl.Marker | null>(null);
  const [eta, setEta] = useState<string>('Calculating...');

  const { position, isTracking, startTracking, stopTracking } = useGPS({
    enableHighAccuracy: true,
    maximumAge: 3000,
    timeout: 10000,
    watchPosition: true,
  });

  // Start tracking on mount
  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: OPENFREEMAP_STYLE,
      center: [77.5946, 12.9716], // Default: Bangalore
      zoom: 15,
      attributionControl: false,
    });

    // Simulate delivery partner marker (green)
    marker.current = new maplibregl.Marker({ color: '#10b981', scale: 1.0 })
      .setLngLat([77.5946, 12.9716])
      .addTo(map.current);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update map when GPS position changes
  useEffect(() => {
    if (map.current && position) {
      const newCenter: [number, number] = [position.longitude, position.latitude];
      map.current.flyTo({ center: newCenter, zoom: 16, essential: true });
      marker.current?.setLngLat(newCenter);

      // Simulate ETA based on speed
      if (position.speed && position.speed > 0) {
        const km = (Math.random() * 3 + 0.5).toFixed(1);
        const mins = Math.round((parseFloat(km) / (position.speed * 3.6)) * 60);
        setEta(`${mins} min · ${km} km away`);
      } else {
        setEta('Arriving soon');
      }
    }
  }, [position]);

  return (
    <div className="order-tracking-map">
      <div className="otm-header">
        <div className="otm-title">
          <span className="otm-icon">🚲</span>
          <div>
            <span className="otm-label">Delivery Partner</span>
            <span className="otm-eta">{eta}</span>
          </div>
        </div>
        <button className="otm-close" onClick={onClose}>✕</button>
      </div>
      <div ref={mapContainer} className="otm-map" />
      <div className="otm-footer">
        <span className="otm-status-dot" />
        <span className="otm-status-text">
          {isTracking ? 'Live tracking active' : 'Waiting for GPS...'}
        </span>
        <span className="otm-order-id">Order {orderId}</span>
      </div>
    </div>
  );
}
