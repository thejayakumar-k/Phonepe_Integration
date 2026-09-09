import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DeliveryRoute } from '../hooks/useDeliveryRoute';
import { bikeBadgeElement, destPinElement } from '../utils/ltmDom';
import type { GeoPoint } from '../utils/geo';
import { haversineMeters } from '../utils/geo';
import type { LiveBikeLocation } from './LiveTrackingMap';

// Green shop pin with store icon
function shopPinElement(label = 'Shop'): HTMLDivElement {
  const pin = document.createElement('div');
  pin.className = 'ltm-shop-pin';
  pin.innerHTML =
    '<div class="ltm-shop-head">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
        '<polyline points="9 22 9 12 15 12 15 22"/>' +
      '</svg>' +
    '</div>' +
    '<div class="ltm-shop-tail"></div>';
  pin.title = label;
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
  // Track user interaction so we don't fight their manual zoom/pan
  const userInteractingRef = useRef(false);
  const interactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Smooth pan to bike if it moved significantly — but NOT while the
  // user is manually dragging or zooming the map.
  const panToBike = useCallback((b: LiveBikeLocation) => {
    const map = mapRef.current;
    if (!map) return;
    if (userInteractingRef.current) return; // user is zooming/panning — leave the view alone
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

    // Show destination area initially; fitBounds will adjust once we know all points.
    map.setView([destination.lat, destination.lng], 15);

    // ── First-fit: once we have all markers, fit the view once ──
    const doInitialFit = () => {
      if (hasInitFit.current) return;
      const pts: Array<[number, number]> = [[destination.lat, destination.lng]];
      // Use the initial bike prop (may still be shop fallback)
      if (shopLocation) pts.push([shopLocation.lat, shopLocation.lng]);
      const isMulti = pts.some((p) => p[0] !== pts[0][0] || p[1] !== pts[0][1]);
      if (isMulti) {
        map.fitBounds(L.latLngBounds(pts), { padding: [55, 55], maxZoom: 16, animate: false });
      }
      hasInitFit.current = true;
    };
    // Defer to next frame so markers are placed
    setTimeout(doInitialFit, 200);

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

    // ── Track user interaction to suppress auto-pan while zooming/panning ──
    const startInteraction = () => {
      userInteractingRef.current = true;
      if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    };
    const stopInteraction = () => {
      // Resume auto-pan 2 seconds after the user stops interacting
      if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
      interactionTimerRef.current = setTimeout(() => {
        userInteractingRef.current = false;
      }, 2000);
    };
    map.on('dragstart zoomstart', startInteraction);
    map.on('dragend zoomend moveend', stopInteraction);

    mapRef.current = map;
    // Force layout after React paints
    setTimeout(() => map.invalidateSize(), 120);

    return () => {
      if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
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

  // Re-fit when the destination address changes (e.g. switching orders).
  // Do NOT re-fit on every GPS update — that fights the user's manual
  // zoom/pan.  Bike movement is handled by panToBike instead.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pts: Array<[number, number]> = [[destination.lat, destination.lng]];
    if (bike) pts.push([bike.lat, bike.lng]);
    if (shopLocation) pts.push([shopLocation.lat, shopLocation.lng]);
    
    const isMulti = pts.some((p) => p[0] !== pts[0][0] || p[1] !== pts[0][1]);
    if (isMulti) {
      map.fitBounds(L.latLngBounds(pts), { padding: [55, 55], maxZoom: 16, animate: true });
    } else {
      map.setView([destination.lat, destination.lng], 15);
    }
  }, [destination.lat, destination.lng]);

  // ── Real-time route line updates (OSRM) ──
  // Use a stable key based on length + first + last point to detect real changes
  const routeKey = route
    ? `${route.coordinates.length}|${route.coordinates[0]?.join()}|${route.coordinates[route.coordinates.length - 1]?.join()}`
    : 'empty';

  useEffect(() => {
    if (!mapRef.current) return;
    let coords: Array<[number, number]> = [];
    if (route && route.coordinates && route.coordinates.length > 1) {
      // OSRM road-following route
      coords = route.coordinates.map((c) => [c[1], c[0]] as [number, number]);
    } else if (bike) {
      // Fallback: straight line from bike to destination
      coords = [
        [bike.lat, bike.lng],
        [destination.lat, destination.lng],
      ];
    }

    if (coords.length > 0) {
      casingRef.current?.setLatLngs(coords);
      casingRef.current?.redraw();
      lineRef.current?.setLatLngs(coords);
      lineRef.current?.redraw();
      animDashRef.current?.setLatLngs(coords);
      animDashRef.current?.redraw();
    }
  }, [routeKey, bike?.lat, bike?.lng, destination.lat, destination.lng]);


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
      // GPS heading: 0=North, 90=East, 180=South, 270=West
      // SVG faces East (right), so we subtract 90 to align: North→-90deg, East→0deg
      const glyph = container.querySelector<HTMLElement>('.ltm-bike-glyph');
      if (glyph) {
        // If heading is 90 or empty, cssRotation is 0 (straight facing right)
        const rawHeading = typeof bike.heading === 'number' && !isNaN(bike.heading) && bike.heading > 0 ? bike.heading : 90;
        const cssRotation = rawHeading - 90; // convert GPS heading to SVG rotation
        glyph.style.transform = `rotate(${cssRotation}deg)`;
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
