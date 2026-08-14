import { useState, useEffect, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { demoVendors, demoCustomers } from '../data/demo';

export function Login() {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const { session, login } = useAuth();

  const [customerId, setCustomerId] = useState(demoCustomers[0].id);

  const isVendor = role === 'vendor';

  useEffect(() => {
    if (!isVendor || session?.role === 'vendor') return;

    const vendor = demoVendors[0];
    login({
      role: 'vendor',
      username: vendor.name,
      vendorId: vendor.id,
      vendorName: vendor.name,
    });
  }, [isVendor, session?.role, login]);

  if (role !== 'vendor' && role !== 'customer') {
    return <Navigate to="/" replace />;
  }

  if (isVendor) {
    if (session?.role === 'vendor') {
      return <Navigate to="/vendor" replace />;
    }
    return null;
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const customer = demoCustomers.find((c) => c.id === customerId);

    login({
      role: 'customer',
      username: customer?.name || 'Customer',
      customerId: customer?.id,
      customerName: customer?.name,
    });

    navigate('/customer', { replace: true });
  };

  return (
    <div className="login-page">
      <header className="home-header">
        <h1 className="brand-title">OORUNII</h1>
        <p className="brand-subtitle">Customer Login</p>
      </header>

      <main className="login-content">
        <div className="login-card">
          <span className="role-icon">🛒</span>
          <h2>Customer Sign In</h2>
          <p className="login-note">Select your account to continue.</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Select Customer Account</label>
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
            </div>

            <button type="submit" className="btn btn-login">
              Sign In
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
