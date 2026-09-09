import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DeliveryRoute } from '../hooks/useDeliveryRoute';
import {
  CARTO_ATTRIBUTION,
  CARTO_RASTER_SUBDOMAINS,
  CARTO_RASTER_TILE,
  bikeBadgeElement,
  destPinElement,
} from '../utils/ltmDom';
import type { GeoPoint } from '../utils/geo';
import type { LiveBikeLocation } from './LiveTrackingMap';

interface LeafletFallbackMapProps {
  bike: LiveBikeLocation | null;
  destination: GeoPoint;
  route?: DeliveryRoute | null;
  destinationLabel?: string;
  partnerLabel?: string;
  className?: string;
}

/**
 * No-WebGL fallback for LiveTrackingMap. Uses plain DOM/CSS tiles (Leaflet)
 * so the delivery map still works on phones/in-app browsers where
 * maplibre-gl v6 cannot create a WebGL2 context. Reuses the same bike badge,
 * destination pin and OSRM route.
 */
export function LeafletFallbackMap({
  bike,
  destination,
  route,
  destinationLabel,
  className = '',
}: LeafletFallbackMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const bikeMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const casingRef = useRef<L.Polyline | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer(CARTO_RASTER_TILE, {
      attribution: CARTO_ATTRIBUTION,
      subdomains: CARTO_RASTER_SUBDOMAINS,
      maxZoom: 19,
    }).addTo(map);
    map.setView([destination.lat, destination.lng], 14);

    const pin = destPinElement(destinationLabel);
    destMarkerRef.current = L.marker([destination.lat, destination.lng], {
      icon: L.divIcon({
        className: 'ltm-divicon',
        html: pin,
        iconSize: [22, 34],
        iconAnchor: [11, 32],
      }),
      interactive: false,
    }).addTo(map);

    const badge = bikeBadgeElement(0);
    badge.style.opacity = '0';
    bikeMarkerRef.current = L.marker([destination.lat, destination.lng], {
      icon: L.divIcon({
        className: 'ltm-divicon',
        html: badge,
        iconSize: [46, 46],
        iconAnchor: [23, 23],
      }),
      interactive: false,
    }).addTo(map);

    casingRef.current = L.polyline([], {
      color: '#ffffff',
      weight: 7,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
    }).addTo(map);
    lineRef.current = L.polyline([], {
      color: '#1A73E8',
      weight: 4.5,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      bikeMarkerRef.current = null;
      destMarkerRef.current = null;
      casingRef.current = null;
      lineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial view: destination + current bike.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pts: Array<[number, number]> = [[destination.lat, destination.lng]];
    if (bike) pts.push([bike.lat, bike.lng]);
    map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route line (OSRM) updates.
  useEffect(() => {
    const coords: Array<[number, number]> =
      route && route.coordinates.length > 1
        ? route.coordinates.map(
            (c) => [c[1], c[0]] as [number, number]
          )
        : [];
    casingRef.current?.setLatLngs(coords);
    lineRef.current?.setLatLngs(coords);
  }, [route?.coordinates]);

  // Bike badge follows the GPS fixes.
  useEffect(() => {
    if (!bike) return;
    const marker = bikeMarkerRef.current;
    if (!marker) return;
    marker.setLatLng([bike.lat, bike.lng]);
    const badge = marker.getElement() as HTMLElement | null;
    if (badge) {
      if (badge.style.opacity !== '1') badge.style.opacity = '1';
      const glyph = badge.querySelector<HTMLElement>('.ltm-bike-glyph');
      const heading = typeof bike.heading === 'number' ? bike.heading : 0;
      if (glyph) glyph.style.transform = `rotate(${heading}deg)`;
    }
  }, [bike?.lat, bike?.lng, bike?.heading]);

  // Destination changes.
  useEffect(() => {
    destMarkerRef.current?.setLatLng([destination.lat, destination.lng]);
  }, [destination.lat, destination.lng]);

  return (
    <div className={`ltm-root ${className}`}>
      <div ref={containerRef} className="ltm-map" />
      <div className="ltm-overlay">
        <div className="ltm-legend">
          <span className="ltm-legend-item">
            <span className="ltm-legend-bike" />
            Delivery partner
          </span>
          <span className="ltm-legend-item">
            <span className="ltm-legend-dot dest" />
            {destinationLabel || 'Delivery point'}
          </span>
        </div>
        <div className="ltm-live">
          <span className={`ltm-live-dot ${bike ? 'live' : ''}`} />
          {bike ? 'Live' : 'Waiting for GPS…'}
        </div>
      </div>
    </div>
  );
}