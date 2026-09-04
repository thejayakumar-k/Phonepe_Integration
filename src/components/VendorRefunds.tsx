import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getOrders } from '../utils/storage';
import { formatCurrency, formatDateTime } from '../utils/upi';
import type { Order, Refund, RefundStatus } from '../types/payment';

const REFUND_STORAGE_KEY = 'oorunii_refunds';

function getRefunds(): Refund[] {
  try {
    const data = localStorage.getItem(REFUND_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveRefund(refund: Refund): void {
  const refunds = getRefunds();
  const idx = refunds.findIndex((r) => r.id === refund.id);
  if (idx >= 0) {
    refunds[idx] = refund;
  } else {
    refunds.push(refund);
  }
  localStorage.setItem(REFUND_STORAGE_KEY, JSON.stringify(refunds));
}

const refundStatusLabel: Record<RefundStatus, string> = {
  INITIATED: 'Refund Initiated',
  PROCESSING: 'Processing (5–7 days)',
  COMPLETED: 'Refund Completed',
  FAILED: 'Refund Failed',
};

const refundStatusColor: Record<RefundStatus, string> = {
  INITIATED: 'refund-initiated',
  PROCESSING: 'refund-processing',
  COMPLETED: 'refund-completed',
  FAILED: 'refund-failed',
};

export function VendorRefunds() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [paidOrders, setPaidOrders] = useState<Order[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRefundModal, setShowRefundModal] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');

  useEffect(() => {
    const allOrders = Object.values(getOrders());
    const vendorPaid = allOrders.filter(
      (o) =>
        o.vendorId === session?.vendorId &&
        o.paymentStatus === 'PAID' &&
        o.paymentMethod === 'PAYU'
    );
    setPaidOrders(vendorPaid.sort((a, b) => b.createdAt - a.createdAt));
    setRefunds(getRefunds());
    setLoading(false);
  }, [session?.vendorId]);

  const handleInitiateRefund = useCallback(
    (order: Order) => {
      const amount = parseFloat(refundAmount);
      if (!Number.isFinite(amount) || amount <= 0 || amount > order.amount) {
        return;
      }
      if (!refundReason.trim()) return;

      const refund: Refund = {
        id: `REF${Date.now()}`,
        orderId: order.orderId,
        amount,
        reason: refundReason.trim(),
        status: 'INITIATED',
        initiatedAt: Date.now(),
        customerName: order.customerName,
        vendorId: session?.vendorId,
      };

      saveRefund(refund);
      setRefunds((prev) => [...prev, refund]);
      setShowRefundModal(null);
      setRefundReason('');
      setRefundAmount('');

      // Simulate PayU refund processing (in production, this would be an API call)
      // After a short delay, mark as PROCESSING
      setTimeout(() => {
        const updated = { ...refund, status: 'PROCESSING' as const };
        saveRefund(updated);
        setRefunds((prev) => prev.map((r) => (r.id === refund.id ? updated : r)));
      }, 2000);

      // Simulate completion after 5 seconds (for UAT demo)
      setTimeout(() => {
        const updated = {
          ...refund,
          status: 'COMPLETED' as const,
          completedAt: Date.now(),
          payuRefundId: `PAYU-REF-${Date.now()}`,
        };
        saveRefund(updated);
        setRefunds((prev) => prev.map((r) => (r.id === refund.id ? updated : r)));
      }, 8000);
    },
    [refundReason, refundAmount, session?.vendorId]
  );

  const openRefundModal = (orderId: string) => {
    const order = paidOrders.find((o) => o.orderId === orderId);
    if (order) {
      setRefundAmount(String(order.amount));
      setShowRefundModal(orderId);
    }
  };

  const totalRefunded = refunds
    .filter((r) => r.status === 'COMPLETED')
    .reduce((sum, r) => sum + r.amount, 0);

  const pendingRefunds = refunds.filter(
    (r) => r.status === 'INITIATED' || r.status === 'PROCESSING'
  ).length;

  if (loading) {
    return (
      <div className="vendor-refunds">
        <div className="v-ref-head">
          <h1 className="v-ref-title">Refunds</h1>
          <p className="v-ref-subtitle">Manage PayU refunds</p>
        </div>
        <div className="loading-state">Loading refunds...</div>
      </div>
    );
  }

  return (
    <div className="vendor-refunds">
      <div className="v-ref-head">
        <button className="back-btn" onClick={() => navigate('/vendor/payments')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <h1 className="v-ref-title">Refunds</h1>
          <p className="v-ref-subtitle">PayU refund management (UAT)</p>
        </div>
      </div>

      {/* Summary */}
      <div className="v-ref-summary">
        <div className="v-ref-summary-item">
          <span className="v-ref-summary-label">Total Refunded</span>
          <span className="v-ref-summary-value">{formatCurrency(totalRefunded)}</span>
        </div>
        <div className="v-ref-summary-item">
          <span className="v-ref-summary-label">Pending</span>
          <span className="v-ref-summary-value">{pendingRefunds}</span>
        </div>
      </div>

      {/* Eligible Orders */}
      <div className="v-ref-section">
        <h2 className="v-ref-section-title">Eligible Orders for Refund</h2>
        {paidOrders.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">💰</span>
            <p>No paid PayU orders eligible for refund</p>
          </div>
        ) : (
          <div className="v-ref-orders">
            {paidOrders.map((order) => {
              const alreadyRefunded = refunds.some(
                (r) => r.orderId === order.orderId && r.status !== 'FAILED'
              );
              return (
                <div key={order.orderId} className="v-ref-order-card">
                  <div className="v-ref-order-info">
                    <span className="v-ref-order-customer">
                      {order.customerName || order.customerId || 'Customer'}
                    </span>
                    <span className="v-ref-order-id">Order #{order.orderId}</span>
                    <span className="v-ref-order-date">
                      {formatDateTime(order.createdAt)}
                    </span>
                  </div>
                  <div className="v-ref-order-amount">{formatCurrency(order.amount)}</div>
                  <button
                    className="v-ref-btn"
                    onClick={() => openRefundModal(order.orderId)}
                    disabled={alreadyRefunded}
                  >
                    {alreadyRefunded ? 'Refunded' : 'Refund'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Refund History */}
      {refunds.length > 0 && (
        <div className="v-ref-section">
          <h2 className="v-ref-section-title">Refund History</h2>
          <div className="v-ref-list">
            {refunds
              .sort((a, b) => b.initiatedAt - a.initiatedAt)
              .map((refund) => (
                <div key={refund.id} className="v-ref-card">
                  <div className="v-ref-card-header">
                    <span className="v-ref-card-id">{refund.id}</span>
                    <span className={`v-ref-status ${refundStatusColor[refund.status]}`}>
                      {refundStatusLabel[refund.status]}
                    </span>
                  </div>
                  <div className="v-ref-card-body">
                    <div className="v-ref-card-row">
                      <span>Order</span>
                      <span>#{refund.orderId}</span>
                    </div>
                    <div className="v-ref-card-row">
                      <span>Customer</span>
                      <span>{refund.customerName || 'N/A'}</span>
                    </div>
                    <div className="v-ref-card-row">
                      <span>Amount</span>
                      <span className="v-ref-amount">{formatCurrency(refund.amount)}</span>
                    </div>
                    <div className="v-ref-card-row">
                      <span>Reason</span>
                      <span>{refund.reason}</span>
                    </div>
                    <div className="v-ref-card-row">
                      <span>Initiated</span>
                      <span>{formatDateTime(refund.initiatedAt)}</span>
                    </div>
                    {refund.completedAt && (
                      <div className="v-ref-card-row">
                        <span>Completed</span>
                        <span>{formatDateTime(refund.completedAt)}</span>
                      </div>
                    )}
                    {refund.payuRefundId && (
                      <div className="v-ref-card-row">
                        <span>PayU Refund ID</span>
                        <span className="v-ref-payu-id">{refund.payuRefundId}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="payu-modal-overlay" onClick={() => setShowRefundModal(null)}>
          <div className="payu-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payu-modal-header">
              <h3>Initiate Refund</h3>
              <button className="payu-modal-close" onClick={() => setShowRefundModal(null)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {(() => {
              const order = paidOrders.find((o) => o.orderId === showRefundModal);
              if (!order) return null;
              return (
                <div className="payu-modal-body">
                  <div className="payu-modal-info">
                    <span>Order #{order.orderId}</span>
                    <span>Customer: {order.customerName || 'N/A'}</span>
                    <span>Original: {formatCurrency(order.amount)}</span>
                  </div>

                  <label className="payu-label">Refund Amount</label>
                  <div className="payu-amount-input-wrap">
                    <span className="payu-currency">₹</span>
                    <input
                      className="payu-amount-input"
                      type="number"
                      min="1"
                      max={order.amount}
                      step="1"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                    />
                  </div>
                  <span className="payu-hint">
                    Max refund: {formatCurrency(order.amount)}
                  </span>

                  <label className="payu-label">Reason</label>
                  <textarea
                    className="payu-textarea"
                    placeholder="Enter reason for refund..."
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    rows={3}
                  />

                  <div className="payu-modal-actions">
                    <button className="payu-btn-secondary" onClick={() => setShowRefundModal(null)}>
                      Cancel
                    </button>
                    <button
                      className="payu-btn-danger"
                      onClick={() => handleInitiateRefund(order)}
                      disabled={!refundReason.trim() || !refundAmount}
                    >
                      Initiate Refund
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
