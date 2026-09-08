import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useGPS } from '../hooks/useGPS';

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/bright';
const SHOP_LOCATION: [number, number] = [80.170, 13.054];

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
      return [a.house_number, a.road || a.street, a.suburb || a.neighbourhood, a.city || a.town, a.state, a.postcode]
        .filter(Boolean).join(', ');
    }
    return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

type Page = 'summary' | 'choose' | 'gps' | 'manual';

export function DeliveryAddress({ onAddressConfirm }: DeliveryAddressProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const shopMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const mapInitDone = useRef(false);

  const [page, setPage] = useState<Page>('summary');
  const [savedAddress, setSavedAddress] = useState('');


  // GPS page state
  const [gpsAddress, setGpsAddress] = useState('');
  const [gpsEditable, setGpsEditable] = useState('');
  const [gpsLat, setGpsLat] = useState(0);
  const [gpsLng, setGpsLng] = useState(0);

  // Manual page state
  const [manualAddress, setManualAddress] = useState('');
  const [manualLandmark, setManualLandmark] = useState('');

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

  // ─── MAP INIT ─────────────────────────────────────────────
  useEffect(() => {
    if (page !== 'gps' || !mapDivRef.current || mapInitDone.current) return;

    const timer = setTimeout(() => {
      if (!mapDivRef.current || mapInitDone.current) return;

      const m = new maplibregl.Map({
        container: mapDivRef.current,
        style: OPENFREEMAP_STYLE,
        center: SHOP_LOCATION,
        zoom: 14,
        attributionControl: false,
      });
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

      m.on('load', () => {
        const shopEl = document.createElement('div');
        shopEl.className = 'shop-marker';
        shopEl.innerHTML = '<div class="shop-marker-pin">🏪</div>';
        shopMarkerRef.current = new maplibregl.Marker({ element: shopEl, anchor: 'center' })
          .setLngLat(SHOP_LOCATION).addTo(m);

        const userEl = document.createElement('div');
        userEl.className = 'gps-user-marker';
        userEl.innerHTML = '<div class="gps-marker-pulse"></div><div class="gps-marker-dot"></div>';
        userMarkerRef.current = new maplibregl.Marker({ element: userEl, anchor: 'center' })
          .setLngLat(SHOP_LOCATION).addTo(m);
      });

      mapRef.current = m;
      mapInitDone.current = true;
    }, 250);

    return () => clearTimeout(timer);
  }, [page === 'gps']);

  // ─── GPS POSITION → MAP + REVERSE GEOCODE ────────────────
  useEffect(() => {
    if (!mapRef.current || !position) return;
    const lngLat: [number, number] = [position.longitude, position.latitude];

    userMarkerRef.current?.setLngLat(lngLat);

    try {
      const m = mapRef.current;
      if (m.getLayer('route-line')) m.removeLayer('route-line');
      if (m.getSource('route')) m.removeSource('route');
      m.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [SHOP_LOCATION, lngLat] }, properties: {} },
      });
      m.addLayer({
        id: 'route-line', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#2563eb', 'line-width': 3, 'line-dasharray': [2, 1] },
      });
    } catch { /* ignore */ }

    const bounds = new maplibregl.LngLatBounds();
    bounds.extend(SHOP_LOCATION);
    bounds.extend(lngLat);
    mapRef.current.fitBounds(bounds, { padding: 50, duration: 1000 });

    // Reverse geocode
    setGpsLat(position.latitude);
    setGpsLng(position.longitude);
    reverseGeocode(position.latitude, position.longitude).then((addr) => {
      setGpsAddress(addr);
      setGpsEditable(addr); // pre-fill editable field
    });
  }, [position]);

  // Cleanup
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      mapInitDone.current = false;
    };
  }, []);

  // ─── HANDLERS ─────────────────────────────────────────────
  const handleEditClick = () => setPage('choose');

  const handleSelectGPS = () => {
    setPage('gps');
  };

  const handleSelectManual = () => {
    setPage('manual');
  };

  // Save from GPS page (after editing)
  const handleSaveGPS = () => {
    const addr = gpsEditable.trim() || gpsAddress || `${gpsLat.toFixed(4)}, ${gpsLng.toFixed(4)}`;
    setSavedAddress(addr);
    setPage('summary');
    onAddressConfirm(addr, gpsLat, gpsLng);
    // Cleanup map
    mapRef.current?.remove();
    mapRef.current = null;
    mapInitDone.current = false;
  };

  // Save from manual page
  const handleSaveManual = () => {
    if (!manualAddress.trim()) return;
    const full = `${manualAddress}${manualLandmark ? ', ' + manualLandmark : ''}`;
    setSavedAddress(full);
    setPage('summary');
    onAddressConfirm(full, SHOP_LOCATION[1], SHOP_LOCATION[0]);
  };

  const handleBack = () => {
    mapRef.current?.remove();
    mapRef.current = null;
    mapInitDone.current = false;
    setPage('choose');
  };

  // ─── SUMMARY PAGE (main view) ────────────────────────────
  if (page === 'summary') {
    return (
      <div className="delivery-address-section">
        <div className="da-input-row" style={{ cursor: 'pointer' }} onClick={handleEditClick}>
          <span className="da-input-icon">📍</span>
          {savedAddress ? (
            <div className="da-confirmed-text">
              <span className="da-confirmed-label">Delivering to</span>
              <span className="da-confirmed-value">{savedAddress}</span>
            </div>
          ) : (
            <input className="da-input-field" readOnly placeholder="Enter your address" />
          )}
          <button className="da-edit-btn" onClick={(e) => { e.stopPropagation(); handleEditClick(); }}>✏️</button>
        </div>
      </div>
    );
  }

  // ─── CHOOSE PAGE ──────────────────────────────────────────
  if (page === 'choose') {
    return (
      <div className="da-page-overlay">
        <div className="da-page">
          <div className="da-page-header">
            <button className="da-page-back" onClick={() => setPage('summary')}>←</button>
            <h3>Choose Address</h3>
            <span />
          </div>
          <div className="da-page-body">
            <button className="da-page-option" onClick={handleSelectGPS}>
              <span className="da-page-option-icon">📍</span>
              <div className="da-page-option-info">
                <span className="da-page-option-title">Use Current Location</span>
                <span className="da-page-option-desc">Auto-detect your location via GPS</span>
              </div>
              <span className="da-page-option-arrow">›</span>
            </button>
            <button className="da-page-option" onClick={handleSelectManual}>
              <span className="da-page-option-icon">✏️</span>
              <div className="da-page-option-info">
                <span className="da-page-option-title">Add New Address</span>
                <span className="da-page-option-desc">Enter address manually</span>
              </div>
              <span className="da-page-option-arrow">›</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── GPS PAGE ─────────────────────────────────────────────
  if (page === 'gps') {
    return (
      <div className="da-page-overlay">
        <div className="da-page">
          <div className="da-page-header">
            <button className="da-page-back" onClick={handleBack}>←</button>
            <h3>Current Location</h3>
            <span />
          </div>
          <div className="da-page-body">
            <div ref={mapDivRef} className="da-map" />

            <div className="da-map-legend">
              <span><span className="otm-legend-dot shop" /> Shop (Jeeva Complex)</span>
              <span><span className="otm-legend-dot user" /> Your Location</span>
            </div>

            {gpsError && <p className="da-error">⚠️ {gpsError}</p>}

            {position ? (
              <div className="da-address-display">
                <span className="da-address-from">🏪 Jeeva Complex, Alapakkam, Maduravoyal</span>
                <span className="da-address-arrow">↓</span>
                <span className="da-address-to">📍 {gpsAddress || 'Getting address...'}</span>
              </div>
            ) : (
              <div className="da-address-display">
                <span className="da-address-waiting">📍 Waiting for GPS signal...</span>
              </div>
            )}

            {/* Editable address field */}
            {gpsAddress && (
              <div className="da-edit-section">
                <label className="da-edit-label">✏️ Edit address if incorrect:</label>
                <textarea
                  className="da-edit-textarea"
                  value={gpsEditable}
                  onChange={(e) => setGpsEditable(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            <div className="da-page-footer">
              <button className="da-btn confirm full" onClick={handleSaveGPS} disabled={!position}>
                ✓ Save Address
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── MANUAL PAGE ──────────────────────────────────────────
  return (
    <div className="da-page-overlay">
      <div className="da-page">
        <div className="da-page-header">
          <button className="da-page-back" onClick={() => setPage('choose')}>←</button>
          <h3>Add New Address</h3>
          <span />
        </div>
        <div className="da-page-body">
          <div className="da-manual-form">
            <div className="da-field">
              <label>House No, Street, Area *</label>
              <textarea
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="e.g. 12, Gandhi Street, Anna Nagar"
                rows={4}
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
          </div>

          <div className="da-page-footer">
            <button className="da-btn confirm full" onClick={handleSaveManual} disabled={!manualAddress.trim()}>
              ✓ Save Address
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
