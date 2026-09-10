import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomers } from '../hooks/useCustomers';
import { useProducts, DEFAULT_PRODUCTS } from '../hooks/useProducts';
import {
  getPricingConfig,
  savePricingConfig,
  subscribeToPricingConfig,
  DEFAULT_PRICING,
  type PricingConfig as SharedPricingConfig,
  type FloorPricing as SharedFloorPricing,
} from '../utils/pricing';

// ─── Types ─────────────────────────────────────────────────────────────────────
// PricingConfig/FloorPricing are shared with the customer address form via
// src/utils/pricing.ts — web login edits them, the address form reads them.
interface Customer {
  id: string;
  name: string;
  status: 'Active' | 'Inactive';
  locationType: 'Residential' | 'Commercial' | 'Other';
  address: string;
  phone: string;
}

type FloorPricing = SharedFloorPricing;
type PricingConfig = SharedPricingConfig;

// ─── Main Component ─────────────────────────────────────────────────────────────
export function PricingConfiguration() {
  const navigate = useNavigate();
  const { customers: liveCustomers, loading: customersLoading } = useCustomers();
  const { products: liveProducts } = useProducts();

  // Map live customers into the shape this page needs (with defaults).
  const customers: Customer[] = liveCustomers.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status ?? 'Active',
    locationType: c.locationType ?? 'Residential',
    address: c.address || '—',
    phone: c.phone || '—',
  }));

  const [selectedCustomerId, _setSelectedCustomerId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | number>('');
  const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICING);
  const [saved, setSaved] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Load the saved web-login pricing config once, then keep it live —
  // edits from another session update this page instantly.
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

  // Default the customer selection to the first live account once loaded.
  useEffect(() => {
    if (
      !customersLoading &&
      customers.length > 0 &&
      !customers.some((c) => c.id === selectedCustomerId)
    ) {
      _setSelectedCustomerId(customers[0].id);
    }
  }, [customers, customersLoading, selectedCustomerId]);

  // Default product selection once products are loaded.
  useEffect(() => {
    if (liveProducts.length > 0 && !liveProducts.some((p) => String(p.id) === String(selectedProductId))) {
      setSelectedProductId(liveProducts[0].id);
    }
  }, [liveProducts, selectedProductId]);

  const customer =
    customers.find((c) => c.id === selectedCustomerId) ?? customers[0];
  const product =
    liveProducts.find((p) => String(p.id) === String(selectedProductId)) ?? liveProducts[0] ?? DEFAULT_PRODUCTS[0];

  const updateFloor = (field: keyof FloorPricing, value: number | string) => {
    setPricing((prev) => ({
      ...prev,
      houseApartment: {
        ...prev.houseApartment,
        floorPricing: { ...prev.houseApartment.floorPricing, [field]: value },
      },
    }));
  };

  // Save the config to Supabase — the customer address form reads these
  // floors live, so changes apply without a redeploy.
  const handleSave = async () => {
    setSavingConfig(true);
    try {
      await savePricingConfig(pricing);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSavingConfig(false);
    }
  };

  const fp = pricing.houseApartment.floorPricing;

  // Summary helpers
  const houseSummary = pricing.houseApartment.useFloorWise
    ? `Ground: ₹${fp.groundFloor} | 1st: ₹${fp.floor1} | 2nd: ₹${fp.floor2} | 3rd: ₹${fp.floor3} | 4th+: ₹${fp.moreThan3Mode === 'custom' ? fp.customPrice : fp.floor3}`
    : 'Flat rate pricing';
  const commercialSummary = pricing.commercial.useCustomerSpecific
    ? `₹${pricing.commercial.price} (Single price)`
    : 'Default price';
  const otherSummary = `₹${pricing.other.defaultPrice} (Default price)`;

  return (
    <div className="pricing-page">
      {/* Top Bar */}
      <div className="pricing-topbar">
        <div className="pricing-topbar-left">
          <h2 className="pricing-page-title">Pricing Configuration</h2>
          <p className="pricing-page-subtitle">Set delivery prices for this customer based on location type.</p>
        </div>
        <button className="pricing-back-btn" onClick={() => navigate('/')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          Back to Home
        </button>
      </div>

      {/* Customer Info Bar — live from the customers table */}
      <div className="pricing-customer-bar">
        <div className="pricing-customer-left">
          <div className="pricing-cust-avatar">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
            </svg>
          </div>
          <div className="pricing-cust-info">
            <div className="pricing-cust-name-row">
              <h3 className="pricing-cust-name">{customer ? customer.name : customersLoading ? 'Loading…' : 'No customer selected'}</h3>
              {customer && (
                <span className={`pricing-status-badge ${customer.status === 'Active' ? 'active' : 'inactive'}`}>
                  {customer.status}
                </span>
              )}
            </div>
            {customer && (
              <p className="pricing-cust-loc">Location Type: <strong>{customer.locationType}</strong></p>
            )}
          </div>
        </div>
        {customer && (
          <div className="pricing-customer-meta">
            <div className="pricing-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              {customer.address}
            </div>
            <div className="pricing-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l.81-.81a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              {customer.phone}
            </div>
          </div>
        )}
        <button className="pricing-view-details-btn">View Customer Details</button>
      </div>

      {/* Scroll Container */}
      <div className="pricing-scroll-content">
        {/* Section 1: Select Product */}
        <div className="pricing-section">
          <div className="pricing-section-header">
            <span className="pricing-section-num">1.</span>
            <h3 className="pricing-section-title">Select Product</h3>
          </div>
          <div className="pricing-product-row">
            <div className="pricing-product-select-wrap">
              <label className="pricing-label">
                Product <span className="pricing-required">*</span>
              </label>
              <div className="pricing-select-wrapper">
                <select
                  className="pricing-select"
                  value={String(selectedProductId)}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                >
                  {liveProducts.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name} ({p.unit} - ₹{p.price.toFixed(2)})
                    </option>
                  ))}
                </select>
                <div className="pricing-select-caret">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>
            </div>

            <div className="pricing-product-preview">
              <div className="pricing-product-icon-wrap" style={{ fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {product.image || '💧'}
              </div>
              <div className="pricing-product-preview-info">
                <p className="pricing-product-preview-name">{product.name}</p>
                <p className="pricing-product-preview-desc">
                  {product.description || `${product.unit} · Base Price: ₹${product.price.toFixed(2)}`}
                </p>
              </div>
              <span className={`pricing-status-badge ${(product.status || 'Active') === 'Active' ? 'active' : 'inactive'}`}>
                {product.status || 'Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Pricing Configuration */}
        <div className="pricing-section">
          <div className="pricing-section-header">
            <span className="pricing-section-num">2.</span>
            <h3 className="pricing-section-title">Pricing Configuration (Based on Location Type)</h3>
          </div>

          <div className="pricing-columns">
            {/* House / Apartment */}
            <div className="pricing-col pricing-col-house">
              <div className="pricing-col-header">
                <div className="pricing-col-icon pricing-col-icon-house">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </div>
                <div>
                  <p className="pricing-col-title pricing-col-title-house">House / Apartment</p>
                  <p className="pricing-col-desc">Same floor pricing for houses and apartments.</p>
                </div>
              </div>

              <label className="pricing-radio-label">
                <input
                  type="radio"
                  name="house-mode"
                  checked={pricing.houseApartment.useFloorWise}
                  onChange={() => setPricing(p => ({ ...p, houseApartment: { ...p.houseApartment, useFloorWise: true } }))}
                  className="pricing-radio"
                />
                Use floor-wise pricing
              </label>

              {pricing.houseApartment.useFloorWise && (
                <table className="pricing-floor-table">
                  <thead>
                    <tr>
                      <th>Floor</th>
                      <th>Price (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Ground Floor', field: 'groundFloor' as keyof FloorPricing },
                      { label: '1st Floor', field: 'floor1' as keyof FloorPricing },
                      { label: '2nd Floor', field: 'floor2' as keyof FloorPricing },
                      { label: '3rd Floor', field: 'floor3' as keyof FloorPricing },
                    ].map(({ label, field }) => (
                      <tr key={field}>
                        <td>{label}</td>
                        <td>
                          <input
                            type="number"
                            className="pricing-floor-input"
                            value={fp[field] as number}
                            onChange={(e) => updateFloor(field, parseFloat(e.target.value) || 0)}
                          />
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td>More than 3rd Floor</td>
                      <td>
                        <div className="pricing-more-floor">
                          <label className="pricing-radio-label pricing-radio-sm">
                            <input
                              type="radio"
                              name="more3"
                              checked={fp.moreThan3Mode === 'use3rdFloor'}
                              onChange={() => updateFloor('moreThan3Mode', 'use3rdFloor')}
                              className="pricing-radio"
                            />
                            Use 3rd Floor Price (₹{fp.floor3})
                          </label>
                          <label className="pricing-radio-label pricing-radio-sm">
                            <input
                              type="radio"
                              name="more3"
                              checked={fp.moreThan3Mode === 'custom'}
                              onChange={() => updateFloor('moreThan3Mode', 'custom')}
                              className="pricing-radio"
                            />
                            Custom Price
                            {fp.moreThan3Mode === 'custom' && (
                              <input
                                type="number"
                                className="pricing-floor-input pricing-inline-input"
                                value={fp.customPrice}
                                onChange={(e) => updateFloor('customPrice', parseFloat(e.target.value) || 0)}
                              />
                            )}
                          </label>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* Commercial */}
            <div className="pricing-col pricing-col-commercial">
              <div className="pricing-col-header">
                <div className="pricing-col-icon pricing-col-icon-commercial">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2"/>
                    <path d="M8 21h8M12 17v4"/>
                  </svg>
                </div>
                <div>
                  <p className="pricing-col-title pricing-col-title-commercial">Commercial</p>
                  <p className="pricing-col-desc">Single price for this commercial customer.</p>
                </div>
              </div>

              <label className="pricing-checkbox-label">
                <input
                  type="checkbox"
                  className="pricing-checkbox"
                  checked={pricing.commercial.useCustomerSpecific}
                  onChange={(e) => setPricing(p => ({ ...p, commercial: { ...p.commercial, useCustomerSpecific: e.target.checked } }))}
                />
                Use customer-specific price
              </label>

              {pricing.commercial.useCustomerSpecific && (
                <>
                  <div className="pricing-field-group">
                    <label className="pricing-label">
                      Commercial Price (₹) <span className="pricing-required">*</span>
                    </label>
                    <input
                      type="number"
                      className="pricing-text-input"
                      value={pricing.commercial.price}
                      onChange={(e) => setPricing(p => ({ ...p, commercial: { ...p.commercial, price: parseFloat(e.target.value) || 0 } }))}
                    />
                  </div>
                  <div className="pricing-info-box">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    This price will be used for all deliveries to this commercial customer, regardless of floor.
                  </div>
                </>
              )}
            </div>

            {/* Other */}
            <div className="pricing-col pricing-col-other">
              <div className="pricing-col-header">
                <div className="pricing-col-icon pricing-col-icon-other">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 11l19-9-9 19-2-8-8-2z"/>
                  </svg>
                </div>
                <div>
                  <p className="pricing-col-title pricing-col-title-other">Other</p>
                  <p className="pricing-col-desc">Shops, hostels, industries, etc.</p>
                </div>
              </div>

              <label className="pricing-radio-label">
                <input
                  type="radio"
                  name="other-mode"
                  checked={pricing.other.useDefaultPrice}
                  onChange={() => setPricing(p => ({ ...p, other: { ...p.other, useDefaultPrice: true } }))}
                  className="pricing-radio"
                />
                Use default price
              </label>

              <div className="pricing-field-group" style={{ marginTop: '1rem' }}>
                <label className="pricing-label">Default Price (₹)</label>
                <input
                  type="number"
                  className="pricing-text-input pricing-text-input-muted"
                  value={pricing.other.defaultPrice}
                  readOnly
                />
              </div>

              <div className="pricing-info-box">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                This price will be used if the customer's location type is Other.
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Price Summary */}
        <div className="pricing-section pricing-section-summary">
          <div className="pricing-section-header">
            <span className="pricing-section-num">3.</span>
            <h3 className="pricing-section-title">Price Summary</h3>
          </div>

          <div className="pricing-summary-row">
            {/* House summary */}
            <div className="pricing-summary-card pricing-summary-house">
              <div className="pricing-summary-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
              <div className="pricing-summary-info">
                <p className="pricing-summary-label">House / Apartment ({product.name})</p>
                <p className="pricing-summary-value">{houseSummary}</p>
              </div>
            </div>

            {/* Commercial summary */}
            <div className="pricing-summary-card pricing-summary-commercial">
              <div className="pricing-summary-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2"/>
                  <path d="M8 21h8M12 17v4"/>
                </svg>
              </div>
              <div className="pricing-summary-info">
                <p className="pricing-summary-label">Commercial ({product.name})</p>
                <p className="pricing-summary-value">{commercialSummary}</p>
              </div>
            </div>

            {/* Other summary */}
            <div className="pricing-summary-card pricing-summary-other">
              <div className="pricing-summary-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 11l19-9-9 19-2-8-8-2z"/>
                </svg>
              </div>
              <div className="pricing-summary-info">
                <p className="pricing-summary-label">Other ({product.name})</p>
                <p className="pricing-summary-value">{otherSummary}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pricing-actions">
          <button className="pricing-cancel-btn" onClick={() => navigate('/')}>
            Cancel
          </button>
          <button
            className={`pricing-save-btn ${saved ? 'pricing-save-btn-success' : ''}`}
            onClick={handleSave}
            disabled={savingConfig}
          >
            {saved ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Saved!
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                Save Pricing
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
