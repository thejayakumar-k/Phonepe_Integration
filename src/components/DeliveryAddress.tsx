import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useGPS } from '../hooks/useGPS';

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/bright';
const SHOP_LOCATION: [number, number] = [80.170, 13.054];

interface DeliveryAddressProps {
  onAddressConfirm: (address: string, lat: number, lng: number) => void;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    if (data?.address) {
      const a = data.address;
      return [a.house_number, a.road, a.suburb || a.neighbourhood, a.city || a.town, a.state, a.postcode]
        .filter(Boolean).join(', ');
    }
    return data.display_name || '';
  } catch {
    return '';
  }
}

type Page = 'home' | 'gps' | 'manual';

export function DeliveryAddress({ onAddressConfirm }: DeliveryAddressProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const shopMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const mapInitDone = useRef(false);

  const [page, setPage] = useState<Page>('home');
  const [savedAddress, setSavedAddress] = useState('');

  // GPS state
  const [gpsAddress, setGpsAddress] = useState('');
  const [gpsEditable, setGpsEditable] = useState('');
  const [gpsLat, setGpsLat] = useState(0);
  const [gpsLng, setGpsLng] = useState(0);

  // Manual state — separate fields
  const [houseNo, setHouseNo] = useState('');
  const [street, setStreet] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [landmark, setLandmark] = useState('');

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

  // ─── MAP INIT (GPS page only) ────────────────────────────
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
    }, 300);

    return () => clearTimeout(timer);
  }, [page === 'gps']);

  // ─── GPS → MAP + GEOCODE ─────────────────────────────────
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

    setGpsLat(position.latitude);
    setGpsLng(position.longitude);
    reverseGeocode(position.latitude, position.longitude).then((addr) => {
      setGpsAddress(addr);
      setGpsEditable(addr);
    });
  }, [position]);

  // Cleanup map
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      mapInitDone.current = false;
    };
  }, []);

  const cleanupMap = () => {
    mapRef.current?.remove();
    mapRef.current = null;
    mapInitDone.current = false;
  };

  // ─── SAVE GPS ────────────────────────────────────────────
  const handleSaveGPS = () => {
    const addr = gpsEditable.trim() || gpsAddress || `${gpsLat.toFixed(4)}, ${gpsLng.toFixed(4)}`;
    setSavedAddress(addr);
    setPage('home');
    onAddressConfirm(addr, gpsLat, gpsLng);
    cleanupMap();
  };

  // ─── SAVE MANUAL ─────────────────────────────────────────
  const handleSaveManual = () => {
    const parts = [houseNo, street, area, city, pincode].filter(Boolean);
    if (parts.length === 0) return;
    const addr = parts.join(', ') + (landmark ? `, Near ${landmark}` : '');
    setSavedAddress(addr);
    setPage('home');
    onAddressConfirm(addr, SHOP_LOCATION[1], SHOP_LOCATION[0]);
  };

  const handleBack = () => {
    cleanupMap();
    setPage('home');
  };

  // ─── HOME (cart inline) ──────────────────────────────────
  if (page === 'home') {
    return (
      <div className="delivery-address-section">
        {savedAddress ? (
          <div className="da-saved-card">
            <div className="da-saved-info">
              <span className="da-saved-label">📍 Delivering to</span>
              <span className="da-saved-value">{savedAddress}</span>
            </div>
            <button className="da-edit-btn" onClick={() => { setSavedAddress(''); setPage('home'); }}>✏️</button>
          </div>
        ) : (
          <>
            <h3 className="da-title">📍 Delivery Address</h3>
            <div className="da-home-options">
              <button className="da-home-btn" onClick={() => setPage('gps')}>
                <span className="da-home-btn-icon">📍</span>
                <div className="da-home-btn-text">
                  <span className="da-home-btn-title">Use Current Location</span>
                  <span className="da-home-btn-desc">Auto-detect via GPS</span>
                </div>
              </button>
              <button className="da-home-btn" onClick={() => setPage('manual')}>
                <span className="da-home-btn-icon">🏠</span>
                <div className="da-home-btn-text">
                  <span className="da-home-btn-title">Add New Address</span>
                  <span className="da-home-btn-desc">Enter address manually</span>
                </div>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ─── GPS FULL-SCREEN PAGE ────────────────────────────────
  if (page === 'gps') {
    return (
      <div className="da-fullpage">
        <div className="da-fp-header">
          <button className="da-fp-back" onClick={handleBack}>←</button>
          <h3>Current Location</h3>
          <span />
        </div>
        <div className="da-fp-body">
          <div ref={mapDivRef} className="da-fp-map" />

          <div className="da-fp-legend">
            <span><span className="otm-legend-dot shop" /> Shop</span>
            <span><span className="otm-legend-dot user" /> You</span>
          </div>

          {gpsError && <p className="da-error">⚠️ {gpsError}</p>}

          {position ? (
            <div className="da-fp-address-from">
              🏪 Jeeva Complex, Alapakkam, Maduravoyal
            </div>
          ) : (
            <div className="da-fp-address-from waiting">📍 Waiting for GPS...</div>
          )}

          {gpsAddress && (
            <div className="da-fp-edit-box">
              <label>✏️ Edit address if GPS is inaccurate:</label>
              <textarea
                value={gpsEditable}
                onChange={(e) => setGpsEditable(e.target.value)}
                rows={3}
              />
            </div>
          )}
        </div>
        <div className="da-fp-footer">
          <button className="da-fp-save" onClick={handleSaveGPS} disabled={!position}>
            ✓ Save Address
          </button>
        </div>
      </div>
    );
  }

  // ─── MANUAL FULL-SCREEN PAGE ─────────────────────────────
  return (
    <div className="da-fullpage">
      <div className="da-fp-header">
        <button className="da-fp-back" onClick={() => setPage('home')}>←</button>
        <h3>Add New Address</h3>
        <span />
      </div>
      <div className="da-fp-body">
        <div className="da-fp-fields">
          <div className="da-fp-field">
            <label>House / Flat No *</label>
            <input type="text" value={houseNo} onChange={(e) => setHouseNo(e.target.value)} placeholder="e.g. 12" />
          </div>
          <div className="da-fp-field">
            <label>Street / Road *</label>
            <input type="text" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="e.g. Gandhi Street" />
          </div>
          <div className="da-fp-field">
            <label>Area / Locality *</label>
            <input type="text" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Anna Nagar" />
          </div>
          <div className="da-fp-field">
            <label>City *</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Chennai" />
          </div>
          <div className="da-fp-field">
            <label>Pincode *</label>
            <input type="text" value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="e.g. 600095" />
          </div>
          <div className="da-fp-field">
            <label>Landmark (optional)</label>
            <input type="text" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Near temple, opposite park..." />
          </div>
        </div>
      </div>
      <div className="da-fp-footer">
        <button
          className="da-fp-save"
          onClick={handleSaveManual}
          disabled={!houseNo.trim() && !street.trim() && !area.trim()}
        >
          ✓ Save Address
        </button>
      </div>
    </div>
  );
}
