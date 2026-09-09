import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getOrders, getItemOrders } from '../utils/storage';
import type { Order, ItemOrder } from '../types/payment';

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
  const [itemOrders, setItemOrders] = useState<ItemOrder[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [allOrders, allItemOrders] = await Promise.all([getOrders(), getItemOrders()]);
      if (cancelled) return;
      const vendorOrders = allOrders.filter((o) => o.vendorId === session?.vendorId);
      setOrders(vendorOrders.sort((a, b) => b.createdAt - a.createdAt));

      const vendorItemOrders = allItemOrders.filter((io) => io.vendorId === session?.vendorId);
      setItemOrders(vendorItemOrders.sort((a, b) => b.createdAt - a.createdAt));
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session?.vendorId]);

  const paidOrders = orders.filter((o) => o.paymentStatus === 'PAID');
  const paidItemOrders = itemOrders.filter((io) => io.status === 'PAID' || io.status === 'OUT_FOR_DELIVERY' || io.status === 'DELIVERED');

  const totalRevenue =
    paidOrders.reduce((sum, o) => sum + o.amount, 0) +
    paidItemOrders.reduce((sum, io) => sum + io.total, 0);

  const pendingCount =
    orders.filter((o) => o.paymentStatus === 'PENDING' || o.paymentStatus === 'CUSTOMER_SUBMITTED').length +
    itemOrders.filter((io) => io.status === 'PENDING' || io.status === 'NOT_PAID').length;

  const totalOrdersCount = orders.length + itemOrders.length;
  const readyForDeliveryCount = itemOrders.filter((io) => io.status === 'PAID').length;
  const activeDeliveryCount = itemOrders.filter((io) => io.status === 'OUT_FOR_DELIVERY').length;

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
          <span className="vh-hero-badge">{paidOrders.length + paidItemOrders.length} payments</span>
        </div>
        <div className="vh-hero-amount">₹{totalRevenue.toFixed(2)}</div>
        <div className="vh-hero-sub">Earnings from verified store orders & payments</div>
      </div>

      {/* Delivery Quick Banner */}
      {(readyForDeliveryCount > 0 || activeDeliveryCount > 0) && (
        <button
          className="vh-pending-banner"
          style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', marginBottom: '1rem' }}
          onClick={() => navigate('/vendor/orders')}
        >
          <span className="vhp-icon" style={{ fontSize: '1.25rem' }}>🛵</span>
          <span className="vhp-text" style={{ fontWeight: 600 }}>
            {activeDeliveryCount > 0
              ? `${activeDeliveryCount} delivery currently active in progress`
              : `${readyForDeliveryCount} order${readyForDeliveryCount > 1 ? 's' : ''} ready to deliver`}
          </span>
          <span className="vhp-arrow">Start →</span>
        </button>
      )}

      {/* Stats Grid */}
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
            <span className="vh-stat-value">{totalOrdersCount}</span>
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

      {/* Quick Action Shortcuts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate('/vendor/orders')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.85rem 1rem',
            background: 'var(--card-bg, #1a1e29)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600,
            textAlign: 'left'
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>🛵</span>
          <span>Live Delivery & Orders</span>
        </button>

        <button
          onClick={() => navigate('/vendor/payments')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.85rem 1rem',
            background: 'var(--card-bg, #1a1e29)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600,
            textAlign: 'left'
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>💳</span>
          <span>Payment History</span>
        </button>
      </div>

      {/* Recent Orders / Deliveries */}
      <div className="vh-section-head">
        <h2 className="vh-section-title">Recent Orders</h2>
        <button className="vh-view-all" onClick={() => navigate('/vendor/orders')}>
          View All
        </button>
      </div>

      {itemOrders.length === 0 && orders.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🛍️</span>
          <p>No customer orders placed yet</p>
          <small style={{ color: '#888', marginTop: '0.25rem', display: 'block' }}>
            Customer orders from the store will show here for real-time delivery
          </small>
        </div>
      ) : (
        <div className="vh-payments">
          {itemOrders.slice(0, 4).map((io) => (
            <div
              key={io.id}
              className="vh-payment"
              onClick={() => navigate('/vendor/orders')}
              style={{ cursor: 'pointer' }}
            >
              <span className="vh-payment-icon" style={{ background: io.status === 'OUT_FOR_DELIVERY' ? 'rgba(16, 185, 129, 0.2)' : undefined }}>
                {io.status === 'OUT_FOR_DELIVERY' ? '🛵' : '📦'}
              </span>
              <div className="vh-payment-info">
                <span className="vh-payment-customer">
                  {io.items.map((i) => `${i.qty}x ${i.name}`).join(', ')}
                </span>
                <span className="vh-payment-date">
                  {formatDate(io.createdAt)} · <strong style={{ color: io.status === 'PAID' ? '#10b981' : io.status === 'OUT_FOR_DELIVERY' ? '#3b82f6' : '#f59e0b' }}>{io.status}</strong>
                </span>
              </div>
              <span className="vh-payment-amount">₹{io.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

