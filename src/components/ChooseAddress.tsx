import { useRef } from 'react';
import type { CustomerAddress } from '../types/customer';
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
}: ChooseAddressProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // Dismiss the whole sheet when the backdrop is tapped.
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onDone();
    }
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
          <h2 className="ca-title">Add New Address</h2>
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
        </div>

        {/* Form body */}
        <div className="ca-form-page">
          <AddressDetails
            onSave={handleFormSave}
            onDismiss={onDone}
          />
        </div>
      </div>
    </div>
  );
}
