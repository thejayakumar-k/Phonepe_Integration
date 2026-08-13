import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth, type Role } from '../auth/AuthContext';
import { demoVendors, demoCustomers, getCustomerOrderId, startFreshPayment } from '../data/demo';

export function Login() {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [vendorId, setVendorId] = useState(demoVendors[0].id);
  const [customerId, setCustomerId] = useState(demoCustomers[0].id);

  if (role !== 'vendor' && role !== 'customer') {
    return <Navigate to="/" replace />;
  }

  const isVendor = role === 'vendor';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    const vendor = demoVendors.find((v) => v.id === vendorId);
    const customer = demoCustomers.find((c) => c.id === customerId);

    login({
      role: role as Role,
      username: username.trim(),
      vendorId: isVendor ? vendor?.id : undefined,
      vendorName: isVendor ? vendor?.name : undefined,
      customerId: isVendor ? undefined : customer?.id,
      customerName: isVendor ? undefined : customer?.name,
    });

    if (isVendor) {
      navigate('/vendor', { replace: true });
      return;
    }

    // Customer: always start a fresh payment session on login
    const orderId = getCustomerOrderId(customer?.id);
    const freshOrder = startFreshPayment(orderId);
    navigate(`/pay?orderId=${freshOrder.orderId}`, { replace: true });
  };

  return (
    <div className="login-page">
      <header className="home-header">
        <h1 className="brand-title">OORUNII</h1>
        <p className="brand-subtitle">{isVendor ? 'Vendor Login' : 'Customer Login'}</p>
      </header>

      <main className="login-content">
        <div className="login-card">
          <span className="role-icon">{isVendor ? '🛍️' : '🛒'}</span>
          <h2>{isVendor ? 'Vendor Sign In' : 'Customer Sign In'}</h2>
          <p className="login-note">Demo mode - any username & password work.</p>

          <form onSubmit={handleSubmit}>
            {isVendor ? (
              <div className="form-group">
                <label className="form-label">Select Vendor Store</label>
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
              </div>
            ) : (
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
            )}

            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
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
