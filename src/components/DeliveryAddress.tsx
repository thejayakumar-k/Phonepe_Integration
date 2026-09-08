import { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useGPS } from '../hooks/useGPS';

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/bright';

// VVK WATER SUPPLY - Shop location
const SHOP_LOCATION: [number, number] = [80.170, 13.054]; // [lng, lat]

interface DeliveryAddressProps {
  onAddressConfirm: (address: string, lat: number, lng: number) => void;
}

type AddressMode = 'input' | 'options' | 'gps' | 'manual';

export function DeliveryAddress({ onAddressConfirm }: DeliveryAddressProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const shopMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const mapInitRef = useRef(false);

  const [mode, setMode] = useState<AddressMode>('input');
  const [inputValue, setInputValue] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualLandmark, setManualLandmark] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
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

  // Create markers
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

  // Clean up map
  const cleanupMap = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      shopMarkerRef.current = null;
      destMarkerRef.current = null;
      mapInitRef.current = false;
    }
  }, []);

  // Initialize map when entering GPS mode - use requestAnimationFrame to ensure DOM is ready
  const initMap = useCallback(() => {
    if (mapInitRef.current || !mapContainer.current) return;

    setMapLoading(true);
    mapInitRef.current = true;

    const container = mapContainer.current;

    // Use requestAnimationFrame to ensure container has dimensions
    requestAnimationFrame(() => {
      if (!container || mapInstanceRef.current) {
        setMapLoading(false);
        return;
      }

      const mapInstance = new maplibregl.Map({
        container,
        style: OPENFREEMAP_STYLE,
        center: SHOP_LOCATION,
        zoom: 14,
        attributionControl: false,
      });

      mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

      mapInstance.on('load', () => {
        // Add shop marker
        shopMarkerRef.current = new maplibregl.Marker({
          element: createShopEl(),
          anchor: 'center',
        })
          .setLngLat(SHOP_LOCATION)
          .addTo(mapInstance);

        // Add destination marker at shop location
        destMarkerRef.current = new maplibregl.Marker({
          element: createDestEl(),
          anchor: 'center',
        })
          .setLngLat(SHOP_LOCATION)
          .addTo(mapInstance);

        setMapLoading(false);

        // If GPS is already available, update map immediately
        if (position) {
          const lngLat: [number, number] = [position.longitude, position.latitude];
          destMarkerRef.current.setLngLat(lngLat);
          mapInstance.flyTo({ center: lngLat, zoom: 15, duration: 1500 });
        }
      });

      // Handle errors
      mapInstance.on('error', (e) => {
        console.error('Map error:', e);
        setMapLoading(false);
      });

      mapInstanceRef.current = mapInstance;
    });
  }, [createShopEl, createDestEl, position]);

  // When GPS position arrives, update map
  useEffect(() => {
    if (!mapInstanceRef.current || !position) return;

    const lngLat: [number, number] = [position.longitude, position.latitude];

    // Update destination marker
    destMarkerRef.current?.setLngLat(lngLat);

    // Draw route line
    const mapInst = mapInstanceRef.current;
    try {
      if (mapInst.getLayer('route-line')) mapInst.removeLayer('route-line');
      if (mapInst.getSource('route')) mapInst.removeSource('route');

      mapInst.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [SHOP_LOCATION, lngLat] },
          properties: {},
        },
      });

      mapInst.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#2563eb', 'line-width': 3, 'line-dasharray': [2, 1] },
      });
    } catch {
      // ignore if layer already exists
    }

    // Fit bounds to show both markers
    const bounds = new maplibregl.LngLatBounds();
    bounds.extend(SHOP_LOCATION);
    bounds.extend(lngLat);
    mapInst.fitBounds(bounds, { padding: 50, duration: 1000 });
  }, [position]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupMap();
  }, [cleanupMap]);

  const handleEditClick = () => {
    setExpanded(true);
    setMode('options');
  };

  const handleSelectGPS = () => {
    setMode('gps');
    // Init map after render
    setTimeout(() => initMap(), 100);
  };

  const handleSelectManual = () => {
    setMode('manual');
  };

  const handleConfirmGPS = () => {
    if (!position) return;
    const addr = `Jeeva Complex, Alapakkam, Maduravoyal → Your Location (${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)})`;
    setInputValue(addr);
    setConfirmed(true);
    setExpanded(false);
    setMode('input');
    cleanupMap();
    onAddressConfirm(addr, position.latitude, position.longitude);
  };

  const handleConfirmManual = () => {
    if (!manualAddress.trim()) return;
    const fullAddr = `${manualAddress}${manualLandmark ? ', ' + manualLandmark : ''}`;
    setInputValue(fullAddr);
    setConfirmed(true);
    setExpanded(false);
    setMode('input');
    cleanupMap();
    onAddressConfirm(fullAddr, SHOP_LOCATION[1], SHOP_LOCATION[0]);
  };

  const handleBack = () => {
    cleanupMap();
    setMode('options');
  };

  // Confirmed state - show input with address
  if (confirmed) {
    return (
      <div className="delivery-address-section">
        <div className="da-input-row confirmed">
          <span className="da-input-icon">📍</span>
          <div className="da-confirmed-text">
            <span className="da-confirmed-label">Delivering to</span>
            <span className="da-confirmed-value">{inputValue}</span>
          </div>
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
          {mapLoading && <div className="da-map-loading">Loading map...</div>}
          <div
            ref={mapContainer}
            className="da-map"
            style={{ display: mapLoading ? 'none' : 'block' }}
          />
          <div className="da-map-legend">
            <span><span className="otm-legend-dot shop" /> Shop (Jeeva Complex)</span>
            <span><span className="otm-legend-dot user" /> Your Location</span>
          </div>
          {gpsError && <p className="da-error">⚠️ {gpsError}</p>}
          {position && (
            <div className="da-address-display">
              <span className="da-address-from">🏪 Jeeva Complex, Alapakkam, Maduravoyal</span>
              <span className="da-address-arrow">↓</span>
              <span className="da-address-to">📍 Your Location ({position.latitude.toFixed(4)}, {position.longitude.toFixed(4)})</span>
            </div>
          )}
          {!position && !gpsError && (
            <div className="da-address-display">
              <span className="da-address-waiting">📍 Waiting for GPS signal...</span>
            </div>
          )}
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
