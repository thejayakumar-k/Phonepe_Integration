import { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useGPS } from '../hooks/useGPS';

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/bright';

// VVK WATER SUPPLY - Shop location
const SHOP_LOCATION: [number, number] = [80.170, 13.054];

interface DeliveryAddressProps {
  onAddressConfirm: (address: string, lat: number, lng: number) => void;
}

type AddressMode = 'choose' | 'gps' | 'manual';

export function DeliveryAddress({ onAddressConfirm }: DeliveryAddressProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const shopMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const routeSourceRef = useRef(false);

  const [mode, setMode] = useState<AddressMode>('choose');
  const [manualAddress, setManualAddress] = useState('');
  const [manualLandmark, setManualLandmark] = useState('');
  const [gpsAddress, setGpsAddress] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const { position, error: gpsError, startTracking, stopTracking } = useGPS({
    enableHighAccuracy: true,
    maximumAge: 2000,
    timeout: 15000,
    watchPosition: true,
  });

  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, []);

  // Create shop marker
  const createShopEl = useCallback(() => {
    const el = document.createElement('div');
    el.className = 'shop-marker';
    el.innerHTML = '<div class="shop-marker-pin">🏪</div>';
    return el;
  }, []);

  // Create destination marker
  const createDestEl = useCallback(() => {
    const el = document.createElement('div');
    el.className = 'gps-user-marker';
    el.innerHTML = '<div class="gps-marker-pulse"></div><div class="gps-marker-dot"></div>';
    return el;
  }, []);

  // Initialize map at shop location
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: OPENFREEMAP_STYLE,
      center: SHOP_LOCATION,
      zoom: 14,
      attributionControl: false,
    });

    mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    mapInstance.on('load', () => {
      // Shop marker
      shopMarkerRef.current = new maplibregl.Marker({ element: createShopEl(), anchor: 'center' })
        .setLngLat(SHOP_LOCATION)
        .addTo(mapInstance);

      // Destination marker (at shop initially)
      destMarkerRef.current = new maplibregl.Marker({ element: createDestEl(), anchor: 'center' })
        .setLngLat(SHOP_LOCATION)
        .addTo(mapInstance);

      setMapReady(true);
    });

    map.current = mapInstance;

    return () => {
      mapInstance.remove();
      map.current = null;
      shopMarkerRef.current = null;
      destMarkerRef.current = null;
    };
  }, []);

  // Draw route line between shop and destination
  const drawRoute = useCallback((destLng: number, destLat: number) => {
    if (!map.current || !mapReady) return;

    const mapInstance = map.current;

    // Remove old route if exists
    if (mapInstance.getLayer('route-line')) mapInstance.removeLayer('route-line');
    if (mapInstance.getSource('route')) mapInstance.removeSource('route');

    // Draw straight line (OSRM routing would need API call, using direct line for free)
    mapInstance.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            SHOP_LOCATION,
            [destLng, destLat],
          ],
        },
        properties: {},
      },
    });

    mapInstance.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#2563eb',
        'line-width': 3,
        'line-dasharray': [2, 1],
      },
    });

    routeSourceRef.current = true;
  }, [mapReady]);

  // When GPS position arrives, update destination
  useEffect(() => {
    if (!map.current || !position || !mapReady) return;

    const destLng = position.longitude;
    const destLat = position.latitude;

    destMarkerRef.current?.setLngLat([destLng, destLat]);
    drawRoute(destLng, destLat);

    // Fit map to show both markers
    const bounds = new maplibregl.LngLatBounds();
    bounds.extend(SHOP_LOCATION);
    bounds.extend([destLng, destLat]);
    map.current.fitBounds(bounds, { padding: 60, duration: 1000 });

    // Reverse geocode (approximate address from coordinates)
    setGpsAddress(`Lat: ${destLat.toFixed(4)}, Lng: ${destLng.toFixed(4)}`);
  }, [position, mapReady, drawRoute]);

  const handleConfirmGPS = () => {
    if (!position) return;
    const addr = gpsAddress || `Near your current location (${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)})`;
    setConfirmed(true);
    onAddressConfirm(addr, position.latitude, position.longitude);
  };

  const handleConfirmManual = () => {
    if (!manualAddress.trim()) return;
    const fullAddr = `${manualAddress}${manualLandmark ? ', ' + manualLandmark : ''}`;
    // Use shop location as default for manual (no GPS for manual entry)
    setConfirmed(true);
    onAddressConfirm(fullAddr, SHOP_LOCATION[1], SHOP_LOCATION[0]);
  };

  if (confirmed) return null; // Hide after confirmation

  return (
    <div className="delivery-address-section">
      <h3 className="da-title">📍 Delivery Address</h3>

      {mode === 'choose' && (
        <div className="da-choose">
          <button className="da-option" onClick={() => setMode('gps')}>
            <span className="da-option-icon">📍</span>
            <div className="da-option-info">
              <span className="da-option-title">Use Current Location</span>
              <span className="da-option-desc">Auto-detect via GPS</span>
            </div>
            <span className="da-option-arrow">›</span>
          </button>
          <button className="da-option" onClick={() => setMode('manual')}>
            <span className="da-option-icon">✏️</span>
            <div className="da-option-info">
              <span className="da-option-title">Add New Address</span>
              <span className="da-option-desc">Enter address manually</span>
            </div>
            <span className="da-option-arrow">›</span>
          </button>
        </div>
      )}

      {mode === 'gps' && (
        <div className="da-gps">
          <div ref={mapContainer} className="da-map" />
          <div className="da-map-legend">
            <span><span className="otm-legend-dot shop" /> Shop</span>
            <span><span className="otm-legend-dot user" /> Your Location</span>
          </div>
          {gpsError && <p className="da-error">⚠️ {gpsError}</p>}
          {position && <p className="da-gps-address">📍 {gpsAddress}</p>}
          <div className="da-actions">
            <button className="da-btn back" onClick={() => setMode('choose')}>← Back</button>
            <button className="da-btn confirm" onClick={handleConfirmGPS} disabled={!position}>
              ✓ Confirm Location
            </button>
          </div>
        </div>
      )}

      {mode === 'manual' && (
        <div className="da-manual">
          <div className="da-field">
            <label>Address *</label>
            <textarea
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              placeholder="House No, Street, Area, City"
              rows={3}
            />
          </div>
          <div className="da-field">
            <label>Landmark (optional)</label>
            <input
              type="text"
              value={manualLandmark}
              onChange={(e) => setManualLandmark(e.target.value)}
              placeholder="Near temple, opposite park..."
            />
          </div>
          <div className="da-actions">
            <button className="da-btn back" onClick={() => setMode('choose')}>← Back</button>
            <button className="da-btn confirm" onClick={handleConfirmManual} disabled={!manualAddress.trim()}>
              ✓ Save Address
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
