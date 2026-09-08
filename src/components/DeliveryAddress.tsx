import { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useGPS } from '../hooks/useGPS';

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/bright';
const SHOP_LOCATION: [number, number] = [80.170, 13.054]; // Jeeva Complex, Alapakkam, Maduravoyal

interface DeliveryAddressProps {
  onAddressConfirm: (address: string, lat: number, lng: number) => void;
}

// Reverse geocode using Nominatim (free, no API key)
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    if (data && data.address) {
      const a = data.address;
      const parts = [
        a.house_number,
        a.road || a.street,
        a.suburb || a.neighbourhood || a.area,
        a.city || a.town || a.village,
        a.state,
        a.postcode,
      ].filter(Boolean);
      return parts.join(', ');
    }
    return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

export function DeliveryAddress({ onAddressConfirm }: DeliveryAddressProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const shopMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const mapInitialized = useRef(false);

  const [showMap, setShowMap] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [manualLandmark, setManualLandmark] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedAddress, setConfirmedAddress] = useState('');
  const [gpsError, setGpsError] = useState('');

  const { position, error: rawGpsError, startTracking, stopTracking } = useGPS({
    enableHighAccuracy: true,
    maximumAge: 2000,
    timeout: 15000,
    watchPosition: true,
  });

  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, []);

  // Set GPS error
  useEffect(() => {
    if (rawGpsError) setGpsError(rawGpsError);
  }, [rawGpsError]);

  // Reverse geocode when GPS position changes
  useEffect(() => {
    if (!position) return;
    reverseGeocode(position.latitude, position.longitude).then((addr) => {
      setResolvedAddress(addr);
    });
  }, [position]);

  // Initialize map when "Use Current Location" is clicked
  const handleShowMap = useCallback(() => {
    setShowMap(true);
    setShowManual(false);
  }, []);

  // Init map AFTER showMap becomes true and DOM renders
  useEffect(() => {
    if (!showMap || !mapDivRef.current || mapInitialized.current) return;

    // Small delay to ensure container is in DOM and has dimensions
    const timer = setTimeout(() => {
      if (!mapDivRef.current || mapInitialized.current) return;

      const m = new maplibregl.Map({
        container: mapDivRef.current,
        style: OPENFREEMAP_STYLE,
        center: SHOP_LOCATION,
        zoom: 14,
        attributionControl: false,
      });

      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

      // Add shop marker on load
      m.on('load', () => {
        const shopEl = document.createElement('div');
        shopEl.className = 'shop-marker';
        shopEl.innerHTML = '<div class="shop-marker-pin">🏪</div>';
        shopMarkerRef.current = new maplibregl.Marker({ element: shopEl, anchor: 'center' })
          .setLngLat(SHOP_LOCATION)
          .addTo(m);

        // User marker
        const userEl = document.createElement('div');
        userEl.className = 'gps-user-marker';
        userEl.innerHTML = '<div class="gps-marker-pulse"></div><div class="gps-marker-dot"></div>';
        userMarkerRef.current = new maplibregl.Marker({ element: userEl, anchor: 'center' })
          .setLngLat(SHOP_LOCATION)
          .addTo(m);
      });

      mapRef.current = m;
      mapInitialized.current = true;
    }, 200);

    return () => clearTimeout(timer);
  }, [showMap]);

  // Update user marker & route when GPS position changes
  useEffect(() => {
    if (!mapRef.current || !position) return;

    const lngLat: [number, number] = [position.longitude, position.latitude];

    // Update user marker
    userMarkerRef.current?.setLngLat(lngLat);

    // Draw route
    try {
      const m = mapRef.current;
      if (m.getLayer('route-line')) m.removeLayer('route-line');
      if (m.getSource('route')) m.removeSource('route');

      m.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [SHOP_LOCATION, lngLat] },
          properties: {},
        },
      });

      m.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#2563eb', 'line-width': 3, 'line-dasharray': [2, 1] },
      });
    } catch { /* ignore */ }

    // Fit both markers
    const bounds = new maplibregl.LngLatBounds();
    bounds.extend(SHOP_LOCATION);
    bounds.extend(lngLat);
    mapRef.current.fitBounds(bounds, { padding: 50, duration: 1000 });
  }, [position]);

  // Cleanup map
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        mapInitialized.current = false;
      }
    };
  }, []);

  // Confirm GPS
  const handleConfirmGPS = () => {
    if (!position) return;
    const addr = resolvedAddress || `${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`;
    setConfirmedAddress(addr);
    setConfirmed(true);
    setShowMap(false);
    onAddressConfirm(addr, position.latitude, position.longitude);
  };

  // Confirm Manual
  const handleConfirmManual = () => {
    if (!manualAddress.trim()) return;
    const full = `${manualAddress}${manualLandmark ? ', ' + manualLandmark : ''}`;
    setConfirmedAddress(full);
    setConfirmed(true);
    setShowManual(false);
    onAddressConfirm(full, SHOP_LOCATION[1], SHOP_LOCATION[0]);
  };

  // Reset to change address
  const handleChangeAddress = () => {
    setConfirmed(false);
    setShowMap(false);
    setShowManual(false);
  };

  // ─── CONFIRMED STATE ────────────────────────────────────────
  if (confirmed) {
    return (
      <div className="delivery-address-section">
        <div className="da-input-row confirmed">
          <span className="da-input-icon">📍</span>
          <div className="da-confirmed-text">
            <span className="da-confirmed-label">Delivering to</span>
            <span className="da-confirmed-value">{confirmedAddress}</span>
          </div>
          <button className="da-edit-btn" onClick={handleChangeAddress}>✏️</button>
        </div>
      </div>
    );
  }

  // ─── INITIAL STATE: input + choose ──────────────────────────
  return (
    <div className="delivery-address-section">
      <h3 className="da-title">📍 Delivery Address</h3>

      {!showMap && !showManual && (
        <>
          <div className="da-input-row" onClick={handleShowMap} style={{ cursor: 'pointer' }}>
            <span className="da-input-icon">📍</span>
            <input className="da-input-field" readOnly placeholder="Enter your address" />
            <button className="da-edit-btn" onClick={(e) => { e.stopPropagation(); handleShowMap(); }}>✏️</button>
          </div>

          <div className="da-expand-panel">
            <button className="da-option" onClick={handleShowMap}>
              <span className="da-option-icon">📍</span>
              <div className="da-option-info">
                <span className="da-option-title">Use Current Location</span>
                <span className="da-option-desc">Auto-detect via GPS</span>
              </div>
              <span className="da-option-arrow">›</span>
            </button>
            <button className="da-option" onClick={() => { setShowManual(true); setShowMap(false); }}>
              <span className="da-option-icon">✏️</span>
              <div className="da-option-info">
                <span className="da-option-title">Add New Address</span>
                <span className="da-option-desc">Enter address manually</span>
              </div>
              <span className="da-option-arrow">›</span>
            </button>
          </div>
        </>
      )}

      {/* ─── GPS MAP VIEW ──────────────────────────────────── */}
      {showMap && (
        <div className="da-expand-panel">
          <div ref={mapDivRef} className="da-map" />
          <div className="da-map-legend">
            <span><span className="otm-legend-dot shop" /> Shop (Jeeva Complex)</span>
            <span><span className="otm-legend-dot user" /> Your Location</span>
          </div>

          {gpsError && <p className="da-error">⚠️ {gpsError}</p>}

          {/* Full address display */}
          {position ? (
            <div className="da-address-display">
              <span className="da-address-from">🏪 Jeeva Complex, Alapakkam, Maduravoyal</span>
              <span className="da-address-arrow">↓</span>
              <span className="da-address-to">📍 {resolvedAddress || 'Getting address...'}</span>
            </div>
          ) : (
            <div className="da-address-display">
              <span className="da-address-waiting">📍 Waiting for GPS signal...</span>
            </div>
          )}

          <div className="da-actions">
            <button className="da-btn back" onClick={() => { setShowMap(false); }}>← Back</button>
            <button className="da-btn confirm" onClick={handleConfirmGPS} disabled={!position}>
              ✓ Confirm Location
            </button>
          </div>
        </div>
      )}

      {/* ─── MANUAL ADDRESS FORM ──────────────────────────── */}
      {showManual && (
        <div className="da-expand-panel">
          <div className="da-field">
            <label>House No, Street, Area *</label>
            <textarea
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              placeholder="e.g. 12, Gandhi Street, Anna Nagar"
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
            <button className="da-btn back" onClick={() => setShowManual(false)}>← Back</button>
            <button className="da-btn confirm" onClick={handleConfirmManual} disabled={!manualAddress.trim()}>
              ✓ Save Address
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
