import { useState, useEffect, useCallback, useRef } from 'react';

export interface GPSPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  heading?: number;
}

export interface UseGPSOptions {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
  watchPosition?: boolean;
}

export function useGPS(options: UseGPSOptions = {}) {
  const [position, setPosition] = useState<GPSPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const {
    enableHighAccuracy = true,
    maximumAge = 0,
    timeout = 30000,
    watchPosition = true,
  } = options;

  const handleSuccess = useCallback((pos: GeolocationPosition) => {
    const newPos: GPSPosition = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp,
      speed: pos.coords.speed ?? undefined,
      heading: pos.coords.heading ?? undefined,
    };
    setPosition(newPos);
    setError(null);
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    switch (err.code) {
      case err.PERMISSION_DENIED:
        setError('Location permission denied. Please enable location access.');
        break;
      case err.POSITION_UNAVAILABLE:
        setError('Location information unavailable.');
        break;
      case err.TIMEOUT:
        // Transient timeout while moving — keep existing position & don't break tracking
        setError((prev) => (position ? prev : 'Location request timed out. Retrying…'));
        break;
      default:
        setError('An unknown error occurred while getting location.');
    }
  }, [position]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    const positionOptions: PositionOptions = {
      enableHighAccuracy,
      maximumAge,
      timeout,
    };

    if (watchPosition) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        positionOptions
      );
    } else {
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        handleError,
        positionOptions
      );
    }
    setIsTracking(true);
  }, [enableHighAccuracy, maximumAge, timeout, watchPosition, handleSuccess, handleError]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    position,
    error,
    isTracking,
    startTracking,
    stopTracking,
  };
}
