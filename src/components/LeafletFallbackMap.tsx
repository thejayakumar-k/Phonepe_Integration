import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DeliveryRoute } from '../hooks/useDeliveryRoute';
import { bikeBadgeElement, destPinElement } from '../utils/ltmDom';
import type { GeoPoint } from '../utils/geo';
import { haversineMeters } from '../utils/geo';
import type { LiveBikeLocation } from './LiveTrackingMap';

// Green shop pin
function shopPinElement(label?: string): HTMLDivElement {
  const pin = document.createElement('div');
  pin.className = 'ltm-shop-pin';
  pin.innerHTML =
    '<div class="ltm-shop-head"><div class="ltm-shop-dot"></div></div>' +
    '<div class="ltm-shop-tail"></div>';
  if (label) pin.title = label;
  return pin;
}

// How far (m) the bike must move before the map re-centres
const AUTO_PAN_THRESHOLD_M = 3;

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
 * Live delivery map — Zepto / Swiggy style.
 *  ✅ 100% free OpenStreetMap tiles (no API key, no sign-up)
 *  ✅ Real bike icon (side-view scooter SVG with rider)
 *  ✅ Pulsing ring around bike (Zepto-style)
 *  ✅ Auto-follow camera — map pans to bike every GPS fix
 *  ✅ Animated dashed route line (OSRM road-following)
 *  ✅ 3 markers: shop (green) · bike (animated) · customer (red)
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
  const lastPanRef = useRef<GeoPoint | null>(null);
  const hasInitFit = useRef(false);

  // Smooth pan to bike if it moved significantly
  const panToBike = useCallback((b: LiveBikeLocation) => {
    const map = mapRef.current;
    if (!map) return;
    const last = lastPanRef.current;
    if (last && haversineMeters(last, b) < AUTO_PAN_THRESHOLD_M) return;
    map.panTo([b.lat, b.lng], { animate: true, duration: 0.8 });
    lastPanRef.current = { lat: b.lat, lng: b.lng };
  }, []);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      // Smooth panning
      inertia: true,
      inertiaDeceleration: 2500,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

    // ── 100% Free OpenStreetMap tiles — zero API key ──
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: ['a', 'b', 'c'],
      maxZoom: 19,
      detectRetina: true,
    }).addTo(map);

    map.setView([destination.lat, destination.lng], 15);

    // ── Route: white casing ──
    casingRef.current = L.polyline([], {
      color: '#ffffff',
      weight: 10,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
    }).addTo(map);

    // ── Route: blue fill ──
    lineRef.current = L.polyline([], {
      color: '#2563eb',
      weight: 6,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
    }).addTo(map);

    // ── Route: animated white dashes (Zepto-style flow) ──
    animDashRef.current = L.polyline([], {
      color: '#ffffff',
      weight: 3,
      opacity: 0.85,
      dashArray: '12 18',
      lineCap: 'round',
      interactive: false,
      className: 'ltm-animated-dash',
    } as L.PolylineOptions).addTo(map);

    // ── Customer address pin (red) ──
    const pin = destPinElement(destinationLabel);
    destMarkerRef.current = L.marker([destination.lat, destination.lng], {
      icon: L.divIcon({
        className: 'ltm-divicon',
        html: pin,
        iconSize: [24, 42],
        iconAnchor: [12, 40],
      }),
      interactive: false,
      zIndexOffset: 200,
    }).addTo(map);

    // ── Shop pin (green) ──
    if (shopLocation) {
      const shopPin = shopPinElement(shopLabel);
      shopMarkerRef.current = L.marker([shopLocation.lat, shopLocation.lng], {
        icon: L.divIcon({
          className: 'ltm-divicon',
          html: shopPin,
          iconSize: [24, 42],
          iconAnchor: [12, 40],
        }),
        interactive: false,
        zIndexOffset: 180,
      }).addTo(map);
    }

    // ── Bike marker (starts at shop, moves to GPS fix) ──
    const badge = bikeBadgeElement(0);
    // Don't hide — show at shop location until GPS moves it
    bikeMarkerRef.current = L.marker([shopLocation?.lat ?? destination.lat, shopLocation?.lng ?? destination.lng], {
      icon: L.divIcon({
        className: 'ltm-divicon',
        html: badge,
        iconSize: [70, 56],   // side-view scooter width
        iconAnchor: [35, 50], // anchor at center-bottom (ground level)
      }),
      interactive: false,
      zIndexOffset: 400,
    }).addTo(map);

    mapRef.current = map;
    // Force layout after React paints
    setTimeout(() => map.invalidateSize(), 120);

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
      lastPanRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial fit: show bike + shop + destination all at once
  useEffect(() => {
    const map = mapRef.current;
    if (!map || hasInitFit.current) return;
    const pts: Array<[number, number]> = [[destination.lat, destination.lng]];
    if (bike) pts.push([bike.lat, bike.lng]);
    if (shopLocation) pts.push([shopLocation.lat, shopLocation.lng]);
    if (pts.length > 1) {
      map.fitBounds(L.latLngBounds(pts), { padding: [55, 55], maxZoom: 16, animate: true });
    } else {
      map.setView([destination.lat, destination.lng], 15);
    }
    hasInitFit.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bike?.lat, bike?.lng]);

  // ── Real-time route line updates (OSRM) ──
  // Use a stable key based on length + first + last point to detect real changes
  const routeKey = route
    ? `${route.coordinates.length}|${route.coordinates[0]?.join()}|${route.coordinates[route.coordinates.length - 1]?.join()}`
    : 'empty';

  useEffect(() => {
    if (!mapRef.current) return;
    const coords: Array<[number, number]> =
      route && route.coordinates.length > 1
        ? route.coordinates.map((c) => [c[1], c[0]] as [number, number])
        : [];
    casingRef.current?.setLatLngs(coords);
    lineRef.current?.setLatLngs(coords);
    animDashRef.current?.setLatLngs(coords);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);


  // ── Real-time bike position + heading + auto-pan ──
  useEffect(() => {
    if (!bike) return;
    const marker = bikeMarkerRef.current;
    if (!marker) return;

    // Move marker to real GPS position
    marker.setLatLng([bike.lat, bike.lng]);

    // Find the badge element inside the Leaflet container and rotate it
    const container = marker.getElement() as HTMLElement | null;
    if (container) {
      // Show the badge (it may have been hidden by Leaflet internals)
      container.style.opacity = '1';
      // Rotate scooter glyph to match GPS heading
      const glyph = container.querySelector<HTMLElement>('.ltm-bike-glyph');
      if (glyph) {
        const heading = typeof bike.heading === 'number' && bike.heading >= 0 ? bike.heading : 0;
        glyph.style.transform = `rotate(${heading}deg)`;
        glyph.style.transition = 'transform 0.7s cubic-bezier(0.22,1,0.36,1)';
      }
      // Ensure pulsing ring is visible
      const pulse = container.querySelector<HTMLElement>('.ltm-bike-pulse');
      if (pulse) pulse.style.display = 'block';
    }

    // Auto-pan map to follow bike
    panToBike(bike);
  }, [bike?.lat, bike?.lng, bike?.heading, panToBike]);

  // Destination pin updates
  useEffect(() => {
    destMarkerRef.current?.setLatLng([destination.lat, destination.lng]);
  }, [destination.lat, destination.lng]);

  // Shop pin updates
  useEffect(() => {
    if (shopLocation && mapRef.current) {
      if (!shopMarkerRef.current) {
        const shopPin = shopPinElement(shopLabel);
        shopMarkerRef.current = L.marker([shopLocation.lat, shopLocation.lng], {
          icon: L.divIcon({
            className: 'ltm-divicon',
            html: shopPin,
            iconSize: [24, 42],
            iconAnchor: [12, 40],
          }),
          interactive: false,
          zIndexOffset: 180,
        }).addTo(mapRef.current);
      } else {
        shopMarkerRef.current.setLatLng([shopLocation.lat, shopLocation.lng]);
      }
    }
  }, [shopLocation?.lat, shopLocation?.lng, shopLabel]);

  return (
    <div
      className={`ltm-root ${className}`}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: '280px' }}
    >
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  );
}
