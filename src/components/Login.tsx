import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { demoVendors, demoCustomers, demoDeliveryPartners } from '../data/demo';

export function Login() {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const { session, login } = useAuth();

  const [vendorId, setVendorId] = useState(demoVendors[0]?.id || 'VENDOR001');
  const [customerId, setCustomerId] = useState(demoCustomers[0]?.id || 'CUST001');
  const [partnerId, setPartnerId] = useState(demoDeliveryPartners[0]?.id || 'DP001');

  if (role !== 'vendor' && role !== 'customer' && role !== 'delivery') {
    return <Navigate to="/" replace />;
  }

  // If already logged in with this role, redirect immediately
  if (role === 'vendor' && session?.role === 'vendor') {
    return <Navigate to="/vendor" replace />;
  }
  if (role === 'customer' && session?.role === 'customer') {
    return <Navigate to="/customer" replace />;
  }
  if (role === 'delivery' && session?.role === 'delivery') {
    return <Navigate to="/delivery" replace />;
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (role === 'vendor') {
      const vendor = demoVendors.find((v) => v.id === vendorId) || demoVendors[0];
      login({
        role: 'vendor',
        username: vendor.name,
        vendorId: vendor.id,
        vendorName: vendor.name,
      });
      navigate('/vendor', { replace: true });
    } else if (role === 'delivery') {
      const partner = demoDeliveryPartners.find((dp) => dp.id === partnerId) || demoDeliveryPartners[0];
      login({
        role: 'delivery',
        username: partner.name,
        partnerId: partner.id,
        partnerName: partner.name,
      });
      navigate('/delivery', { replace: true });
    } else {
      const customer = demoCustomers.find((c) => c.id === customerId) || demoCustomers[0];
      login({
        role: 'customer',
        username: customer.name,
        customerId: customer.id,
        customerName: customer.name,
      });
      navigate('/customer', { replace: true });
    }
  };

  const getSubtitle = () => {
    if (role === 'vendor') return 'Vendor Portal';
    if (role === 'delivery') return 'Delivery Partner';
    return 'Customer Login';
  };

  const getCardTitle = () => {
    if (role === 'vendor') return 'Vendor Sign In';
    if (role === 'delivery') return 'Delivery Partner Sign In';
    return 'Customer Sign In';
  };

  const getCardIcon = () => {
    if (role === 'vendor') return '🛍️';
    if (role === 'delivery') return '🛵';
    return '🛒';
  };

  const getNote = () => {
    if (role === 'vendor') return 'Select your vendor store to manage orders & live delivery.';
    if (role === 'delivery') return 'Select your delivery partner profile to view assigned orders.';
    return 'Select your account to continue shopping & tracking.';
  };

  return (
    <div className="login-page">
      <header className="home-header">
        <h1 className="brand-title">OORUNII</h1>
        <p className="brand-subtitle">{getSubtitle()}</p>
      </header>

      <main className="login-content">
        <div className="login-card">
          <span className="role-icon">{getCardIcon()}</span>
          <h2>{getCardTitle()}</h2>
          <p className="login-note">{getNote()}</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">
                {role === 'vendor'
                  ? 'Select Vendor Store'
                  : role === 'delivery'
                  ? 'Select Delivery Partner'
                  : 'Select Customer Account'}
              </label>
              {role === 'vendor' ? (
                <select
                  className="form-input"
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                >
                  {demoVendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.id})
                    </option>
                  ))}
                </select>
              ) : role === 'delivery' ? (
                <select
                  className="form-input"
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                >
                  {demoDeliveryPartners.map((dp) => (
                    <option key={dp.id} value={dp.id}>
                      {dp.name} ({dp.id})
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  className="form-input"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  {demoCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button type="submit" className="btn btn-login">
              {role === 'vendor'
                ? 'Sign In to Vendor Dashboard'
                : role === 'delivery'
                ? 'Sign In as Delivery Partner'
                : 'Sign In'}
            </button>
          </form>

          <Link to="/" className="login-back">
            ← Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}


