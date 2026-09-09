import { useCallback, useEffect, useMemo, useState } from 'react';
import { LiveTrackingMap, type LiveBikeLocation, type LiveTrackingStats } from './LiveTrackingMap';
import { useGPS } from '../hooks/useGPS';
import { useRealtimeGPS } from '../hooks/useRealtimeGPS';
import { getItemOrders } from '../utils/storage';

// VVK WATER SUPPLY - Jeeva Complex, Alapakkam, Maduravoyal, Chennai
const SHOP_LOCATION: { lat: number; lng: number } = { lat: 13.054, lng: 80.17 };

interface OrderTrackingMapProps {
  orderId: string;
  onClose: () => void;
}

/**
 * Customer-side live tracking for a paid order, built like the MYAPP app:
 *  - Real-time bike position from the browser GPS (the rider's phone) or,
 *    when a delivery partner streams from another device, from Supabase
 *    realtime (`bike_locations` keyed by the order id).
 *  - OSRM road route from the bike to the customer's delivery address.
 *  - Realistic motorcycle icon that follows the GPS fixes + live ETA.
 */
export function OrderTrackingMap({ orderId, onClose }: OrderTrackingMapProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deliveryTarget, setDeliveryTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [stats, setStats] = useState<LiveTrackingStats | null>(null);

  const { position, error, isTracking, startTracking, stopTracking } = useGPS({
    enableHighAccuracy: true,
    maximumAge: 2000,
    timeout: 15000,
    watchPosition: true,
  });

  // A delivery partner can stream the bike with bikeId = order id from
  // another device (/track/<orderId>) → we follow that in real time.
  const { bikeLocation, isConnected } = useRealtimeGPS({
    bikeId: orderId,
    enabled: true,
  });

  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, [startTracking, stopTracking]);

  // Resolve the delivery destination from the saved order address.
  useEffect(() => {
    let cancelled = false;
    getItemOrders().then((orders) => {
      if (cancelled) return;
      const order = orders.find((o) => o.id === orderId);
      const saved = order?.deliveryAddress;
      setDeliveryTarget(
        saved ? { lat: saved.lat, lng: saved.lng } : null
      );
    });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  // The moving bike: prefer the realtime remote partner, else this device.
  const bike = useMemo<LiveBikeLocation | null>(() => {
    if (bikeLocation) {
      return {
        lat: bikeLocation.latitude,
        lng: bikeLocation.longitude,
        heading: bikeLocation.heading ?? null,
        speed: bikeLocation.speed ?? null,
        timestamp: bikeLocation.timestamp ? Date.parse(bikeLocation.timestamp) : null,
      };
    }
    if (position) {
      return {
        lat: position.latitude,
        lng: position.longitude,
        heading: position.heading ?? null,
        timestamp: position.timestamp,
        speed: position.speed ?? null,
      };
    }
    return null;
  }, [bikeLocation, position]);

  const destination = deliveryTarget ?? (position ? { lat: position.latitude, lng: position.longitude } : SHOP_LOCATION);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString();

  return (
    <div className={`otm-container ${isFullscreen ? 'otm-fullscreen' : ''}`}>
      {isFullscreen && <div className="otm-backdrop" onClick={onClose} />}

      <div className={`otm-panel ${isFullscreen ? 'otm-panel-full' : ''}`}>
        {/* Header */}
        <div className="otm-header">
          <div className="otm-title">
            <span className="otm-icon">🛵</span>
            <div>
              <span className="otm-label">VVK WATER SUPPLY</span>
              <span className="otm-eta">
                {bike && stats && stats.etaSeconds > 0
                  ? `Arriving ${Math.max(1, Math.round(stats.etaSeconds / 60))} min`
                  : bike
                    ? '📍 Live tracking active'
                    : '📍 Jeeva Complex, Alapakkam, Maduravoyal'}
              </span>
            </div>
          </div>
          <div className="otm-header-actions">
            <button className="otm-fullscreen-btn" onClick={toggleFullscreen}>
              {isFullscreen ? '⛶' : '⛶'}
            </button>
            <button className="otm-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Map - real-time with OSRM route + bike icon */}
        <LiveTrackingMap
          className={isFullscreen ? 'ltm-full' : 'ltm-size-320'}
          bike={bike}
          destination={destination}
          destinationLabel="Your address"
          partnerLabel="Delivery bike"
          onStats={setStats}
        />

        {/* Legend */}
        <div className="otm-legend">
          <span className="otm-legend-item">
            <span className="ltm-legend-bike" /> Delivery bike
          </span>
          <span className="otm-legend-item">
            <span className="otm-legend-dot shop" /> Shop
          </span>
          <span className="otm-legend-item">
            <span className="ltm-legend-dot dest" /> Your address
          </span>
        </div>

        {/* Footer */}
        <div className="otm-footer">
          <span className={`otm-status-dot ${isTracking ? 'live' : ''}`} />
          <span className="otm-status-text">
            {error
              ? `⚠️ ${error}`
              : isConnected && bikeLocation
                ? `Live · partner ${bike ? 'streaming' : 'connecting'} · ${position ? formatTime(position.timestamp) : 'GPS...'}`
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