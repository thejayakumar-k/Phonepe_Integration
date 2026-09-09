import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { ItemOrder } from '../types/payment';

export interface VendorDeliveryState {
  isDelivering: boolean;
  activeOrder: ItemOrder | null;
  /** Latest GPS fix for the vendor's own map (null until first fix). */
  position: {
    latitude: number;
    longitude: number;
    speed: number | null;
    heading: number | null;
    accuracy: number;
    timestamp: number;
  } | null;
  bikeId: string | null;
  error: string | null;
  startDelivery: (order: ItemOrder) => void;
  stopDelivery: () => Promise<void>;
}

/**
 * Manages vendor delivery GPS streaming.
 * bikeId = order.id — so the customer OrderTrackingMap (which subscribes
 * to bike_locations filtered by orderId) auto-follows the vendor in real time.
 */
export function useVendorDelivery(): VendorDeliveryState {
  const [isDelivering, setIsDelivering] = useState(false);
  const [activeOrder, setActiveOrder] = useState<ItemOrder | null>(null);
  const [bikeId, setBikeId] = useState<string | null>(null);
  const [position, setPosition] = useState<VendorDeliveryState['position']>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Push the current GPS fix to Supabase. Falls back to the latest cached
  // position so the customer map turns "Live" immediately.
  const gpsRef = useRef<{ latitude: number; longitude: number; speed: number | null; heading: number | null; accuracy: number; timestamp: number } | null>(null);

  const writeLocal = useCallback((id: string, pos: { latitude: number; longitude: number; speed: number | null; heading: number | null; accuracy: number; timestamp: number }) => {
    try {
      // Cross-tab bridge: the customer's tracking map reads this same key,
      // so it updates instantly even if Supabase realtime hasn't landed yet.
      localStorage.setItem(
        `oorunii_bike_${id}`,
        JSON.stringify({
          latitude: pos.latitude,
          longitude: pos.longitude,
          speed: pos.speed ?? null,
          heading: pos.heading ?? null,
          accuracy: pos.accuracy,
          timestamp: new Date(pos.timestamp).toISOString(),
        })
      );
    } catch {
      // localStorage unavailable — Supabase upsert is still the source of truth.
    }
  }, []);

  const pushGPS = useCallback(async (fix?: {
    latitude: number;
    longitude: number;
    speed: number | null;
    heading: number | null;
    accuracy: number;
    timestamp: number;
  }) => {
    const pos = fix ?? gpsRef.current;
    if (!pos) return;
    gpsRef.current = pos;
    if (isMountedRef.current) setPosition(pos);
    if (!isMountedRef.current || !bikeId) return;
    writeLocal(bikeId, pos);
    await supabase
      .from('bike_locations')
      .upsert(
        {
          bike_id: bikeId,
          user_id: 'vendor',
          latitude: pos.latitude,
          longitude: pos.longitude,
          speed: pos.speed ?? null,
          heading: pos.heading ?? null,
          accuracy: pos.accuracy,
          timestamp: new Date(pos.timestamp).toISOString(),
        },
        { onConflict: 'bike_id' }
      )
      .then(({ error: err }) => {
        if (err) console.error('[VendorDelivery] GPS upload failed:', err.message);
      });
  }, [bikeId, writeLocal]);

  // Poll the browser GPS every 2.5 s and stream each fix while delivering.
  useEffect(() => {
    if (!isDelivering || !navigator.geolocation) {
      if (isDelivering) pushGPS();
      return;
    }
    let cancelled = false;

    // Immediately flush whatever position we have (last known / seed).
    pushGPS();

    const sendFix = (pos: GeolocationPosition) => {
      if (cancelled || !isMountedRef.current) return;
      pushGPS({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        speed: pos.coords.speed ?? null,
        heading: pos.coords.heading ?? null,
        accuracy: pos.coords.accuracy ?? 10,
        timestamp: pos.timestamp,
      });
    };

    const handleError = () => {
      // No fix available — keep seeding last known position so the
      // customer never sees a dead map.
      pushGPS();
    };

    navigator.geolocation.getCurrentPosition(sendFix, handleError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 30000,
    });

    const interval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(sendFix, handleError, {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 30000,
      });
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isDelivering, pushGPS]);

  const startDelivery = useCallback((order: ItemOrder) => {
    setActiveOrder(order);
    setBikeId(order.id);
    setIsDelivering(true);

    // Clear stale GPS stream for this order.
    gpsRef.current = null;

    // Instantly seed bike_locations + cross-tab bridge with initial shop
    // position so customer tracking map immediately turns "Live" without
    // waiting for mobile GPS fix.
    const seed = {
      latitude: 13.0550,
      longitude: 80.1633,
      speed: null,
      heading: 90,
      accuracy: 10,
      timestamp: Date.now(),
    };
    gpsRef.current = seed;
    setPosition(seed);
    writeLocal(order.id, seed);
    supabase
      .from('bike_locations')
      .upsert(
        {
          bike_id: order.id,
          user_id: 'vendor',
          latitude: seed.latitude,
          longitude: seed.longitude,
          speed: seed.speed,
          heading: seed.heading,
          accuracy: seed.accuracy,
          timestamp: new Date(seed.timestamp).toISOString(),
        },
        { onConflict: 'bike_id' }
      )
      .then(({ error: err }) => {
        if (err) console.error('[VendorDelivery] initial GPS upload failed:', err.message);
      });

    supabase
      .from('item_orders')
      .update({ status: 'OUT_FOR_DELIVERY' })
      .eq('id', order.id)
      .then(({ error: err }) => {
        if (err) console.error('[VendorDelivery] status update failed:', err.message);
      });
  }, [writeLocal]);

  const stopDelivery = useCallback(async () => {
    if (activeOrder) {
      await supabase
        .from('item_orders')
        .update({ status: 'DELIVERED' })
        .eq('id', activeOrder.id);
    }
    if (isMountedRef.current) {
      setIsDelivering(false);
      setActiveOrder(null);
      setBikeId(null);
    }
  }, [activeOrder]);

  return { isDelivering, activeOrder, position, bikeId, error: null, startDelivery, stopDelivery };
}
