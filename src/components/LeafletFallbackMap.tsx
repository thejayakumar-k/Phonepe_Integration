import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DeliveryRoute } from '../hooks/useDeliveryRoute';
import { bikeBadgeElement, destPinElement } from '../utils/ltmDom';
import type { GeoPoint } from '../utils/geo';
import type { LiveBikeLocation } from './LiveTrackingMap';

// Shop pin (green)
function shopPinElement(label?: string): HTMLDivElement {
  const pin = document.createElement('div');
  pin.className = 'ltm-shop-pin';
  pin.innerHTML = `<div class="ltm-shop-head"><div class="ltm-shop-dot"></div></div><div class="ltm-shop-tail"></div>`;
  if (label) pin.title = label;
  return pin;
}

interface LeafletFallbackMapProps {
  bike: LiveBikeLocation | null;
  destination: GeoPoint;
  shopLocation?: GeoPoint;
  route?: DeliveryRoute | null;
  destinationLabel?: string;
  shopLabel?: string;
  partnerLabel?: string;
  className?: string;
}

/**
 * Reliable Leaflet-based live delivery map.
 * CartoDB Voyager tiles (free, no API key), animated dashed route, shop+dest+bike markers.
 */
export function LeafletFallbackMap({
  bike,
  destination,
  shopLocation,
  route,
  destinationLabel,
  shopLabel,
  className = '',
}: LeafletFallbackMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const bikeMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const shopMarkerRef = useRef<L.Marker | null>(null);
  const casingRef = useRef<L.Polyline | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  const animDashRef = useRef<L.Polyline | null>(null);
  const hasInitFit = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

    // CartoDB Voyager - clean, readable, no API key
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: ['a', 'b', 'c', 'd'],
        maxZoom: 19,
        detectRetina: true,
      }
    ).addTo(map);

    map.setView([destination.lat, destination.lng], 14);

    // White casing for route contrast
    casingRef.current = L.polyline([], {
      color: '#ffffff',
      weight: 9,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
    }).addTo(map);

    // Blue route fill
    lineRef.current = L.polyline([], {
      color: '#1a73e8',
      weight: 5.5,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
    }).addTo(map);

    // Animated white dashes on top (Swiggy-style)
    animDashRef.current = L.polyline([], {
      color: '#ffffff',
      weight: 2.5,
      opacity: 0.8,
      dashArray: '10, 16',
      lineCap: 'round',
      interactive: false,
      className: 'ltm-animated-dash',
    } as L.PolylineOptions).addTo(map);

    // Destination pin (red)
    const pin = destPinElement(destinationLabel);
    destMarkerRef.current = L.marker([destination.lat, destination.lng], {
      icon: L.divIcon({
        className: 'ltm-divicon',
        html: pin,
        iconSize: [22, 40],
        iconAnchor: [11, 38],
      }),
      interactive: false,
      zIndexOffset: 200,
    }).addTo(map);

    // Shop pin (green)
    if (shopLocation) {
      const shopPin = shopPinElement(shopLabel);
      shopMarkerRef.current = L.marker([shopLocation.lat, shopLocation.lng], {
        icon: L.divIcon({
          className: 'ltm-divicon',
          html: shopPin,
          iconSize: [22, 40],
          iconAnchor: [11, 38],
        }),
        interactive: false,
        zIndexOffset: 180,
      }).addTo(map);
    }

    // Bike badge
    const badge = bikeBadgeElement(0);
    badge.style.opacity = '0';
    badge.style.transition = 'opacity 0.4s ease';
    bikeMarkerRef.current = L.marker([destination.lat, destination.lng], {
      icon: L.divIcon({
        className: 'ltm-divicon',
        html: badge,
        iconSize: [50, 50],
        iconAnchor: [25, 25],
      }),
      interactive: false,
      zIndexOffset: 300,
    }).addTo(map);

    mapRef.current = map;

    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      bikeMarkerRef.current = null;
      destMarkerRef.current = null;
      shopMarkerRef.current = null;
      casingRef.current = null;
      lineRef.current = null;
      animDashRef.current = null;
      hasInitFit.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fit bounds once when bike is known
  useEffect(() => {
    const map = mapRef.current;
    if (!map || hasInitFit.current) return;
    const pts: Array<[number, number]> = [[destination.lat, destination.lng]];
    if (bike) pts.push([bike.lat, bike.lng]);
    if (shopLocation) pts.push([shopLocation.lat, shopLocation.lng]);
    if (pts.length > 1) {
      map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 16 });
      hasInitFit.current = true;
    } else {
      map.setView([destination.lat, destination.lng], 15);
      hasInitFit.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bike?.lat, bike?.lng]);

  // Route line (OSRM) updates
  useEffect(() => {
    const coords: Array<[number, number]> =
      route && route.coordinates.length > 1
        ? route.coordinates.map((c) => [c[1], c[0]] as [number, number])
        : [];
    casingRef.current?.setLatLngs(coords);
    lineRef.current?.setLatLngs(coords);
    animDashRef.current?.setLatLngs(coords);
  }, [route?.coordinates]);

  // Bike badge follows GPS fixes
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

  // Destination changes
  useEffect(() => {
    destMarkerRef.current?.setLatLng([destination.lat, destination.lng]);
  }, [destination.lat, destination.lng]);

  // Shop location changes
  useEffect(() => {
    if (shopLocation) shopMarkerRef.current?.setLatLng([shopLocation.lat, shopLocation.lng]);
  }, [shopLocation?.lat, shopLocation?.lng]);

  return (
    <div className={`ltm-root ${className}`} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}