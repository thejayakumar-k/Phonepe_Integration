import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useDeliveryRoute, type DeliveryRoute } from '../hooks/useDeliveryRoute';
import {
  bearingDegrees,
  formatDistanceMeters,
  formatEtaMinutes,
  formatRelativeTime,
  haversineMeters,
  isFreshFix,
  type GeoPoint,
} from '../utils/geo';

const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/bright';
/** Rapido brand yellow for the bike badge. */
const BIKE_BADGE_COLOR = '#FFD200';
/** Route casing + line colors (Zomato-style blue ribbon). */
const ROUTE_LINE_COLOR = '#1A73E8';

const REFIT_DISTANCE_M = 200;

export interface LiveBikeLocation extends GeoPoint {
  heading?: number | null;
  timestamp?: number | null;
  speed?: number | null;
}

export interface LiveTrackingStats {
  distanceMeters: number;
  etaSeconds: number;
  isRoadRoute: boolean;
  lastUpdated: number | null;
  bike: LiveBikeLocation | null;
}

interface LiveTrackingMapProps {
  /** Real-time position of the delivery bike (null = not yet located). */
  bike: LiveBikeLocation | null;
  /** Where the delivery is heading. */
  destination: GeoPoint;
  /** Optional pre-fetched route (when the caller also needs it). */
  route?: DeliveryRoute | null;
  destinationLabel?: string;
  partnerLabel?: string;
  className?: string;
  /** Live stats callback so callers can show ETA/distance outside the map. */
  onStats?: (stats: LiveTrackingStats) => void;
}

function routeFeatureCollection(route: DeliveryRoute | null) {
  if (!route || route.coordinates.length < 2) return null;
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: route.coordinates },
  };
}

function bikeElement(heading: number): HTMLDivElement {
  const badge = document.createElement('div');
  badge.className = 'ltm-bike-badge';
  const glyph = document.createElement('div');
  glyph.className = 'ltm-bike-glyph';
  glyph.style.transform = `rotate(${heading}deg)`;
  glyph.appendChild(createMotoSvg());
  badge.appendChild(glyph);
  return badge;
}

function createMotoSvg(): SVGElement {
  const wrap = document.createElement('div');
  wrap.innerHTML = MotoIconMarkup();
  return wrap.firstElementChild as SVGElement;
}

/** Static inline SVG markup so a raw DOM marker carries no React refs. */
function MotoIconMarkup(): string {
  return (
    '<svg width="26" height="26" viewBox="0 0 40 40" aria-hidden="true" focusable="false">' +
    '<path d="M8.5 30.5 L13.5 22.5 H22.5" stroke="#141414" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
    '<rect x="14.5" y="20.8" width="8.2" height="5" rx="1.4" fill="#141414" opacity="0.9"/>' +
    '<path d="M11.5 21.2 Q13 17.5 16.5 17.2 H21.5 Q24 17.4 25.2 19.6" stroke="#141414" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
    '<path d="M22.5 20.5 L28.5 12.8" stroke="#141414" stroke-width="2.4" stroke-linecap="round"/>' +
    '<path d="M25.2 11.6 L30.5 12.4" stroke="#141414" stroke-width="2.4" stroke-linecap="round"/>' +
    '<circle cx="31" cy="13.6" r="1.7" fill="#141414"/>' +
    '<path d="M14.5 25.6 L11 29.5" stroke="#141414" stroke-width="2" stroke-linecap="round"/>' +
    '<circle cx="9" cy="29.5" r="4.6" fill="none" stroke="#141414" stroke-width="2.6"/><circle cx="9" cy="29.5" r="1.2" fill="#141414"/>' +
    '<circle cx="29" cy="29.5" r="4.6" fill="none" stroke="#141414" stroke-width="2.6"/><circle cx="29" cy="29.5" r="1.2" fill="#141414"/>' +
    '<circle cx="9" cy="29.5" r="2.6" fill="none" stroke="#141414" stroke-width="0.7" opacity="0.6"/>' +
    '<circle cx="29" cy="29.5" r="2.6" fill="none" stroke="#141414" stroke-width="0.7" opacity="0.6"/>' +
    '</svg>'
  );
}

function destinationElement(label?: string): HTMLDivElement {
  const pin = document.createElement('div');
  pin.className = 'ltm-dest-pin';
  pin.innerHTML =
    '<div class="ltm-dest-head"><div class="ltm-dest-dot"></div></div><div class="ltm-dest-tail"></div>';
  if (label) pin.title = label;
  return pin;
}

/**
 * MyApp-style live delivery map for the web:
 *  - Free OpenFreeMap basemap (no API key)
 *  - OSRM road-following route line (free public server, straight-line fallback)
 *  - Realistic motorcycle badge that smoothly glides between GPS fixes and
 *    rotates to its direction of travel
 *  - Destination pin + live ETA / distance overlay
 */
export function LiveTrackingMap({
  bike,
  destination,
  route: routeProp,
  destinationLabel,
  partnerLabel,
  className = '',
  onStats,
}: LiveTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const bikeMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const lastBikeRef = useRef<LiveBikeLocation | null>(null);
  const headingRef = useRef<number>(0);
  const lastFitCenterRef = useRef<GeoPoint | null>(null);
  const [now, setNow] = useState(Date.now());

  const internalRoute = useDeliveryRoute(bike, destination);
  const route = routeProp !== undefined ? routeProp : internalRoute.route;

  const fitToPoints = useCallback((b: LiveBikeLocation | null, r: DeliveryRoute | null) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const points: Array<[number, number]> = [];
    if (b) points.push([b.lng, b.lat]);
    points.push([destination.lng, destination.lat]);
    if (r && r.coordinates.length > 2) {
      r.coordinates.forEach((c) => points.push([c[0], c[1]]));
    }
    const lats = points.map((p) => p[1]);
    const lngs = points.map((p) => p[0]);
    if (lats.length === 0) return;
    map.fitBounds(
      [
        Math.min(...lngs),
        Math.min(...lats),
        Math.max(...lngs),
        Math.max(...lats),
      ],
      { padding: 70, maxZoom: 16.5, duration: 800 }
    );
    if (b) lastFitCenterRef.current = { lat: b.lat, lng: b.lng };
  }, [destination]);

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: [destination.lng, destination.lat],
      zoom: 14,
      attributionControl: false,
      maxZoom: 19,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right'
    );

    const ensureLayers = () => {
      if (!map.getSource('ltm-route')) {
        map.addSource('ltm-route', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
          id: 'ltm-route-casing',
          type: 'line',
          source: 'ltm-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 7 },
        });
        map.addLayer({
          id: 'ltm-route-line',
          type: 'line',
          source: 'ltm-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': ROUTE_LINE_COLOR, 'line-width': 4.5 },
        });
      }
      if (!destMarkerRef.current) {
        destMarkerRef.current = new maplibregl.Marker({
          element: destinationElement(destinationLabel),
          anchor: 'bottom',
        })
          .setLngLat([destination.lng, destination.lat])
          .addTo(map);
      }
      if (!bikeMarkerRef.current) {
        const badgeEl = bikeElement(0);
        // Hidden until the first real GPS fix arrives.
        badgeEl.style.opacity = '0';
        bikeMarkerRef.current = new maplibregl.Marker({ element: badgeEl, anchor: 'center' }).addTo(map);
      }
      fitToPoints(lastBikeRef.current, routeProp ?? internalRoute.route);
    };

    if (map.isStyleLoaded()) {
      ensureLayers();
    } else {
      map.on('load', ensureLayers);
    }

    // Keep the canvas sized right when the container animates/resizes.
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);

    mapRef.current = map;
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      bikeMarkerRef.current = null;
      destMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bike marker: glide between fixes, rotate to direction of travel.
  useEffect(() => {
    if (!bike) return;
    const marker = bikeMarkerRef.current;
    if (!marker) return;

    const prev = lastBikeRef.current;
    let heading = bike.heading;
    if (typeof heading !== 'number' && prev) {
      const moved = haversineMeters(prev, bike);
      if (moved > 4) heading = bearingDegrees(prev, bike);
    }
    if (typeof heading === 'number' && Number.isFinite(heading)) {
      headingRef.current = heading;
    }
    const glyph = marker.getElement().querySelector<HTMLElement>('.ltm-bike-glyph');
    if (glyph) glyph.style.transform = `rotate(${headingRef.current}deg)`;

    marker.setLngLat([bike.lng, bike.lat]);
    lastBikeRef.current = { ...bike };

    // Refit occasionally so both markers stay visible while the bike travels.
    const lastFit = lastFitCenterRef.current;
    if (!lastFit || haversineMeters(lastFit, bike) > REFIT_DISTANCE_M) {
      fitToPoints(bike, routeProp ?? internalRoute.route);
    }
    const badgeEl = marker.getElement();
    if (badgeEl.style.opacity !== '1') badgeEl.style.opacity = '1';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bike?.lat, bike?.lng]);

  // Route line updates.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource('ltm-route')) return;
    const source = map.getSource('ltm-route') as maplibregl.GeoJSONSource | null;
    if (source) {
      const fc = routeFeatureCollection(route);
      source.setData(
        fc ?? { type: 'FeatureCollection', features: [] }
      );
    }
    if (route && route.coordinates.length > 2) {
      fitToPoints(lastBikeRef.current, route);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.coordinates, route?.isRoadRoute]);

  // Destination changes → move pin.
  useEffect(() => {
    destMarkerRef.current?.setLngLat([destination.lng, destination.lat]);
  }, [destination.lat, destination.lng]);

  // Freshness tick.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo((): LiveTrackingStats => {
    let distanceMeters = 0;
    let etaSeconds = 0;
    if (bike && route) {
      if (route.isRoadRoute) {
        distanceMeters = route.distanceMeters;
        etaSeconds = route.durationSeconds;
      } else {
        distanceMeters = Math.round(haversineMeters(bike, destination));
        etaSeconds = isFreshFix(bike.timestamp, now)
          ? Math.round(haversineMeters(bike, destination) / 8.33)
          : 0;
      }
    }
    return {
      distanceMeters,
      etaSeconds,
      isRoadRoute: route?.isRoadRoute ?? false,
      lastUpdated: bike?.timestamp ?? null,
      bike,
    };
  }, [bike, route, destination, now]);

  useEffect(() => {
    onStats?.(stats);
  }, [stats, onStats]);

  const gotoBike = useCallback(() => {
    if (!bike) return;
    mapRef.current?.flyTo({ center: [bike.lng, bike.lat], zoom: 16, duration: 900 });
  }, [bike]);

  return (
    <div className={`ltm-root ${className}`}>
      <div ref={containerRef} className="ltm-map" />
      <div className="ltm-overlay">
        <div className="ltm-legend">
          <span className="ltm-legend-item">
            <span className="ltm-legend-bike" />
            {partnerLabel || 'Delivery partner'}
          </span>
          <span className="ltm-legend-item">
            <span className="ltm-legend-dot dest" />
            {destinationLabel || 'Delivery point'}
          </span>
        </div>
        <div className="ltm-stats">
          <div className="ltm-stat">
            <span className="ltm-stat-label">ETA</span>
            <span className="ltm-stat-value">{formatEtaMinutes(stats.etaSeconds)}</span>
          </div>
          <div className="ltm-stat">
            <span className="ltm-stat-label">Distance</span>
            <span className="ltm-stat-value">{formatDistanceMeters(stats.distanceMeters)}</span>
          </div>
          <div className="ltm-stat">
            <span className="ltm-stat-label">Updated</span>
            <span className="ltm-stat-value">
              {stats.lastUpdated ? formatRelativeTime(stats.lastUpdated, now) : '--'}
            </span>
          </div>
        </div>
        <button className="ltm-recenter" onClick={gotoBike} title="Re-centre on bike">
          ◎
        </button>
        <div className="ltm-live">
          <span className={`ltm-live-dot ${bike && isFreshFix(bike.timestamp, now) ? 'live' : ''}`} />
          {bike && isFreshFix(bike.timestamp, now) ? 'Live' : 'Waiting for GPS…'}
        </div>
      </div>
    </div>
  );
}

export { BIKE_BADGE_COLOR, ROUTE_LINE_COLOR };