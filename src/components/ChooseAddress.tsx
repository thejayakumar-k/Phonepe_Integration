import { useState, useEffect, useRef } from 'react';
import type { CustomerAddress } from '../types/customer';
import { useCustomerAddresses } from '../hooks/useCustomerAddresses';
import { useGPS } from '../hooks/useGPS';
import { AddressDetails } from './AddressDetails';

interface ChooseAddressProps {
  onAddressConfirm: (
    address: CustomerAddress,
    onDone: () => void,
  ) => void;
  onDone: () => void;
  title?: string;
}

export function ChooseAddress({
  onAddressConfirm,
  onDone,
  title = 'Choose a delivery address',
}: ChooseAddressProps) {
  const { addresses, loading } = useCustomerAddresses();
  const { position, error: gpsError, startTracking, stopTracking } = useGPS({
    enableHighAccuracy: true,
    maximumAge: 2000,
    timeout: 15000,
    watchPosition: true,
  });

  const [page, setPage] = useState<'list' | 'gps' | 'form'>('list');
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // Track current location with GPS while the GPS page is visible.
  useEffect(() => {
    if (page === 'gps') {
      startTracking();
      return () => stopTracking();
    }
  }, [page, startTracking, stopTracking]);

  // Dismiss the whole sheet when the backdrop is tapped.
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onDone();
    }
  };

  // ── Saved address selected from the list ──────────────────────
  const handleSelectAddress = (addr: CustomerAddress) => {
    onAddressConfirm(addr, onDone);
  };

  // ── Confirm current location ───────────────────────────────────
  const handleConfirmCurrentLocation = () => {
    const lat = position?.latitude || 13.0827;
    const lng = position?.longitude || 80.2707;
    const addr: CustomerAddress = {
      id: `cur-${Date.now()}`,
      customerId: '',
      address: `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      houseNo: '',
      street: '',
      apartment: '',
      area: '',
      city: '',
      pincode: '',
      landmark: '',
      addressType: 'Apt',
      lat,
      lng,
      createdAt: Date.now(),
    };
    onAddressConfirm(addr, onDone);
  };

  // ── Navigate to the manual address form ────────────────────────
  const handleAddNewAddress = () => {
    setPage('form');
  };

  // ── GPS page "Save" ────────────────────────────────────────────
  const handleGpsSave = () => {
    const lat = position?.latitude || 13.0827;
    const lng = position?.longitude || 80.2707;
    const addr: CustomerAddress = {
      id: `gps-${Date.now()}`,
      customerId: '',
      address: `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      houseNo: '',
      street: '',
      apartment: '',
      area: '',
      city: '',
      pincode: '',
      landmark: '',
      addressType: 'Apt',
      lat,
      lng,
      createdAt: Date.now(),
    };
    onAddressConfirm(addr, onDone);
  };

  // ── Address form "Save" ────────────────────────────────────────
  const handleFormSave = (
    values: {
      houseNo: string;
      street: string;
      apartment: string;
      area: string;
      city: string;
      pincode: string;
      landmark: string;
      addressType: import('../types/customer').AddressType;
    },
    onDismiss: () => void,
  ) => {
    // Build a display address string from the filled fields.
    const parts = [
      values.houseNo,
      values.street,
      values.apartment,
      values.area,
      values.city,
      values.pincode,
    ].filter(Boolean);
    const address = parts.join(', ') + (values.landmark ? `, Near ${values.landmark}` : '');

    const addr: CustomerAddress = {
      id: `new-${Date.now()}`,
      customerId: '',
      address,
      houseNo: values.houseNo,
      street: values.street,
      apartment: values.apartment,
      area: values.area,
      city: values.city,
      pincode: values.pincode,
      landmark: values.landmark,
      addressType: values.addressType as CustomerAddress['addressType'],
      lat: undefined,
      lng: undefined,
      createdAt: Date.now(),
    };

    // Ideally we'd also geocode the address here so the delivery partner
    // map can plot a real route. For now we save the address text only —
    // the delivery map will fall back to the shop location until geocoding
    // is wired in.
    onAddressConfirm(addr, onDismiss);
  };

  return (
    <div className="choose-address-overlay" onClick={handleBackdrop}>
      {/* Handle bar at the top of the sheet */}
      <div className="ca-sheet-handle" />

      <div className="ca-sheet" ref={sheetRef}>
        {/* Sheet header */}
        <div className="ca-header">
          {page === 'list' ? (
            <>
              <h2 className="ca-title">{title}</h2>
              <button
                type="button"
                className="ca-close"
                onClick={onDone}
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="ca-back"
              onClick={() => setPage('list')}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          )}
        </div>

        {/* Sheet body */}
        {page === 'list' && (
          <div className="ca-body">
            {loading ? (
              <div className="ca-loading">Loading addresses...</div>
            ) : addresses.length === 0 ? (
              <div className="ca-empty">
                <p>No saved addresses yet.</p>
              </div>
            ) : (
              <div className="ca-address-list">
                {addresses.map((addr) => (
                  <button
                    key={addr.id}
                    type="button"
                    className="ca-address-card"
                    onClick={() => handleSelectAddress(addr)}
                  >
                    <div className="ca-address-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                      </svg>
                    </div>
                    <div className="ca-address-info">
                      <span className="ca-address-label">{addr.addressType ? addr.addressType.toUpperCase() : 'ADDRESS'}</span>
                      <span className="ca-address-text">
                        {addr.address}
                        {addr.address.length > 48 ? '...' : ''}
                      </span>
                    </div>
                    <svg className="ca-address-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="ca-actions">
              <button
                type="button"
                className="ca-btn-primary"
                onClick={handleConfirmCurrentLocation}
              >
                {position ? 'Confirm Current Location' : 'Detect & Confirm Current Location'}
              </button>

              <span className="ca-actions-or">(Or)</span>

              <button
                type="button"
                className="ca-btn-secondary"
                onClick={handleAddNewAddress}
              >
                Add New Address
              </button>
            </div>

            {gpsError && (
              <p className="ca-gps-error">⚠️ {gpsError}</p>
            )}
          </div>
        )}

        {page === 'gps' && (
          <div className="ca-gps-page">
            <div className="ca-gps-status">
              {position ? (
                <div className="ca-gps-found">
                  <strong>GPS location found</strong>
                  <span>
                    {position.latitude.toFixed(4)}, {position.longitude.toFixed(4)}
                  </span>
                </div>
              ) : (
                <div className="ca-gps-waiting">
                  <span className="ca-gps-spinner" />
                  Locating you...
                </div>
              )}
            </div>

            {gpsError && <p className="ca-gps-error">⚠️ {gpsError}</p>}

            <div className="ca-gps-actions">
              <button
                type="button"
                className="ca-btn-primary"
                onClick={handleGpsSave}
                disabled={!position}
              >
                Use This Location
              </button>
              <button
                type="button"
                className="ca-btn-ghost"
                onClick={() => setPage('list')}
              >
                Choose from list
              </button>
            </div>
          </div>
        )}

        {page === 'form' && (
          <div className="ca-form-page">
            <AddressDetails
              onSave={handleFormSave}
              onDismiss={() => setPage('list')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
