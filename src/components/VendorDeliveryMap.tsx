import { useCallback, useEffect, useMemo, useState } from 'react';
import { LeafletFallbackMap } from './LeafletFallbackMap';
import { useDeliveryRoute } from '../hooks/useDeliveryRoute';
import { haversineMeters, formatDistanceMeters, formatEtaMinutes } from '../utils/geo';
import type { ItemOrder } from '../types/payment';
import type { VendorDeliveryState } from '../hooks/useVendorDelivery';
import type { LiveBikeLocation } from './LiveTrackingMap';

// Real fixed shop/origin coordinates (Pillaiyar Koil Street / 1st Cross Street, Maduravoyal)
const SHOP_LOCATION = { lat: 13.0550, lng: 80.1633 };

// Real AGS Theatre (AGS Cinemas), Maduravoyal, Chennai — fallback destination
const MADURAVOYAL_AGS = { lat: 13.0606, lng: 80.1661 };

/** Check if two geo points are within a few meters of each other. */
function isNear(a: { lat: number; lng: number }, b: { lat: number; lng: number }, meters = 50): boolean {
  return haversineMeters(a, b) < meters;
}

interface VendorDeliveryMapProps {
  order: ItemOrder;
  delivery: VendorDeliveryState;
  onClose: () => void;
}

/**
 * Full-screen delivery map for vendor (Swiggy/Zepto-style).
 * Vendor's GPS is the bike marker; customer delivery address is the destination pin.
 * Road route line refreshes every few seconds as vendor moves.
 */
export function VendorDeliveryMap({ order, delivery, onClose }: VendorDeliveryMapProps) {
  const { position, error, isDelivering, stopDelivery } = delivery;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(t);
  }, []);  // Destination: customer delivery address (falls back to a real nearby
  // landmark so the route line + pins stay meaningful, never the shop itself).
  const destination = useMemo(() => {
    if (order.deliveryAddress) {
      const addr = { lat: order.deliveryAddress.lat, lng: order.deliveryAddress.lng };
      // If the saved coordinates are at/near the shop, the address was likely
      // entered manually without proper geocoding.  Use AGS Theatre as a
      // meaningful fallback so the route and pins stay visible.
      if (isNear(addr, SHOP_LOCATION)) {
        return MADURAVOYAL_AGS;
      }
      return addr;
    }
    return MADURAVOYAL_AGS;
  }, [order]);

  const destinationLabel = order.deliveryAddress?.address ?? 'AGS Theatre, Maduravoyal';

  // Bike: vendor live GPS or shop fallback
  const bike = useMemo<LiveBikeLocation>(() => {
    if (position) {
      return {
        lat: position.latitude,
        lng: position.longitude,
        heading: position.heading ?? null,
        timestamp: position.timestamp,
        speed: position.speed ?? null,
      };
    }
    return { lat: SHOP_LOCATION.lat, lng: SHOP_LOCATION.lng, heading: 90, timestamp: Date.now(), speed: null };
  }, [position]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bike, route, destination, now]);

  const handleStop = useCallback(async () => {
    await stopDelivery();
    onClose();
  }, [stopDelivery, onClose]);

  const hasGPS = !!position;
  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="vdm-overlay">
      <div className="vdm-panel">
        {/* Header */}
        <div className="vdm-header">
          <div className="vdm-header-info">
            <span className="vdm-header-icon">🛵</span>
            <div>
              <span className="vdm-header-title">Delivering Order {order.id}</span>
              <span className="vdm-header-sub">
                📍 {destinationLabel}
              </span>
            </div>
          </div>
          <button className="vdm-stop-btn" onClick={handleStop}>
            ✓ Delivered
          </button>
        </div>

        {/* ETA Chips */}
        <div className="vdm-chips">
          <div className="vdm-chip">
            <span className="vdm-chip-icon">⏱</span>
            <div>
              <div className="vdm-chip-val">{etaSeconds ? formatEtaMinutes(etaSeconds) : '--'}</div>
              <div className="vdm-chip-lbl">ETA</div>
            </div>
          </div>
          <div className="vdm-chip-divider" />
          <div className="vdm-chip">
            <span className="vdm-chip-icon">📍</span>
            <div>
              <div className="vdm-chip-val">{distanceMeters != null ? formatDistanceMeters(distanceMeters) : '--'}</div>
              <div className="vdm-chip-lbl">Distance</div>
            </div>
          </div>
          <div className="vdm-chip-divider" />
          <div className="vdm-chip">
            <span className="vdm-chip-icon">🕐</span>
            <div>
              <div className="vdm-chip-val">{position ? formatTime(position.timestamp) : '--'}</div>
              <div className="vdm-chip-lbl">Updated</div>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="vdm-map-wrapper">
          <LeafletFallbackMap
            bike={bike}
            destination={destination}
            shopLocation={SHOP_LOCATION}
            route={route}
            destinationLabel={destinationLabel}
            shopLabel="Shop (Origin)"
            partnerLabel="You (Vendor)"
          />

          {/* Live GPS pill */}
          <div className={`vdm-live-pill ${hasGPS ? 'vdm-live-active' : ''}`}>
            <span className={`vdm-status-dot ${hasGPS ? 'live' : ''}`} />
            <span className="vdm-status-text">
              {error
                ? (error.toLowerCase().includes('denied') ? '🔒 Allow location access' : `⚠️ ${error}`)
                : hasGPS
                  ? `🛵 Live · ±${position!.accuracy.toFixed(0)}m`
                  : '📡 Acquiring GPS…'}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="vdm-legend">
          <span className="vdm-legend-item"><span className="vdm-legend-dot" style={{ background: '#2563eb' }} /> You (bike)</span>
          <span className="vdm-legend-item"><span className="vdm-legend-dot" style={{ background: '#16a34a' }} /> Shop</span>
          <span className="vdm-legend-item"><span className="vdm-legend-dot" style={{ background: '#dc2626' }} /> Customer</span>
        </div>

        {/* Order info */}
        <div className="vdm-order-footer">
          <span className="vdm-order-customer">
            👤 {order.customerName ?? order.customerId}
          </span>
          <span className="vdm-order-total">₹{order.total.toFixed(2)}</span>
          <span className={`vdm-delivery-status ${isDelivering ? 'delivering' : ''}`}>
            {isDelivering ? '🟢 Streaming GPS' : '⚪ Idle'}
          </span>
        </div>
      </div>
    </div>
  );
}
