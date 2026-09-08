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

type AddressMode = 'input' | 'options' | 'gps' | 'manual';

export function DeliveryAddress({ onAddressConfirm }: DeliveryAddressProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const shopMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [mode, setMode] = useState<AddressMode>('input');
  const [inputValue, setInputValue] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualLandmark, setManualLandmark] = useState('');
  const [gpsAddress, setGpsAddress] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [expanded, setExpanded] = useState(false);

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

  const createShopEl = useCallback(() => {
    const el = document.createElement('div');
    el.className = 'shop-marker';
    el.innerHTML = '<div class="shop-marker-pin">🏪</div>';
    return el;
  }, []);

  const createDestEl = useCallback(() => {
    const el = document.createElement('div');
    el.className = 'gps-user-marker';
    el.innerHTML = '<div class="gps-marker-pulse"></div><div class="gps-marker-dot"></div>';
    return el;
  }, []);

  // Initialize map when GPS mode is selected
  useEffect(() => {
    if (mode !== 'gps' || !mapContainer.current || map.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: OPENFREEMAP_STYLE,
      center: SHOP_LOCATION,
      zoom: 14,
      attributionControl: false,
    });

    mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    mapInstance.on('load', () => {
      shopMarkerRef.current = new maplibregl.Marker({ element: createShopEl(), anchor: 'center' })
        .setLngLat(SHOP_LOCATION)
        .addTo(mapInstance);

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
      setMapReady(false);
    };
  }, [mode === 'gps']);

  // Draw route
  const drawRoute = useCallback((destLng: number, destLat: number) => {
    if (!map.current || !mapReady) return;
    if (map.current.getLayer('route-line')) map.current.removeLayer('route-line');
    if (map.current.getSource('route')) map.current.removeSource('route');

    map.current.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [SHOP_LOCATION, [destLng, destLat]] },
        properties: {},
      },
    });

    map.current.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#2563eb', 'line-width': 3, 'line-dasharray': [2, 1] },
    });
  }, [mapReady]);

  // Update GPS on map
  useEffect(() => {
    if (!map.current || !position || !mapReady) return;
    const lngLat: [number, number] = [position.longitude, position.latitude];
    destMarkerRef.current?.setLngLat(lngLat);
    drawRoute(position.longitude, position.latitude);

    const bounds = new maplibregl.LngLatBounds();
    bounds.extend(SHOP_LOCATION);
    bounds.extend(lngLat);
    map.current.fitBounds(bounds, { padding: 60, duration: 1000 });

    setGpsAddress(`Lat: ${position.latitude.toFixed(4)}, Lng: ${position.longitude.toFixed(4)}`);
  }, [position, mapReady, drawRoute]);

  const handleEditClick = () => {
    setExpanded(true);
    setMode('options');
  };

  const handleSelectGPS = () => {
    setMode('gps');
  };

  const handleSelectManual = () => {
    setMode('manual');
  };

  const handleConfirmGPS = () => {
    if (!position) return;
    const addr = gpsAddress || `Current Location (${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)})`;
    setInputValue(addr);
    setConfirmed(true);
    setExpanded(false);
    setMode('input');
    onAddressConfirm(addr, position.latitude, position.longitude);
  };

  const handleConfirmManual = () => {
    if (!manualAddress.trim()) return;
    const fullAddr = `${manualAddress}${manualLandmark ? ', ' + manualLandmark : ''}`;
    setInputValue(fullAddr);
    setConfirmed(true);
    setExpanded(false);
    setMode('input');
    onAddressConfirm(fullAddr, SHOP_LOCATION[1], SHOP_LOCATION[0]);
  };

  const handleBack = () => {
    setMode('options');
  };

  if (confirmed) {
    return (
      <div className="delivery-address-section">
        <div className="da-input-row">
          <span className="da-input-icon">📍</span>
          <input
            className="da-input-field"
            value={inputValue}
            readOnly
            placeholder="Enter your address"
          />
          <button className="da-edit-btn" onClick={() => { setConfirmed(false); setExpanded(true); setMode('options'); }}>
            ✏️
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="delivery-address-section">
      <h3 className="da-title">📍 Delivery Address</h3>

      {/* Input field row with edit icon */}
      <div className="da-input-row">
        <span className="da-input-icon">📍</span>
        <input
          className="da-input-field"
          value={inputValue}
          readOnly
          placeholder="Enter your address"
          onClick={handleEditClick}
        />
        <button className="da-edit-btn" onClick={handleEditClick}>✏️</button>
      </div>

      {/* Expanded options panel */}
      {expanded && mode === 'options' && (
        <div className="da-expand-panel">
          <button className="da-option" onClick={handleSelectGPS}>
            <span className="da-option-icon">📍</span>
            <div className="da-option-info">
              <span className="da-option-title">Use Current Location</span>
              <span className="da-option-desc">Auto-detect via GPS</span>
            </div>
            <span className="da-option-arrow">›</span>
          </button>
          <button className="da-option" onClick={handleSelectManual}>
            <span className="da-option-icon">✏️</span>
            <div className="da-option-info">
              <span className="da-option-title">Add New Address</span>
              <span className="da-option-desc">Enter address manually</span>
            </div>
            <span className="da-option-arrow">›</span>
          </button>
        </div>
      )}

      {/* GPS Map view */}
      {expanded && mode === 'gps' && (
        <div className="da-expand-panel">
          <div ref={mapContainer} className="da-map" />
          <div className="da-map-legend">
            <span><span className="otm-legend-dot shop" /> Shop</span>
            <span><span className="otm-legend-dot user" /> Your Location</span>
          </div>
          {gpsError && <p className="da-error">⚠️ {gpsError}</p>}
          {position && <p className="da-gps-address">📍 {gpsAddress}</p>}
          <div className="da-actions">
            <button className="da-btn back" onClick={handleBack}>← Back</button>
            <button className="da-btn confirm" onClick={handleConfirmGPS} disabled={!position}>
              ✓ Confirm Location
            </button>
          </div>
        </div>
      )}

      {/* Manual address form */}
      {expanded && mode === 'manual' && (
        <div className="da-expand-panel">
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
            <button className="da-btn back" onClick={handleBack}>← Back</button>
            <button className="da-btn confirm" onClick={handleConfirmManual} disabled={!manualAddress.trim()}>
              ✓ Save Address
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
