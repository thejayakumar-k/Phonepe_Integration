import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { demoVendors, demoCustomers } from '../data/demo';

export function Login() {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const { session, login } = useAuth();

  const [vendorId, setVendorId] = useState(demoVendors[0]?.id || 'VENDOR001');
  const [customerId, setCustomerId] = useState(demoCustomers[0]?.id || 'CUST001');

  if (role !== 'vendor' && role !== 'customer') {
    return <Navigate to="/" replace />;
  }

  const isVendor = role === 'vendor';

  // If already logged in with this role, redirect immediately
  if (isVendor && session?.role === 'vendor') {
    return <Navigate to="/vendor" replace />;
  }
  if (!isVendor && session?.role === 'customer') {
    return <Navigate to="/customer" replace />;
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (isVendor) {
      const vendor = demoVendors.find((v) => v.id === vendorId) || demoVendors[0];
      login({
        role: 'vendor',
        username: vendor.name,
        vendorId: vendor.id,
        vendorName: vendor.name,
      });
      navigate('/vendor', { replace: true });
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

  return (
    <div className="login-page">
      <header className="home-header">
        <h1 className="brand-title">OORUNII</h1>
        <p className="brand-subtitle">{isVendor ? 'Vendor Portal' : 'Customer Login'}</p>
      </header>

      <main className="login-content">
        <div className="login-card">
          <span className="role-icon">{isVendor ? '🛍️' : '🛒'}</span>
          <h2>{isVendor ? 'Vendor Sign In' : 'Customer Sign In'}</h2>
          <p className="login-note">
            {isVendor
              ? 'Select your vendor store to manage orders & live delivery.'
              : 'Select your account to continue shopping & tracking.'}
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">
                {isVendor ? 'Select Vendor Store' : 'Select Customer Account'}
              </label>
              {isVendor ? (
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
              {isVendor ? 'Sign In to Vendor Dashboard' : 'Sign In'}
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

