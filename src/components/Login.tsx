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
  const [isLoading, setIsLoading] = useState(false);

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
    setIsLoading(true);

    setTimeout(() => {
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
    }, 800);
  };

  const roleConfig = {
    vendor: {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
      title: 'Vendor Portal',
      subtitle: 'Manage your store, orders & deliveries',
      gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
      accent: '#8b5cf6',
      selectLabel: 'Select Vendor Store',
      btnText: 'Access Vendor Dashboard',
      options: demoVendors.map(v => ({ value: v.id, label: `${v.name} (${v.id})` })),
      value: vendorId,
      onChange: setVendorId,
    },
    customer: {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1"/>
          <circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
      ),
      title: 'Customer Portal',
      subtitle: 'Shop, order & track your deliveries',
      gradient: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 50%, #22d3ee 100%)',
      accent: '#06b6d4',
      selectLabel: 'Select Customer Account',
      btnText: 'Continue Shopping',
      options: demoCustomers.map(c => ({ value: c.id, label: `${c.name} (${c.id})` })),
      value: customerId,
      onChange: setCustomerId,
    },
    delivery: {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="1"/>
          <path d="M16 8h4l3 5v3h-7V8z"/>
          <circle cx="5.5" cy="18.5" r="2.5"/>
          <circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
      ),
      title: 'Delivery Partner',
      subtitle: 'Manage deliveries & share live location',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
      accent: '#10b981',
      selectLabel: 'Select Delivery Partner Profile',
      btnText: 'Start Delivery Shift',
      options: demoDeliveryPartners.map(dp => ({ value: dp.id, label: `${dp.name} (${dp.id})` })),
      value: partnerId,
      onChange: setPartnerId,
    },
  };

  const config = roleConfig[role];

  return (
    <div className="login-page-new">
      {/* Animated Background */}
      <div className="login-bg">
        <div className="login-bg-orb login-bg-orb-1" style={{ background: config.accent }}></div>
        <div className="login-bg-orb login-bg-orb-2" style={{ background: config.accent }}></div>
        <div className="login-bg-orb login-bg-orb-3"></div>
        <div className="login-bg-grid"></div>
      </div>

      {/* Content */}
      <div className="login-wrapper">
        {/* Logo / Brand */}
        <div className="login-brand">
          <div className="login-brand-logo" style={{ background: config.gradient }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="login-brand-name">OORUNII</span>
        </div>

        {/* Card */}
        <div className="login-card-new">
          {/* Card Header */}
          <div className="login-card-header" style={{ background: config.gradient }}>
            <div className="login-card-icon">
              {config.icon}
            </div>
            <div className="login-card-header-text">
              <h1 className="login-card-title">{config.title}</h1>
              <p className="login-card-subtitle">{config.subtitle}</p>
            </div>
          </div>

          {/* Card Body */}
          <div className="login-card-body">
            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-field">
                <label className="login-label">{config.selectLabel}</label>
                <div className="login-select-wrap">
                  <div className="login-select-icon" style={{ color: config.accent }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <select
                    className="login-select"
                    value={config.value}
                    onChange={(e) => config.onChange(e.target.value)}
                    style={{ '--focus-color': config.accent } as React.CSSProperties}
                  >
                    {config.options.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <div className="login-select-arrow">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </div>
              </div>

              <div className="login-demo-note">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Demo mode — select a profile to continue
              </div>

              <button
                type="submit"
                className="login-btn"
                disabled={isLoading}
                style={{ background: config.gradient }}
              >
                {isLoading ? (
                  <>
                    <span className="login-spinner"></span>
                    Signing in...
                  </>
                ) : (
                  <>
                    {config.btnText}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="login-divider">
              <span>or switch role</span>
            </div>

            {/* Role Switcher */}
            <div className="login-role-switch">
              {role !== 'vendor' && (
                <Link to="/login/vendor" className="login-role-chip" style={{ '--chip-color': '#8b5cf6' } as React.CSSProperties}>
                  🛍️ Vendor
                </Link>
              )}
              {role !== 'customer' && (
                <Link to="/login/customer" className="login-role-chip" style={{ '--chip-color': '#06b6d4' } as React.CSSProperties}>
                  🛒 Customer
                </Link>
              )}
              {role !== 'delivery' && (
                <Link to="/login/delivery" className="login-role-chip" style={{ '--chip-color': '#10b981' } as React.CSSProperties}>
                  🛵 Delivery
                </Link>
              )}
            </div>

            <Link to="/" className="login-back-new">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"/>
                <polyline points="12 19 5 12 12 5"/>
              </svg>
              Back to Home
            </Link>
          </div>
        </div>

        <p className="login-footer-note">Secure Demo Platform · OORUNII © 2025</p>
      </div>
    </div>
  );
}
