import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getOrders } from '../utils/storage';
import type { Order } from '../types/payment';

export function VendorSettings() {
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const [revenue, setRevenue] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getOrders().then((all) => {
      if (cancelled) return;
      const paid = all.filter(
        (o: Order) => o.vendorId === session?.vendorId && o.paymentStatus === 'PAID'
      );
      setRevenue(paid.reduce((sum, o) => sum + o.amount, 0));
    });
    return () => {
      cancelled = true;
    };
  }, [session?.vendorId]);

  return (
    <div className="vendor-settings">
      <div className="v-set-head">
        <h1 className="v-set-title">Settings</h1>
        <p className="v-set-subtitle">Manage your store account</p>
      </div>

      {/* Profile Card */}
      <div className="v-set-profile">
        <div className="v-set-avatar">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <div className="v-set-profile-info">
          <h3 className="v-set-name">{session?.vendorName || 'Demo Vendor'}</h3>
          <p className="v-set-sub">{session?.vendorId || session?.username || ''}</p>
        </div>
      </div>

      {/* Wallet Card */}
      <div className="v-set-wallet">
        <div className="v-set-wallet-top">
          <span className="v-set-wallet-label">Total Revenue</span>
          <span className="v-set-wallet-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          </span>
        </div>
        <div className="v-set-wallet-amount">₹{revenue.toFixed(2)}</div>
        <div className="v-set-wallet-sub">Accumulated from verified payments</div>
        <button className="v-set-withdraw" onClick={() => alert('Withdraw coming soon!')}>
          Withdraw
        </button>
      </div>

      {/* Menu Items */}
      <div className="v-set-menu">
        <button className="v-set-menu-item" onClick={() => navigate('/vendor/payments')}>
          <span className="v-set-menu-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          </span>
          <span className="v-set-menu-label">Transaction History</span>
          <span className="v-set-menu-arrow">›</span>
        </button>
        <button className="v-set-menu-item" onClick={() => alert('Edit Profile coming soon!')}>
          <span className="v-set-menu-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </span>
          <span className="v-set-menu-label">Edit Profile</span>
          <span className="v-set-menu-arrow">›</span>
        </button>
        <button className="v-set-menu-item" onClick={() => alert('Help & Support coming soon!')}>
          <span className="v-set-menu-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </span>
          <span className="v-set-menu-label">Help & Support</span>
          <span className="v-set-menu-arrow">›</span>
        </button>
      </div>

      {/* Logout */}
      <button className="v-btn-logout" onClick={() => { logout(); navigate('/'); }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Logout
      </button>
    </div>
  );
}
