import { useCallback, useEffect, useMemo, useState } from 'react';
import { LeafletFallbackMap } from './LeafletFallbackMap';
import { useGPS } from '../hooks/useGPS';
import { useRealtimeGPS } from '../hooks/useRealtimeGPS';
import { useDeliveryRoute } from '../hooks/useDeliveryRoute';
import type { LiveBikeLocation } from './LiveTrackingMap';
import { getItemOrders } from '../utils/storage';
import {
  formatDistanceMeters,
  formatEtaMinutes,
  isFreshFix,
  haversineMeters,
} from '../utils/geo';

// VVK WATER SUPPLY - Jeeva Complex, Alapakkam, Maduravoyal, Chennai
const SHOP_LOCATION = { lat: 13.054, lng: 80.17 };

interface OrderTrackingMapProps {
  orderId: string;
  onClose: () => void;
}

/**
 * Swiggy/Zepto-style live order tracking:
 *  - Full-bleed Leaflet map (CartoDB Voyager tiles, always visible)
 *  - 3 markers: shop (green), delivery bike (yellow badge), customer address (red pin)
 *  - Animated dashed route line (OSRM road-following)
 *  - Real-time GPS via browser or Supabase realtime (delivery partner's device)
 *  - ETA / distance / live status chips
 *  - Bottom sheet info panel like Swiggy
 */
export function OrderTrackingMap({ orderId, onClose }: OrderTrackingMapProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deliveryTarget, setDeliveryTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [now, setNow] = useState(Date.now());

  const { position, error, isTracking, startTracking, stopTracking } = useGPS({
    enableHighAccuracy: true,
    maximumAge: 2000,
    timeout: 15000,
    watchPosition: true,
  });

  const { bikeLocation, isConnected } = useRealtimeGPS({
    bikeId: orderId,
    enabled: true,
  });

  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, [startTracking, stopTracking]);

  // Freshness tick every 5s
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  // Resolve delivery destination from saved order
  useEffect(() => {
    let cancelled = false;
    getItemOrders().then((orders) => {
      if (cancelled) return;
      const order = orders.find((o) => o.id === orderId);
      const saved = order?.deliveryAddress;
      setDeliveryTarget(saved ? { lat: saved.lat, lng: saved.lng } : null);
    });
    return () => { cancelled = true; };
  }, [orderId]);

  // Bike position: prefer realtime partner, else this device's GPS
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

  // Customer destination: saved address or fallback to shop
  const destination = deliveryTarget ?? (position ? { lat: position.latitude, lng: position.longitude } : SHOP_LOCATION);

  // OSRM route: bike → customer address
  const { route } = useDeliveryRoute(bike, destination);

  // Only show stats when GPS has a real fresh fix
  const hasRealFix = bike ? isFreshFix(bike.timestamp, now) : false;

  const distanceMeters = useMemo(() => {
    if (!bike || !hasRealFix) return null;
    if (route?.isRoadRoute && route.distanceMeters > 0) return route.distanceMeters;
    const d = Math.round(haversineMeters(bike, destination));
    return d > 0 ? d : null;
  }, [bike, hasRealFix, route, destination]);

  const etaSeconds = useMemo(() => {
    if (!bike || !hasRealFix) return null;
    if (route?.isRoadRoute && route.durationSeconds > 0) return route.durationSeconds;
    const d = haversineMeters(bike, destination);
    return d > 10 ? Math.round(d / 8.33) : null;
  }, [bike, hasRealFix, route, destination, now]);

  const isLive = bike ? isFreshFix(bike.timestamp, now) : false;

  const toggleFullscreen = useCallback(() => setIsFullscreen((p) => !p), []);

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const lastStamp = position?.timestamp ?? (bikeLocation?.timestamp ? Date.parse(bikeLocation.timestamp) : undefined);

  return (
    <div className={`otm-container ${isFullscreen ? 'otm-fullscreen' : ''}`}>
      {isFullscreen && <div className="otm-backdrop" onClick={onClose} />}

      <div className={`otm-panel ${isFullscreen ? 'otm-panel-full' : ''}`}>

        {/* ── Header ── */}
        <div className="otm-header">
          <div className="otm-title">
            <span className="otm-icon">🛵</span>
            <div>
              <span className="otm-label">VVK WATER SUPPLY</span>
              <span className="otm-eta">
                📍 Jeeva Complex, Alapakkam, Maduravoyal
              </span>
            </div>
          </div>
          <div className="otm-header-actions">
            <button className="otm-fullscreen-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              {isFullscreen ? '⛶' : '⛶'}
            </button>
            <button className="otm-close" onClick={onClose} title="Close">✕</button>
          </div>
        </div>

        {/* ── ETA / Distance chips (Swiggy-style) ── */}
        <div className="otm-chips">
          <div className="otm-chip otm-chip-eta">
            <span className="otm-chip-icon">⏱</span>
            <div>
              <div className="otm-chip-val">{etaSeconds ? formatEtaMinutes(etaSeconds) : '--'}</div>
              <div className="otm-chip-label">ETA</div>
            </div>
          </div>
          <div className="otm-chip-divider" />
          <div className="otm-chip otm-chip-dist">
            <span className="otm-chip-icon">📍</span>
            <div>
              <div className="otm-chip-val">{distanceMeters != null ? formatDistanceMeters(distanceMeters) : '--'}</div>
              <div className="otm-chip-label">Distance</div>
            </div>
          </div>
          <div className="otm-chip-divider" />
          <div className="otm-chip">
            <span className="otm-chip-icon">🕐</span>
            <div>
              <div className="otm-chip-val">{lastStamp ? formatTime(lastStamp) : '--'}</div>
              <div className="otm-chip-label">Updated</div>
            </div>
          </div>
        </div>

        {/* ── Map (full-bleed, always visible) ── */}
        <div className="otm-map-wrapper">
          <LeafletFallbackMap
            className={isFullscreen ? 'ltm-full' : ''}
            bike={bike}
            destination={destination}
            shopLocation={SHOP_LOCATION}
            route={route}
            destinationLabel="Your address"
            shopLabel="VVK Water Supply"
            partnerLabel="Delivery bike"
          />

          {/* Live status pill overlaid on map */}
          <div className={`otm-live-pill ${hasRealFix ? 'otm-live-pill-active' : ''}`}>
            <span className={`otm-status-dot ${hasRealFix ? 'live' : ''}`} />
            <span className="otm-status-text">
              {error
                ? (error.includes('denied') ? '🔒 Allow location to track' : `⚠️ ${error}`)
                : isConnected && bikeLocation
                  ? '🛵 Live · Partner streaming'
                  : hasRealFix
                    ? `🛵 Live · GPS locked`
                    : isTracking
                      ? '📡 Acquiring GPS…'
                      : '📡 Waiting for GPS…'}
            </span>
          </div>
        </div>

        {/* ── Legend ── */}
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

        {/* ── Bottom info row ── */}
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

