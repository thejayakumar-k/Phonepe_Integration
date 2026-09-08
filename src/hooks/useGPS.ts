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
    maximumAge = 5000,
    timeout = 10000,
    watchPosition = true,
  } = options;

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    const newPos: GPSPosition = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
      speed: position.coords.speed ?? undefined,
      heading: position.coords.heading ?? undefined,
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
        setError('Location request timed out.');
        break;
      default:
        setError('An unknown error occurred while getting location.');
    }
  }, []);

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
