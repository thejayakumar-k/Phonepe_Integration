import { useState, useEffect, useCallback } from 'react';
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
          setBikeLocation(newLocation);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
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
