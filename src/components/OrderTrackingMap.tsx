import { useCallback, useEffect, useMemo, useState } from 'react';
import { LeafletFallbackMap } from './LeafletFallbackMap';
import { useRealtimeGPS } from '../hooks/useRealtimeGPS';
import { useDeliveryRoute } from '../hooks/useDeliveryRoute';
import type { LiveBikeLocation } from './LiveTrackingMap';
import { getItemOrders } from '../utils/storage';
import { formatDistanceMeters, formatEtaMinutes, haversineMeters } from '../utils/geo';

// Real fixed shop/origin coordinates (Pillaiyar Koil Street / 1st Cross Street, Maduravoyal)
const SHOP_LOCATION = { lat: 13.0550, lng: 80.1633 };

// Real AGS Theatre (AGS Cinemas), Maduravoyal, Chennai
const MADURAVOYAL_AGS = { lat: 13.0606, lng: 80.1661 };

// Fallback destination = real nearby landmark (so route line + pins are always distinct)
const FALLBACK_DESTINATION = MADURAVOYAL_AGS;

interface OrderTrackingMapProps {
  orderId: string;
  onClose: () => void;
}

/**
 * Zepto-style live delivery tracking (customer view).
 *  🛵 Bike  = delivery partner's live streamed GPS via Supabase realtime
 *  🗺️ Route = OSRM road-following route, updates live
 *  📍 Addr  = reverse-geocoded via OpenStreetMap Nominatim (free, no API key)
 *  🏠 Dest  = saved order address OR AGS Theatre, Maduravoyal
 *
 * The customer is never the bike — the marker only moves when the assigned
 * delivery partner is streaming their GPS under this order's bike_id.
 */
export function OrderTrackingMap({ orderId, onClose }: OrderTrackingMapProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDelivering, setIsDelivering] = useState(false);
  const [deliveryTarget, setDeliveryTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryAddressText, setDeliveryAddressText] = useState('AGS Theatre, Maduravoyal');
  const [now, setNow] = useState(Date.now());

  // Supabase realtime: delivery partner streaming their GPS
  const { bikeLocation } = useRealtimeGPS({
    bikeId: orderId,
    enabled: true,
  });

  // Tick for ETA freshness
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(t);
  }, []);

  // Load real destination address + current status from saved order
  useEffect(() => {
    let cancelled = false;
    getItemOrders().then((orders) => {
      if (cancelled) return;
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;
      const saved = order.deliveryAddress;
      if (saved) {
        setDeliveryTarget({ lat: saved.lat, lng: saved.lng });
        if (saved.address) {
          setDeliveryAddressText(saved.address);
        }
      }
      // Reflect live delivery state even before the first GPS fix arrives.
      if (order.status === 'OUT_FOR_DELIVERY' || order.status === 'DELIVERED') {
        setIsDelivering(true);
      }
    });
    return () => { cancelled = true; };
  }, [orderId]);

  const destination = useMemo(
    () => deliveryTarget ?? FALLBACK_DESTINATION,
    [deliveryTarget]
  );

  // ── Bike: partner's live streamed GPS ONLY (Zepto-correct).
  // The customer is never the bike. If the delivery partner isn't
  // streaming yet, hold the bike at the shop origin.
  const bike = useMemo<LiveBikeLocation>(() => {
    if (bikeLocation) {
      return {
        lat: bikeLocation.latitude,
        lng: bikeLocation.longitude,
        heading: bikeLocation.heading ?? null,
        speed: bikeLocation.speed ?? null,
        timestamp: bikeLocation.timestamp ? Date.parse(bikeLocation.timestamp) : Date.now(),
      };
    }
    // No partner stream yet — hold bike at shop origin
    return {
      lat: SHOP_LOCATION.lat,
      lng: SHOP_LOCATION.lng,
      heading: 90,
      timestamp: Date.now(),
      speed: null,
    };
  }, [bikeLocation]);

  // OSRM road route: bike → destination (updates as bike moves)
  const { route } = useDeliveryRoute(bike, destination);

  const distanceMeters = useMemo(() => {
    if (route?.isRoadRoute && route.distanceMeters > 0) return route.distanceMeters;
    const d = Math.round(haversineMeters(bike, destination));
    return d > 5 ? d : null;
  }, [bike, route, destination]);

  const etaSeconds = useMemo(() => {
    if (route?.isRoadRoute && route.durationSeconds > 0) return route.durationSeconds;
    const d = haversineMeters(bike, destination);
    return d > 50 ? Math.round(d / 8.33) : null;
  }, [bike, route, destination, now]);

  const hasGPS = !!bikeLocation;

  const toggleFullscreen = useCallback(() => setIsFullscreen((p) => !p), []);

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const lastStamp = bikeLocation?.timestamp
    ? Date.parse(bikeLocation.timestamp)
    : undefined;

  return (
    <div className={`otm-container ${isFullscreen ? 'otm-fullscreen' : ''}`}>
      {isFullscreen && <div className="otm-backdrop" onClick={onClose} />}

      <div className={`otm-panel ${isFullscreen ? 'otm-panel-full' : ''}`}>

        {/* ── Header: real reverse-geocoded address ── */}
        <div className="otm-header">
          <div className="otm-title">
            <span className="otm-icon">🛵</span>
            <div>
              <span className="otm-label">OORUNII</span>
              <span className="otm-eta" title={deliveryAddressText}>
                📍 {deliveryAddressText}
              </span>
            </div>
          </div>
          <div className="otm-header-actions">
            <button
              className="otm-fullscreen-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              ⛶
            </button>
            <button className="otm-close" onClick={onClose} title="Close">✕</button>
          </div>
        </div>

        {/* ── ETA / Distance / Updated chips ── */}
        <div className="otm-chips">
          <div className="otm-chip">
            <span className="otm-chip-icon">⏱</span>
            <div>
              <div className="otm-chip-val">{etaSeconds ? formatEtaMinutes(etaSeconds) : '--'}</div>
              <div className="otm-chip-label">ETA</div>
            </div>
          </div>
          <div className="otm-chip-divider" />
          <div className="otm-chip">
            <span className="otm-chip-icon">📍</span>
            <div>
              <div className="otm-chip-val">
                {distanceMeters != null ? formatDistanceMeters(distanceMeters) : '--'}
              </div>
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

        {/* ── Map ── */}
        <div className="otm-map-wrapper">
          <LeafletFallbackMap
            className={isFullscreen ? 'ltm-full' : ''}
            bike={bike}
            destination={destination}
            shopLocation={SHOP_LOCATION}
            route={route}
            destinationLabel={deliveryAddressText}
            shopLabel="Shop (Origin)"
            partnerLabel="Delivery Bike (Partner GPS)"
          />

          {/* Live status pill */}
          <div className={`otm-live-pill ${hasGPS ? 'otm-live-pill-active' : ''}`}>
            <span className={`otm-status-dot ${bikeLocation || isDelivering ? 'live' : ''}`} />
            <span className="otm-status-text">
              {bikeLocation
                ? '🛵 Live · Partner streaming'
                : isDelivering
                  ? '🛵 Delivery started · waiting for GPS fix…'
                  : '📡 Waiting for delivery partner…'}
            </span>
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="otm-legend">
          <span className="otm-legend-item">
            <span className="otm-legend-dot" style={{ background: '#2563eb' }} /> Bike
          </span>
          <span className="otm-legend-item">
            <span className="otm-legend-dot shop" /> Shop
          </span>
          <span className="otm-legend-item">
            <span className="otm-legend-dot" style={{ background: '#dc2626' }} /> Destination
          </span>
        </div>

        {/* ── Bottom info ── */}
        {!isFullscreen && (
          <div className="otm-bottom-info">
            <span className="otm-order-id">Order {orderId}</span>
            <span className="otm-accuracy">
              {bikeLocation
                ? `±${bikeLocation.accuracy.toFixed(0)}m`
                : hasGPS
                  ? 'Streaming'
                  : 'No GPS'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
