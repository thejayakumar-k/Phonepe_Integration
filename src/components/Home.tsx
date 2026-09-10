import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function Home() {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<string | null>(null);

  const roles = [
    {
      id: 'vendor',
      emoji: '🛍️',
      title: 'Vendor Login',
      desc: 'Manage orders, pricing & live deliveries',
      gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      glow: 'rgba(99,102,241,0.35)',
      accent: '#8b5cf6',
      badge: 'Store Management',
      features: ['Live Orders', 'Pricing Config', 'Payments'],
    },
    {
      id: 'customer',
      emoji: '🛒',
      title: 'Customer Login',
      desc: 'Shop, pay & track your orders in real-time',
      gradient: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
      glow: 'rgba(6,182,212,0.35)',
      accent: '#06b6d4',
      badge: 'Shopping Portal',
      features: ['Browse Products', 'Secure Payments', 'Order Tracking'],
    },
    {
      id: 'delivery',
      emoji: '🛵',
      title: 'Delivery Partner',
      desc: 'Accept deliveries & share your live location',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      glow: 'rgba(16,185,129,0.35)',
      accent: '#10b981',
      badge: 'Driver Portal',
      features: ['Assigned Orders', 'Live Tracking', 'Earnings'],
    },
  ];

  return (
    <div className="web-login-page">
      {/* Animated gradient background */}
      <div className="web-login-bg">
        <div className="web-login-bg-blob web-blob-1"></div>
        <div className="web-login-bg-blob web-blob-2"></div>
        <div className="web-login-bg-blob web-blob-3"></div>
        <div className="web-login-grid"></div>
      </div>

      {/* Top Navigation Bar */}
      <nav className="web-login-nav">
        <div className="web-login-nav-brand">
          <div className="web-login-nav-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="web-login-nav-name">OORUNII</span>
          <span className="web-login-nav-tag">UPI Platform</span>
        </div>
        <div className="web-login-nav-right">
          <span className="web-login-nav-status">
            <span className="web-status-dot"></span>
            Live Demo
          </span>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="web-login-hero">
        <div className="web-login-hero-content">
          <div className="web-login-hero-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Secure · PhonePe Integrated · Real-time
          </div>

          <h1 className="web-login-hero-title">
            Welcome to <span className="web-login-hero-brand">OORUNII</span>
          </h1>
          <p className="web-login-hero-sub">
            Choose your portal to continue. Each role gives you a tailored experience<br/>built for seamless UPI-powered commerce.
          </p>
        </div>

        {/* Role Cards Grid */}
        <div className="web-login-cards">
          {roles.map((role) => (
            <button
              key={role.id}
              className={`web-login-card ${hovered === role.id ? 'web-login-card-hovered' : ''}`}
              style={{ '--card-glow': role.glow } as React.CSSProperties}
              onMouseEnter={() => setHovered(role.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => navigate(`/login/${role.id}`)}
            >
              {/* Card top gradient bar */}
              <div className="web-card-top-bar" style={{ background: role.gradient }}></div>

              {/* Badge */}
              <div className="web-card-badge" style={{ color: role.accent, background: `${role.accent}18` }}>
                {role.badge}
              </div>

              {/* Emoji icon */}
              <div className="web-card-emoji-wrap" style={{ background: `${role.accent}15`, border: `2px solid ${role.accent}30` }}>
                <span className="web-card-emoji">{role.emoji}</span>
              </div>

              {/* Title & desc */}
              <h2 className="web-card-title">{role.title}</h2>
              <p className="web-card-desc">{role.desc}</p>

              {/* Features */}
              <div className="web-card-features">
                {role.features.map((f) => (
                  <span key={f} className="web-card-feature-chip" style={{ color: role.accent, borderColor: `${role.accent}30`, background: `${role.accent}08` }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill={role.accent} stroke="none">
                      <circle cx="12" cy="12" r="6"/>
                    </svg>
                    {f}
                  </span>
                ))}
              </div>

              {/* CTA */}
              <div className="web-card-cta" style={{ background: role.gradient }}>
                <span>Sign In</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </div>

              {/* Hover glow */}
              <div className="web-card-glow-overlay"></div>
            </button>
          ))}
        </div>

        {/* Stats Row */}
        <div className="web-login-stats">
          {[
            { value: '3', label: 'Portals', icon: '🏪' },
            { value: 'UPI', label: 'Payments', icon: '💳' },
            { value: 'Live', label: 'Tracking', icon: '📍' },
            { value: '100%', label: 'Secure', icon: '🔐' },
          ].map((stat) => (
            <div key={stat.label} className="web-login-stat">
              <span className="web-stat-icon">{stat.icon}</span>
              <span className="web-stat-value">{stat.value}</span>
              <span className="web-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="web-login-footer">
        <p>© 2025 OORUNII · PhonePe Payment Platform · Demo Mode</p>
        <p>Need help? <a href="mailto:support@oorunii.com">support@oorunii.com</a></p>
      </footer>
    </div>
  );
}
