import { useState, useRef, useEffect, useCallback } from 'react';
import type { AddressType } from '../types/customer';
import {
  getPricingConfig,
  subscribeToPricingConfig,
  getFloorOptions,
  DEFAULT_PRICING,
  type PricingConfig,
  type FloorOption,
} from '../utils/pricing';

interface AddressDetailsProps {
  onSave: (
    values: {
      houseNo: string;
      street: string;
      apartment: string;
      area: string;
      city: string;
      pincode: string;
      landmark: string;
      addressType: AddressType;
      floor: string;
    },
    onDismiss: () => void,
  ) => void;
  onDismiss: () => void;
}

const ADDRESS_TYPES: { label: AddressType; title: string }[] = [
  { label: 'Apt', title: 'Apartment' },
  { label: 'House', title: 'House' },
  { label: 'Commercial', title: 'Commercial' },
  { label: 'Others', title: 'Others' },
];

// Fake apartment suggestions for demo UX (replace with a real source later).
const APARTMENT_SUGGESTIONS = [
  'Pillayar Koil Apt',
  'Bhakyalakshmi Nagar Flat',
  'Kannaiamman Nagar Block A',
  'SLN Colony Apartments',
  'Rain Tree Apartments',
  'Meenakshi Residency',
  'Sunrise Flats',
  'Gandhi Nagar Complex',
];

export function AddressDetails({ onSave, onDismiss }: AddressDetailsProps) {
  const [houseNo, setHouseNo] = useState('');
  const [street, setStreet] = useState('');
  const [apartment, setApartment] = useState('');
  const [apartmentSuggestions, setApartmentSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [area, setArea] = useState('');
  const [landmark, setLandmark] = useState('');
  const [addressType, setAddressType] = useState<AddressType>('Apt');
  // Floor list comes from the web-login pricing configuration — live.
  const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICING);
  const [floor, setFloor] = useState('');
  const [customFloor, setCustomFloor] = useState('');

  useEffect(() => {
    let cancelled = false;
    getPricingConfig().then((config) => {
      if (!cancelled) setPricing(config);
    });
    const unsubscribe = subscribeToPricingConfig((config) => {
      if (!cancelled) setPricing(config);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const floorOptions: FloorOption[] = getFloorOptions(pricing);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  // Close suggestions when clicking outside the apartment field + list.
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        listRef.current &&
        !listRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const runSuggestions = useCallback((q: string) => {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) {
      setApartmentSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const matched = APARTMENT_SUGGESTIONS.filter(
      (s) => s.toLowerCase().includes(trimmed),
    );
    setApartmentSuggestions(matched.slice(0, 5));
    setShowSuggestions(matched.length > 0);
  }, []);

  const handleApartmentChange = (value: string) => {
    setApartment(value);
    runSuggestions(value);
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setApartment(suggestion);
    setApartmentSuggestions([]);
    setShowSuggestions(false);
  };

  const isValid =
    houseNo.trim() || street.trim() || apartment.trim() || area.trim() || city.trim() || pincode.trim();

  const handleSave = () => {
    const showFloor = addressType === 'Apt' || addressType === 'House';
    const finalFloor = showFloor
      ? (floor === 'Custom'
          ? (customFloor.trim() ? customFloor.trim() : 'Custom Floor')
          : floor)
      : '';

    onSave(
      {
        houseNo,
        street,
        apartment,
        area,
        city,
        pincode,
        landmark,
        addressType,
        floor: finalFloor,
      },
      onDismiss,
    );
  };

  return (
    <div className="addr-form">
      <div className="addr-form-section">
        <h4 className="addr-form-section-title">ADDRESS DETAILS</h4>

        <div className="addr-field">
          <label className="addr-label">House/Flat No *</label>
          <input
            type="text"
            className="addr-input"
            value={houseNo}
            onChange={(e) => setHouseNo(e.target.value)}
            placeholder="House/Flat No"
          />
        </div>

        <div className="addr-field">
          <label className="addr-label">Street *</label>
          <input
            type="text"
            className="addr-input"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="Street"
          />
        </div>

        <div className="addr-field">
          <label className="addr-label">Apartment *</label>
          <span className="addr-hint">Type Apartment Name if not listed</span>
          <div className="addr-input-wrap">
            <span className="addr-input-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
                <path d="M9 22v-4h6v4"/>
                <line x1="8" y1="6" x2="8.01" y2="6"/>
                <line x1="12" y1="6" x2="12.01" y2="6"/>
                <line x1="16" y1="6" x2="16.01" y2="6"/>
                <line x1="8" y1="10" x2="8.01" y2="10"/>
                <line x1="12" y1="10" x2="12.01" y2="10"/>
                <line x1="16" y1="10" x2="16.01" y2="10"/>
              </svg>
            </span>
            <input
              ref={inputRef}
              type="text"
              className="addr-input addr-input-search"
              value={apartment}
              onChange={(e) => handleApartmentChange(e.target.value)}
              onFocus={() => apartment.trim() && apartmentSuggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Type to search apartments..."
            />
            <span className="addr-input-chevron">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </span>
          </div>

          {showSuggestions && apartmentSuggestions.length > 0 && (
            <ul ref={listRef} className="addr-suggestions">
              {apartmentSuggestions.map((s) => (
                <li
                  key={s}
                  className="addr-suggestion"
                  onClick={() => handleSelectSuggestion(s)}
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Save As Pills — placed right after Apartment field */}
        <div className="addr-field">
          <label className="addr-label">Save As</label>
          <div className="addr-type-pills">
            {ADDRESS_TYPES.map(({ label, title }) => (
              <button
                key={label}
                type="button"
                className={`addr-type-pill ${addressType === label ? 'active' : ''}`}
                onClick={() => {
                  setAddressType(label);
                  if (label !== 'Apt' && label !== 'House') {
                    setFloor('');
                    setCustomFloor('');
                  }
                }}
              >
                {title}
              </button>
            ))}
          </div>
        </div>

        {/* Floor — options & prices apply only for Apartment and House */}
        {(addressType === 'Apt' || addressType === 'House') && floorOptions.length > 0 && (
          <div className="addr-field">
            <label className="addr-label">Floor</label>
            <div className="addr-input-wrap">
              <span className="addr-input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                  <polyline points="2 17 12 22 22 17"/>
                  <polyline points="2 12 12 17 22 12"/>
                </svg>
              </span>
              <select
                className="addr-input addr-input-search"
                value={floor}
                onChange={(e) => {
                  setFloor(e.target.value);
                  if (e.target.value !== 'Custom') {
                    setCustomFloor('');
                  }
                }}
              >
                <option value="">Select floor</option>
                {floorOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="addr-input-chevron">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </span>
            </div>

            {floor === 'Custom' && (
              <div className="addr-input-wrap" style={{ marginTop: '8px' }}>
                <span className="addr-input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
                    <path d="M9 22v-4h6v4"/>
                    <line x1="8" y1="6" x2="8.01" y2="6"/>
                    <line x1="12" y1="6" x2="12.01" y2="6"/>
                    <line x1="16" y1="6" x2="16.01" y2="6"/>
                    <line x1="8" y1="10" x2="8.01" y2="10"/>
                    <line x1="12" y1="10" x2="12.01" y2="10"/>
                    <line x1="16" y1="10" x2="16.01" y2="10"/>
                  </svg>
                </span>
                <input
                  type="text"
                  className="addr-input addr-input-search"
                  value={customFloor}
                  onChange={(e) => setCustomFloor(e.target.value)}
                  placeholder="Enter floor number (e.g. 4th Floor, 47th Floor)"
                  autoFocus
                />
              </div>
            )}
          </div>
        )}

        <div className="addr-field-row">
          <div className="addr-field">
            <label className="addr-label">City *</label>
            <input
              type="text"
              className="addr-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
            />
          </div>

          <div className="addr-field">
            <label className="addr-label">Zipcode *</label>
            <input
              type="text"
              className="addr-input"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              placeholder="Zipcode"
            />
          </div>
        </div>

        <div className="addr-field">
          <label className="addr-label">Location / Area *</label>
          <input
            type="text"
            className="addr-input"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Location / Area"
          />
        </div>

        <div className="addr-field">
          <label className="addr-label">Landmark</label>
          <input
            type="text"
            className="addr-input"
            value={landmark}
            onChange={(e) => setLandmark(e.target.value)}
            placeholder="Landmark"
          />
        </div>
      </div>

      <div className="addr-form-actions">
        <button
          type="button"
          className="addr-btn-primary"
          onClick={handleSave}
          disabled={!isValid}
        >
          Save Address
        </button>
      </div>
    </div>
  );
}
