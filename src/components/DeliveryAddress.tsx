import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useGPS } from '../hooks/useGPS';

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/bright';
const SHOP_LOCATION: [number, number] = [80.170, 13.054];

interface DeliveryAddressProps {
  onAddressConfirm: (address: string, lat: number, lng: number, parts?: AddressParts | null) => void;
}

type AddressParts = {
  houseNo: string;
  street: string;
  area: string;
  city: string;
  pincode: string;
  landmark: string;
};

type GeocodeResult = { parts: AddressParts; address: string };

async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
  const emptyParts: AddressParts = { houseNo: '', street: '', area: '', city: '', pincode: '', landmark: '' };
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    if (data?.address) {
      const a = data.address;
      const parts: AddressParts = {
        houseNo: a.house_number || '',
        street: a.road || '',
        area: a.suburb || a.neighbourhood || a.quarter || '',
        city: a.city || a.town || a.village || a.municipality || '',
        pincode: a.postcode || '',
        landmark: '',
      };
      const address = [parts.houseNo, parts.street, parts.area, parts.city, parts.pincode].filter(Boolean).join(', ');
      return { parts, address };
    }
    return { parts: emptyParts, address: data.display_name || '' };
  } catch {
    return { parts: emptyParts, address: '' };
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

  // GPS state
  const [gpsParts, setGpsParts] = useState<AddressParts | null>(null);
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
        m.resize();

        // OSRM road route source/layers (shop → you).
        m.addSource('da-route', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        m.addLayer({
          id: 'da-route-casing', type: 'line', source: 'da-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 7 },
        });
        m.addLayer({
          id: 'da-route-line', type: 'line', source: 'da-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#2563eb', 'line-width': 4.5 },
        });

        const shopEl = document.createElement('div');
        shopEl.className = 'shop-marker';
        shopEl.innerHTML = '<div class="shop-marker-pin">🏪</div>';
        shopMarkerRef.current = new maplibregl.Marker({ element: shopEl, anchor: 'center' })
          .setLngLat(SHOP_LOCATION).addTo(m);

        // Realistic motorcycle badge for the user's live position.
        const bikeEl = document.createElement('div');
        bikeEl.className = 'ltm-bike-badge';
        bikeEl.innerHTML =
          '<div class="ltm-bike-glyph">' +
          '<svg width="26" height="26" viewBox="0 0 40 40" aria-hidden="true" focusable="false">' +
          '<path d="M8.5 30.5 L13.5 22.5 H22.5" stroke="#141414" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
          '<rect x="14.5" y="20.8" width="8.2" height="5" rx="1.4" fill="#141414" opacity="0.9"/>' +
          '<path d="M11.5 21.2 Q13 17.5 16.5 17.2 H21.5 Q24 17.4 25.2 19.6" stroke="#141414" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
          '<path d="M22.5 20.5 L28.5 12.8" stroke="#141414" stroke-width="2.4" stroke-linecap="round"/>' +
          '<path d="M25.2 11.6 L30.5 12.4" stroke="#141414" stroke-width="2.4" stroke-linecap="round"/>' +
          '<circle cx="31" cy="13.6" r="1.7" fill="#141414"/>' +
          '<path d="M14.5 25.6 L11 29.5" stroke="#141414" stroke-width="2" stroke-linecap="round"/>' +
          '<circle cx="9" cy="29.5" r="4.6" fill="none" stroke="#141414" stroke-width="2.6"/><circle cx="9" cy="29.5" r="1.2" fill="#141414"/>' +
          '<circle cx="29" cy="29.5" r="4.6" fill="none" stroke="#141414" stroke-width="2.6"/><circle cx="29" cy="29.5" r="1.2" fill="#141414"/>' +
          '<circle cx="9" cy="29.5" r="2.6" fill="none" stroke="#141414" stroke-width="0.7" opacity="0.6"/>' +
          '<circle cx="29" cy="29.5" r="2.6" fill="none" stroke="#141414" stroke-width="0.7" opacity="0.6"/>' +
          '</svg>' +
          '</div>';
        userMarkerRef.current = new maplibregl.Marker({ element: bikeEl, anchor: 'center' })
          .setLngLat(SHOP_LOCATION).addTo(m);
      });

      // Modal entry animation is 0.25s; resize again once it has settled so
      // the canvas matches the final container size.
      setTimeout(() => m.resize(), 500);

      mapRef.current = m;
      mapInitDone.current = true;
    }, 300);

    return () => clearTimeout(timer);
  }, [page === 'gps']);

  // ─── GPS → MAP + OSRM ROUTE + GEOCODE ─────────────────────
  const lastFixRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!mapRef.current || !position) return;
    const lngLat: [number, number] = [position.longitude, position.latitude];

    userMarkerRef.current?.setLngLat(lngLat);

    // Rotate the bike toward travel direction.
    const prev = lastFixRef.current;
    if (prev) {
      const dLat = position.latitude - prev.lat;
      const dLng = position.longitude - prev.lng;
      const moved = Math.hypot(dLat * 111320, dLng * 111320 * Math.cos(prev.lat * (Math.PI / 180)));
      if (moved > 4) {
        const bearing = (Math.atan2(dLng * Math.cos(prev.lat * (Math.PI / 180)), dLat) * 180) / Math.PI;
        const glyph = userMarkerRef.current?.getElement().querySelector<HTMLElement>('.ltm-bike-glyph');
        if (glyph) glyph.style.transform = `rotate(${(bearing + 360) % 360}deg)`;
      }
    }
    lastFixRef.current = { lat: position.latitude, lng: position.longitude };

    // OSRM road route (free public server) with straight-line fallback.
    if (mapRef.current.getSource('da-route')) {
      (async () => {
        let coords: [number, number][] | null = null;
        try {
          const res = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${SHOP_LOCATION[0]},${SHOP_LOCATION[1]};${lngLat[0]},${lngLat[1]}?overview=full&geometries=geojson`
          );
          if (res.ok) {
            const json = await res.json();
            coords = json?.routes?.[0]?.geometry?.coordinates ?? null;
          }
        } catch { /* fall back to straight line */ }
        if (!coords || coords.length < 2) coords = [SHOP_LOCATION, lngLat];
        const source = mapRef.current!.getSource('da-route') as maplibregl.GeoJSONSource | null;
        if (source) {
          source.setData({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: coords },
                properties: {},
              },
            ],
          });
        }
      })();
    }
    const bounds = new maplibregl.LngLatBounds();
    bounds.extend(SHOP_LOCATION);
    bounds.extend(lngLat);
    mapRef.current.fitBounds(bounds, { padding: 50, duration: 1000 });

    setGpsLat(position.latitude);
    setGpsLng(position.longitude);
    reverseGeocode(position.latitude, position.longitude).then(({ parts, address }) => {
      const filled = parts.houseNo || parts.street || parts.area || parts.city || parts.pincode;
      if (filled) {
        setGpsParts(parts);
      } else if (address) {
        setGpsParts({ houseNo: '', street: address, area: '', city: '', pincode: '', landmark: '' });
      }
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
    if (!gpsParts) {
      onAddressConfirm(`${gpsLat.toFixed(4)}, ${gpsLng.toFixed(4)}`, gpsLat, gpsLng, null);
      setPage('home');
      cleanupMap();
      return;
    }
    const partsArr = [gpsParts.houseNo, gpsParts.street, gpsParts.area, gpsParts.city, gpsParts.pincode].filter(Boolean);
    const addr = partsArr.join(', ') + (gpsParts.landmark ? `, Near ${gpsParts.landmark}` : '');
    setPage('home');
    onAddressConfirm(addr, gpsLat, gpsLng, gpsParts);
    cleanupMap();
  };

  // ─── SAVE MANUAL ─────────────────────────────────────────
  const handleSaveManual = () => {
    const partsArr = [houseNo, street, area, city, pincode].filter(Boolean);
    if (partsArr.length === 0) return;
    const parts: AddressParts = { houseNo, street, area, city, pincode, landmark };
    const addr = partsArr.join(', ') + (landmark ? `, Near ${landmark}` : '');
    setPage('home');
    onAddressConfirm(addr, SHOP_LOCATION[1], SHOP_LOCATION[0], parts);
  };

  const handleBack = () => {
    cleanupMap();
    setPage('home');
  };

  // ─── HOME (cart inline) ──────────────────────────────────
  if (page === 'home') {
    return (
      <div className="delivery-address-section">
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
      </div>
    );
  }

  // ─── GPS FULL-SCREEN PAGE ────────────────────────────────
  if (page === 'gps') {
    return (
      <div className="da-fullpage">
        <div className="da-fullpage-card">
          <div className="da-fp-header">
            <button className="da-fp-back" onClick={handleBack}>←</button>
            <h3>Current Location</h3>
            <span />
          </div>
          <div className="da-fp-body">
            <div ref={mapDivRef} className="da-fp-map" />

            <div className="da-fp-legend">
              <span><span className="otm-legend-dot shop" /> Shop</span>
              <span><span className="ltm-legend-bike" /> You (bike)</span>
            </div>

            {gpsError && <p className="da-error">⚠️ {gpsError}</p>}

            {position ? (
              <div className="da-fp-address-from">
                🏪 Jeeva Complex, Alapakkam, Maduravoyal
              </div>
            ) : (
              <div className="da-fp-address-from waiting">📍 Waiting for GPS...</div>
            )}

            {gpsParts && (
              <div className="da-fp-edit-box">
                <label>✏️ The fetched address may be inaccurate. Please correct it:</label>
                <div className="da-fp-fields">
                  <div className="da-fp-field">
                    <label>House / Flat No</label>
                    <input
                      type="text"
                      value={gpsParts.houseNo}
                      onChange={(e) => setGpsParts({ ...gpsParts, houseNo: e.target.value })}
                      placeholder="e.g. 12"
                    />
                  </div>
                  <div className="da-fp-field">
                    <label>Street / Road</label>
                    <input
                      type="text"
                      value={gpsParts.street}
                      onChange={(e) => setGpsParts({ ...gpsParts, street: e.target.value })}
                      placeholder="e.g. Gandhi Street"
                    />
                  </div>
                  <div className="da-fp-field">
                    <label>Area / Locality</label>
                    <input
                      type="text"
                      value={gpsParts.area}
                      onChange={(e) => setGpsParts({ ...gpsParts, area: e.target.value })}
                      placeholder="e.g. Anna Nagar"
                    />
                  </div>
                  <div className="da-fp-field-row">
                    <div className="da-fp-field">
                      <label>City</label>
                      <input
                        type="text"
                        value={gpsParts.city}
                        onChange={(e) => setGpsParts({ ...gpsParts, city: e.target.value })}
                        placeholder="e.g. Chennai"
                      />
                    </div>
                    <div className="da-fp-field">
                      <label>Pincode</label>
                      <input
                        type="text"
                        value={gpsParts.pincode}
                        onChange={(e) => setGpsParts({ ...gpsParts, pincode: e.target.value })}
                        placeholder="e.g. 600095"
                      />
                    </div>
                  </div>
                  <div className="da-fp-field">
                    <label>Landmark</label>
                    <input
                      type="text"
                      value={gpsParts.landmark}
                      onChange={(e) => setGpsParts({ ...gpsParts, landmark: e.target.value })}
                      placeholder="Near temple, opposite park..."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="da-fp-footer">
            <button className="da-fp-save" onClick={handleSaveGPS} disabled={!position}>
              ✓ Save Address
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── MANUAL FULL-SCREEN PAGE ─────────────────────────────
  return (
    <div className="da-fullpage">
      <div className="da-fullpage-card">
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
            <div className="da-fp-field-row">
              <div className="da-fp-field">
                <label>City *</label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Chennai" />
              </div>
              <div className="da-fp-field">
                <label>Pincode *</label>
                <input type="text" value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="e.g. 600095" />
              </div>
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
    </div>
  );
}
