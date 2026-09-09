import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { GPSPosition } from './useGPS';

export interface BikeLocation {
  id: string;
  bike_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy: number;
  timestamp: string;
  created_at: string;
}

export interface UseRealtimeGPSOptions {
  bikeId: string;
  userId?: string;
  enabled?: boolean;
}

export function useRealtimeGPS({ bikeId, userId, enabled = true }: UseRealtimeGPSOptions) {
  const [bikeLocation, setBikeLocation] = useState<BikeLocation | null>(null);
  const [allBikeLocations, setAllBikeLocations] = useState<Map<string, BikeLocation>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Keep the freshest known location in a ref so the cross-tab bridge can
  // compare timestamps without depending on the render cycle.
  const bikeLocationRef = useRef<BikeLocation | null>(null);

  // Save GPS position to Supabase
  const saveLocation = useCallback(async (position: GPSPosition) => {
    if (!enabled || !bikeId) return;

    try {
      const { error: saveError } = await supabase
        .from('bike_locations')
        .upsert(
          {
            bike_id: bikeId,
            user_id: userId || 'anonymous',
            latitude: position.latitude,
            longitude: position.longitude,
            speed: position.speed,
            heading: position.heading,
            accuracy: position.accuracy,
            timestamp: new Date(position.timestamp).toISOString(),
          },
          { onConflict: 'bike_id' }
        );

      if (saveError) {
        console.error('Error saving location:', saveError);
        setError('Failed to save location');
      }
    } catch (err) {
      console.error('Error saving location:', err);
      setError('Failed to save location');
    }
  }, [bikeId, userId, enabled]);

  // Subscribe to real-time updates for this specific bike
  useEffect(() => {
    if (!enabled || !bikeId) return;

    // ── Cross-tab bridge: vendor writes its position to localStorage, so the
    // customer map updates instantly even if Supabase realtime hasn't landed. ──
    const readLocalBridge = (): BikeLocation | null => {
      try {
        const raw = localStorage.getItem(`oorunii_bike_${bikeId}`);
        if (!raw) return null;
        const p = JSON.parse(raw) as {
          latitude: number;
          longitude: number;
          speed?: number | null;
          heading?: number | null;
          accuracy: number;
          timestamp: string;
        };
        return {
          id: bikeId,
          bike_id: bikeId,
          user_id: 'vendor',
          latitude: p.latitude,
          longitude: p.longitude,
          speed: p.speed ?? undefined,
          heading: p.heading ?? undefined,
          accuracy: p.accuracy ?? 10,
          timestamp: p.timestamp,
          created_at: p.timestamp,
        } as BikeLocation;
      } catch {
        return null;
      }
    };

    const applyLocalBridge = () => {
      const local = readLocalBridge();
      if (local) {
        // Only use if fresher than what we already have (or nothing yet).
        const currentTs = bikeLocationRef.current?.timestamp;
        if (!currentTs || local.timestamp > currentTs) {
          bikeLocationRef.current = local;
          setBikeLocation(local);
        }
      }
    };

    // ── Helper: fetch latest row for this bike ──
    const fetchLatest = () =>
      supabase
        .from('bike_locations')
        .select('*')
        .eq('bike_id', bikeId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            bikeLocationRef.current = data[0] as BikeLocation;
            setBikeLocation(data[0] as BikeLocation);
          }
          // Supabase empty → fall back to the cross-tab bridge.
          else {
            applyLocalBridge();
          }
        })
        .catch(() => applyLocalBridge());

    // Fetch immediately on mount, then bridge first + poll as fallback.
    applyLocalBridge();
    fetchLatest();

    // Listen for localStorage writes from the vendor tab (instant updates).
    const onStorage = (e: StorageEvent) => {
      if (e.key === `oorunii_bike_${bikeId}`) applyLocalBridge();
    };
    window.addEventListener('storage', onStorage);

    // Poll every 5 s as fallback — Supabase realtime can drop on mobile/poor connections
    const pollInterval = setInterval(() => {
      applyLocalBridge();
      fetchLatest();
    }, 5000);

    const channel = supabase
      .channel(`bike:${bikeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bike_locations',
          filter: `bike_id=eq.${bikeId}`,
        },
        (payload) => {
          const newLocation = payload.new as BikeLocation;
          bikeLocationRef.current = newLocation;
          setBikeLocation(newLocation);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('storage', onStorage);
      supabase.removeChannel(channel);
    };
  }, [bikeId, enabled]);

  // Subscribe to all bike locations (for map view showing multiple bikes)
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('all-bikes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bike_locations',
        },
        (payload) => {
          const newLocation = payload.new as BikeLocation;
          setAllBikeLocations((prev) => {
            const next = new Map(prev);
            next.set(newLocation.bike_id, newLocation);
            return next;
          });
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  // Load initial locations
  useEffect(() => {
    if (!enabled) return;

    const loadInitialLocations = async () => {
      try {
        const { data, error: loadError } = await supabase
          .from('bike_locations')
          .select('*')
          .order('timestamp', { ascending: false });

        if (loadError) {
          console.error('Error loading locations:', loadError);
          return;
        }

        if (data) {
          const locationsMap = new Map<string, BikeLocation>();
          data.forEach((location) => {
            locationsMap.set(location.bike_id, location);
          });
          setAllBikeLocations(locationsMap);
        }
      } catch (err) {
        console.error('Error loading locations:', err);
      }
    };

    loadInitialLocations();
  }, [enabled]);

  return {
    bikeLocation,
    allBikeLocations,
    error,
    isConnected,
    saveLocation,
  };
}
