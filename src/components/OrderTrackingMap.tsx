import { useCallback, useEffect, useMemo, useState } from 'react';
import { LeafletFallbackMap } from './LeafletFallbackMap';
import { useGPS } from '../hooks/useGPS';
import { useRealtimeGPS } from '../hooks/useRealtimeGPS';
import { useDeliveryRoute } from '../hooks/useDeliveryRoute';
import type { LiveBikeLocation } from './LiveTrackingMap';
import { getItemOrders } from '../utils/storage';
import { formatDistanceMeters, formatEtaMinutes, haversineMeters } from '../utils/geo';

// Real shop/origin coordinates (Oorunii delivery hub)
const SHOP_LOCATION = { lat: 13.054, lng: 80.17 };

/**
 * Reverse geocode lat/lng → human-readable address using OpenStreetMap Nominatim.
 * 100% free, no API key required.
 */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
      { headers: { 'User-Agent': 'OoruniiApp/1.0' } }
    );
    const data = await res.json();
    const { road, neighbourhood, suburb, city_district, city, town, village, state_district } =
      data.address ?? {};
    const parts = [
      road ?? neighbourhood,
      suburb ?? city_district,
      city ?? town ?? village ?? state_district,
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : data.display_name?.split(',').slice(0, 3).join(', ') ?? '';
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

interface OrderTrackingMapProps {
  orderId: string;
  onClose: () => void;
}

/**
 * Swiggy/Zepto-style live delivery tracking.
 *  🛵 Bike  = real mobile GPS (you move → bike moves) or Supabase partner stream
 *  🗺️ Route = OSRM road-following route, updates live
 *  📍 Addr  = reverse-geocoded via OpenStreetMap Nominatim (free, no API key)
 *  🏠 Dest  = saved order address OR customer's live GPS location
 */
export function OrderTrackingMap({ orderId, onClose }: OrderTrackingMapProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deliveryTarget, setDeliveryTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryAddressText, setDeliveryAddressText] = useState('Locating…');
  const [now, setNow] = useState(Date.now());

  // Real GPS from this device
  const { position, error, isTracking, startTracking, stopTracking } = useGPS({
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 10000,
    watchPosition: true,
  });

  // Supabase realtime: delivery partner streaming their GPS
  const { bikeLocation, isConnected } = useRealtimeGPS({
    bikeId: orderId,
    enabled: true,
  });

  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, [startTracking, stopTracking]);

  // Tick for ETA freshness
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(t);
  }, []);

  // Load real destination address from saved order
  useEffect(() => {
    let cancelled = false;
    getItemOrders().then((orders) => {
      if (cancelled) return;
      const order = orders.find((o) => o.id === orderId);
      const saved = order?.deliveryAddress;
      if (saved) setDeliveryTarget({ lat: saved.lat, lng: saved.lng });
    });
    return () => { cancelled = true; };
  }, [orderId]);

  // Resolve real destination point
  const destination = useMemo(
    () => deliveryTarget ?? (position ? { lat: position.latitude, lng: position.longitude } : SHOP_LOCATION),
    [deliveryTarget, position]
  );

  // Reverse-geocode destination → show real address in header
  useEffect(() => {
    let cancelled = false;
    setDeliveryAddressText('Locating…');
    reverseGeocode(destination.lat, destination.lng).then((addr) => {
      if (!cancelled) setDeliveryAddressText(addr || 'Your delivery location');
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination.lat, destination.lng]);

  // ── Bike: partner GPS > this device GPS > shop fallback ──
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
    if (position) {
      // YOUR mobile GPS = bike (walk and the icon follows you)
      return {
        lat: position.latitude,
        lng: position.longitude,
        heading: position.heading ?? null,
        timestamp: position.timestamp,
        speed: position.speed ?? null,
      };
    }
    // GPS not yet acquired — hold bike at shop origin
    return {
      lat: SHOP_LOCATION.lat,
      lng: SHOP_LOCATION.lng,
      heading: 90,
      timestamp: Date.now(),
      speed: null,
    };
  }, [bikeLocation, position]);

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

  const hasGPS = !!position || !!bikeLocation;

  const toggleFullscreen = useCallback(() => setIsFullscreen((p) => !p), []);

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const lastStamp =
    position?.timestamp ?? (bikeLocation?.timestamp ? Date.parse(bikeLocation.timestamp) : undefined);

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
            shopLabel="Oorunii"
            partnerLabel="Delivery bike"
          />

          {/* Live status pill */}
          <div className={`otm-live-pill ${hasGPS ? 'otm-live-pill-active' : ''}`}>
            <span className={`otm-status-dot ${hasGPS ? 'live' : ''}`} />
            <span className="otm-status-text">
              {error
                ? (error.toLowerCase().includes('denied')
                    ? '🔒 Allow location access'
                    : `⚠️ ${error}`)
                : isConnected && bikeLocation
                  ? '🛵 Live · Partner streaming'
                  : position
                    ? '🛵 Live · GPS active'
                    : isTracking
                      ? '📡 Acquiring GPS…'
                      : '📡 Waiting for GPS…'}
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
              {position
                ? `±${position.accuracy.toFixed(0)}m`
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
