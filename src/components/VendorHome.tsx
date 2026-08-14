import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getOrders } from '../utils/storage';
import type { Order } from '../types/payment';

function formatDate(value: number): string {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function VendorHome() {
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const load = () => {
      const all = Object.values(getOrders()).filter(
        (o) => o.vendorId === session?.vendorId
      );
      setOrders(all.sort((a, b) => b.createdAt - a.createdAt));
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [session?.vendorId]);

  const paidOrders = orders.filter((o) => o.paymentStatus === 'PAID');
  const revenue = paidOrders.reduce((sum, o) => sum + o.amount, 0);
  const pendingCount = orders.filter(
    (o) => o.paymentStatus === 'PENDING' || o.paymentStatus === 'CUSTOMER_SUBMITTED'
  ).length;
  const recent = paidOrders.slice(0, 3);

  return (
    <div className="vendor-home">
      {/* Header */}
      <header className="vendor-home-header">
        <div className="vh-avatar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <div className="vh-info">
          <h1 className="vh-name">{session?.vendorName || 'Vendor'}</h1>
          <span className="vh-id">ID: {session?.vendorId || '—'}</span>
        </div>
        <button className="vh-logout" onClick={() => { logout(); navigate('/'); }} aria-label="Logout">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </header>

      {/* Revenue Hero */}
      <div className="vh-hero">
        <div className="vh-hero-top">
          <span className="vh-hero-label">Total Revenue</span>
          <span className="vh-hero-badge">{paidOrders.length} payments</span>
        </div>
        <div className="vh-hero-amount">₹{revenue.toFixed(2)}</div>
        <div className="vh-hero-sub">Earnings from verified payments</div>
      </div>

      {/* Stats */}
      <div className="vh-stats">
        <button className="vh-stat" onClick={() => navigate('/vendor/orders')}>
          <span className="vh-stat-icon vh-stat-orders">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </span>
          <div className="vh-stat-body">
            <span className="vh-stat-value">{orders.length}</span>
            <span className="vh-stat-label">Total Orders</span>
          </div>
        </button>

        <button className="vh-stat" onClick={() => navigate('/vendor/orders')}>
          <span className="vh-stat-icon vh-stat-pending">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </span>
          <div className="vh-stat-body">
            <span className="vh-stat-value">{pendingCount}</span>
            <span className="vh-stat-label">Awaiting Action</span>
          </div>
        </button>
      </div>

      {/* Pending banner */}
      {pendingCount > 0 && (
        <button className="vh-pending-banner" onClick={() => navigate('/vendor/orders')}>
          <span className="vhp-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </span>
          <span className="vhp-text">
            {pendingCount} payment{pendingCount > 1 ? 's' : ''} awaiting verification
          </span>
          <span className="vhp-arrow">→</span>
        </button>
      )}

      {/* Recent Payments */}
      <div className="vh-section-head">
        <h2 className="vh-section-title">Recent Payments</h2>
        <button className="vh-view-all" onClick={() => navigate('/vendor/payments')}>
          View All
        </button>
      </div>

      {recent.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">💳</span>
          <p>No payments received yet</p>
        </div>
      ) : (
        <div className="vh-payments">
          {recent.map((order) => (
            <div key={order.orderId} className="vh-payment">
              <span className="vh-payment-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </span>
              <div className="vh-payment-info">
                <span className="vh-payment-customer">
                  {order.customerName || order.customerId || 'Customer'}
                </span>
                <span className="vh-payment-date">{formatDate(order.createdAt)}</span>
              </div>
              <span className="vh-payment-amount">+₹{order.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
