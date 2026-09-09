import { useState, useCallback, useEffect, useRef } from 'react';
import { useGPS } from './useGPS';
import { supabase } from '../lib/supabase';
import type { ItemOrder } from '../types/payment';
import type { GPSPosition } from './useGPS';

export interface VendorDeliveryState {
  isDelivering: boolean;
  activeOrder: ItemOrder | null;
  position: GPSPosition | null;
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
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const { position, error, startTracking, stopTracking } = useGPS({
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 30000,
    watchPosition: true,
  });

  // Stream each GPS fix to Supabase bike_locations (keyed by order ID)
  useEffect(() => {
    if (!isDelivering || !position || !bikeId) return;
    supabase
      .from('bike_locations')
      .upsert(
        {
          bike_id: bikeId,
          user_id: 'vendor',
          latitude: position.latitude,
          longitude: position.longitude,
          speed: position.speed ?? null,
          heading: position.heading ?? null,
          accuracy: position.accuracy,
          timestamp: new Date(position.timestamp).toISOString(),
        },
        { onConflict: 'bike_id' }
      )
      .then(({ error: err }) => {
        if (err) console.error('[VendorDelivery] GPS upload failed:', err.message);
      });
  }, [position, isDelivering, bikeId]);

  const startDelivery = useCallback((order: ItemOrder) => {
    setActiveOrder(order);
    setBikeId(order.id);
    setIsDelivering(true);
    startTracking();

    // Instantly seed bike_locations with initial shop position so customer
    // tracking map immediately turns "Live" without waiting for mobile GPS fix.
    supabase
      .from('bike_locations')
      .upsert(
        {
          bike_id: order.id,
          user_id: 'vendor',
          latitude: 13.0550,
          longitude: 80.1633,
          speed: null,
          heading: 90,
          accuracy: 10,
          timestamp: new Date().toISOString(),
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
  }, [startTracking]);

  const stopDelivery = useCallback(async () => {
    stopTracking();
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
  }, [stopTracking, activeOrder]);

  return { isDelivering, activeOrder, position, bikeId, error, startDelivery, stopDelivery };
}
