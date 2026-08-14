import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getMargin } from '../utils/storage';

export function CustomerSettings() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [margin] = useState(() => getMargin(session?.customerId));

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="customer-settings">
      <div className="settings-header">
        <h1>Settings</h1>
      </div>

      <div className="settings-content">
        {/* Profile Section */}
        <div className="settings-section">
          <div className="profile-card">
            <div className="profile-avatar">
              {session?.customerName?.charAt(0) || 'C'}
            </div>
            <div className="profile-info">
              <p className="profile-name">{session?.customerName || 'Customer'}</p>
              <p className="profile-id">{session?.customerId || 'CUST001'}</p>
            </div>
          </div>
        </div>

        {/* Wallet Section */}
        <div className="wallet-card">
          <div className="wallet-header">
            <div className="wallet-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
              </svg>
            </div>
            <span className="wallet-title">OORUNII Wallet</span>
          </div>
          <div className="wallet-balance-section">
            <span className="wallet-balance-label">Available Balance</span>
            <span className="wallet-balance-amount">₹{margin.toFixed(2)}</span>
          </div>
          <div className="wallet-actions">
            <button className="wallet-btn add" onClick={() => navigate('/customer/add-money')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Money
            </button>
            <button className="wallet-btn withdraw" onClick={() => alert('Withdraw coming soon!')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <polyline points="19 12 12 19 5 12"/>
              </svg>
              Withdraw
            </button>
          </div>
        </div>

        {/* Menu Items */}
        <div className="settings-section menu-no-padding">
          <button className="menu-item" onClick={() => alert('Edit Profile coming soon!')}>
            <div className="menu-left">
              <span className="menu-icon">✏️</span>
              <span className="menu-label">Edit Profile</span>
            </div>
            <svg className="menu-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <button className="menu-item" onClick={() => navigate('/customer/orders')}>
            <div className="menu-left">
              <span className="menu-icon">📋</span>
              <span className="menu-label">My Orders</span>
            </div>
            <svg className="menu-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <button className="menu-item" onClick={() => navigate('/customer/history')}>
            <div className="menu-left">
              <span className="menu-icon">💳</span>
              <span className="menu-label">Transaction History</span>
            </div>
            <svg className="menu-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <button className="menu-item" onClick={() => alert('Help & Support coming soon!')}>
            <div className="menu-left">
              <span className="menu-icon">❓</span>
              <span className="menu-label">Help & Support</span>
            </div>
            <svg className="menu-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        {/* Logout */}
        <div className="settings-section">
          <button className="settings-btn danger full-width" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
