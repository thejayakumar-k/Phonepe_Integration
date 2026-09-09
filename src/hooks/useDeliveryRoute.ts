import { useEffect, useRef, useState } from 'react';
import type { GeoPoint } from '../utils/geo';
import { haversineMeters } from '../utils/geo';

/**
 * Road-following route between the delivery bike and the destination,
 * fetched from the free public OSRM demo server (no API key needed).
 * Falls back to a straight line when OSRM is unreachable.
 */

export interface DeliveryRoute {
  /** [lng, lat] pairs following the road network. */
  coordinates: Array<[number, number]>;
  distanceMeters: number;
  /** Real driving duration in seconds (traffic-free estimate). */
  durationSeconds: number;
  /** false = straight-line fallback (OSRM unreachable). */
  isRoadRoute: boolean;
  /** When the road route was fetched, for freshness checks. */
  fetchedAt: number;
}

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';
const REFRESH_INTERVAL_MS = 15000;
const MIN_MOVE_FOR_REFRESH_M = 60;
const MIN_REQUEST_GAP_MS = 10000;
const MAX_FALLBACK_AGE_MS = 45000;

async function fetchRoadRoute(from: GeoPoint, to: GeoPoint): Promise<DeliveryRoute | null> {
  const url =
    `${OSRM_BASE_URL}/${from.lng},${from.lat};${to.lng},${to.lat}` +
    '?overview=full&geometries=geojson&alternatives=false&steps=false';
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const json = await response.json();
    const route = json?.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    return {
      coordinates: coords as Array<[number, number]>,
      distanceMeters: Math.round(route.distance ?? 0),
      durationSeconds: Math.round(route.duration ?? 0),
      isRoadRoute: true,
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

function straightLine(from: GeoPoint, to: GeoPoint): DeliveryRoute {
  return {
    coordinates: [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ],
    distanceMeters: Math.round(haversineMeters(from, to)),
    durationSeconds: Math.round((haversineMeters(from, to) / 8.33) ), // ~30 km/h fallback
    isRoadRoute: false,
    fetchedAt: Date.now(),
  };
}

export interface UseDeliveryRouteResult {
  route: DeliveryRoute | null;
  loading: boolean;
}

/**
 * Keeps a fresh bike → destination route. Refreshes on a timer while the
 * bike moves (so the line re-snaps to roads as it travels) and falls back
 * to a straight line whenever the routing service cannot be reached.
 */
export function useDeliveryRoute(
  partnerLocation: GeoPoint | null,
  destination: GeoPoint | null
): UseDeliveryRouteResult {
  const [route, setRoute] = useState<DeliveryRoute | null>(null);
  const [loading, setLoading] = useState(false);

  const lastAnchorRef = useRef<GeoPoint | null>(null);
  const lastRequestAtRef = useRef(0);
  const inflightRef = useRef(false);
  const mountedRef = useRef(true);
  const routeRef = useRef<DeliveryRoute | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!partnerLocation || !destination) {
      setRoute(null);
      lastAnchorRef.current = null;
      routeRef.current = null;
      return;
    }

    // Instant fallback line so the UI never waits on the network.
    setRoute((prev) => {
      if (prev && prev.isRoadRoute) return prev;
      const fallback = straightLine(partnerLocation, destination);
      routeRef.current = fallback;
      return fallback;
    });

    let timer: ReturnType<typeof setInterval> | null = null;

    const refresh = async () => {
      if (inflightRef.current) return;
      const anchor = lastAnchorRef.current;
      const movedEnough =
        !anchor || haversineMeters(anchor, partnerLocation) >= MIN_MOVE_FOR_REFRESH_M;
      const waitedEnough = Date.now() - lastRequestAtRef.current >= MIN_REQUEST_GAP_MS;
      if (!movedEnough || !waitedEnough) return; // bike hasn't moved enough / too soon

      inflightRef.current = true;
      setLoading(true);
      const result = await fetchRoadRoute(partnerLocation, destination);
      lastRequestAtRef.current = Date.now();
      inflightRef.current = false;
      if (!mountedRef.current) return;
      setLoading(false);
      if (result) {
        lastAnchorRef.current = { lat: partnerLocation.lat, lng: partnerLocation.lng };
        routeRef.current = result;
        setRoute(result);
      } else if (routeRef.current && !routeRef.current.isRoadRoute) {
        const fallback = straightLine(partnerLocation, destination);
        routeRef.current = fallback;
        setRoute(fallback);
      }
    };

    refresh();
    timer = setInterval(refresh, REFRESH_INTERVAL_MS);

    return () => {
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerLocation?.lat, partnerLocation?.lng, destination?.lat, destination?.lng]);

  // ETA helpers consume this externally via the route object; keep the
  // stale fallback out of the "road ETA" path.
  const effectiveRoute =
    route && route.isRoadRoute && Date.now() - route.fetchedAt <= MAX_FALLBACK_AGE_MS
      ? route
      : route;

  return { route: effectiveRoute, loading };
}