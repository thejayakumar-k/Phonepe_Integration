import { useState, useRef } from 'react';
import type { CustomerAddress } from '../types/customer';
import { useCustomerAddresses } from '../hooks/useCustomerAddresses';
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
  const [page, setPage] = useState<'list' | 'form'>('list');
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // Dismiss the whole sheet when the backdrop is tapped.
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onDone();
    }
  };

  // Saved address selected from the list
  const handleSelectAddress = (addr: CustomerAddress) => {
    onAddressConfirm(addr, onDone);
  };

  // Navigate to the manual address form
  const handleAddNewAddress = () => {
    setPage('form');
  };

  // Address form "Save"
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

    onAddressConfirm(addr, onDismiss);
  };

  return (
    <div className="choose-address-overlay" onClick={handleBackdrop}>
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
            <>
              <h2 className="ca-title">Add New Address</h2>
              <button
                type="button"
                className="ca-close"
                onClick={() => setPage('list')}
                aria-label="Back"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Sheet body */}
        {page === 'list' ? (
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

            {/* Action button */}
            <div className="ca-actions">
              <button
                type="button"
                className="ca-btn-primary"
                onClick={handleAddNewAddress}
              >
                + Add New Address
              </button>
            </div>
          </div>
        ) : (
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
