import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getOrders, updateOrderStatus } from '../utils/storage';
import type { Order, PaymentStatus } from '../types/payment';

const statusLabel: Record<string, string> = {
  PENDING: 'Not Paid',
  CUSTOMER_SUBMITTED: 'Payment Verification',
  PAID: 'Paid',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
  COD_PLACED: 'COD · Not Paid',
  CANCELLED: 'Cancelled',
};

const statusColor: Record<string, string> = {
  PENDING: 'v-order-status-pending',
  CUSTOMER_SUBMITTED: 'v-order-status-submitted',
  PAID: 'v-order-status-paid',
  FAILED: 'v-order-status-failed',
  EXPIRED: 'v-order-status-expired',
  COD_PLACED: 'v-order-status-cod',
  CANCELLED: 'v-order-status-cancelled',
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'PAID') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    );
  }
  if (status === 'COD_PLACED') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    );
  }
  if (status === 'FAILED' || status === 'EXPIRED' || status === 'CANCELLED') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

type FilterType = 'all' | 'notpaid' | 'paid' | 'failed';

export function VendorPayments() {
  const { session } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    const fetchOrders = () => {
      const ordersRecord = getOrders();
      const allOrders = Object.values(ordersRecord);
      const vendorOrders = allOrders.filter(
        (order) => order.vendorId === session?.vendorId
      );
      setOrders(vendorOrders.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [session?.vendorId]);

  const handleMarkPaid = (orderId: string) => {
    updateOrderStatus(orderId, 'PAID');
    setOrders((prev) =>
      prev.map((o) =>
        o.orderId === orderId ? { ...o, paymentStatus: 'PAID' as PaymentStatus } : o
      )
    );
  };

  const handleMarkFailed = (orderId: string) => {
    updateOrderStatus(orderId, 'FAILED');
    setOrders((prev) =>
      prev.map((o) =>
        o.orderId === orderId ? { ...o, paymentStatus: 'FAILED' as PaymentStatus } : o
      )
    );
  };

  const totalPaid = orders
    .filter((order) => order.paymentStatus === 'PAID')
    .reduce((sum, order) => sum + order.amount, 0);
  const paidCount = orders.filter((o) => o.paymentStatus === 'PAID').length;
  const pendingCount = orders.filter(
    (o) =>
      o.paymentStatus === 'PENDING' ||
      o.paymentStatus === 'CUSTOMER_SUBMITTED' ||
      o.paymentStatus === 'COD_PLACED'
  ).length;
  const failedCount = orders.filter(
    (o) =>
      o.paymentStatus === 'FAILED' ||
      o.paymentStatus === 'EXPIRED' ||
      o.paymentStatus === 'CANCELLED'
  ).length;

  const filteredOrders = orders.filter((order) => {
    if (filter === 'all') return true;
    if (filter === 'notpaid')
      return (
        order.paymentStatus === 'PENDING' ||
        order.paymentStatus === 'CUSTOMER_SUBMITTED' ||
        order.paymentStatus === 'COD_PLACED'
      );
    if (filter === 'paid') return order.paymentStatus === 'PAID';
    if (filter === 'failed')
      return (
        order.paymentStatus === 'FAILED' ||
        order.paymentStatus === 'EXPIRED' ||
        order.paymentStatus === 'CANCELLED'
      );
    return true;
  });

  if (loading) {
    return (
      <div className="vendor-payments">
        <div className="v-pay-head">
          <h1 className="v-pay-title">Transaction History</h1>
          <p className="v-pay-subtitle">All store transactions</p>
        </div>
        <div className="loading-state">Loading transactions...</div>
      </div>
    );
  }

  return (
    <div className="vendor-payments">
      <div className="v-pay-head">
        <h1 className="v-pay-title">Transaction History</h1>
        <p className="v-pay-subtitle">All store transactions</p>
      </div>

      {/* Summary Card */}
      <div className="v-pay-summary">
        <div className="v-pay-summary-top">
          <span className="v-pay-summary-label">Total Received</span>
          <span className="v-pay-summary-badge">{orders.length} transactions</span>
        </div>
        <div className="v-pay-summary-value">₹{totalPaid.toFixed(2)}</div>
        <div className="v-pay-summary-sub">
          {paidCount} verified · {pendingCount} awaiting action
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({orders.length})
        </button>
        <button
          className={`filter-tab ${filter === 'notpaid' ? 'active' : ''}`}
          onClick={() => setFilter('notpaid')}
        >
          Not Paid ({pendingCount})
        </button>
        <button
          className={`filter-tab ${filter === 'paid' ? 'active' : ''}`}
          onClick={() => setFilter('paid')}
        >
          Paid ({paidCount})
        </button>
        <button
          className={`filter-tab ${filter === 'failed' ? 'active' : ''}`}
          onClick={() => setFilter('failed')}
        >
          Failed ({failedCount})
        </button>
      </div>

      {/* Transactions List */}
      <div className="v-pay-list-title">Transactions</div>

      {filteredOrders.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">💳</span>
          <p>No transactions found</p>
        </div>
      ) : (
        <div className="v-pay-list">
          {filteredOrders.map((order) => {
            const isUnpaid =
              order.paymentStatus === 'PENDING' ||
              order.paymentStatus === 'CUSTOMER_SUBMITTED' ||
              order.paymentStatus === 'COD_PLACED';
            return (
              <div key={order.orderId} className="v-pay-card">
                <span className="v-pay-icon">
                  <StatusIcon status={order.paymentStatus} />
                </span>
                <div className="v-pay-info">
                  <span className="v-pay-customer">
                    {order.customerName || order.customerId || 'Customer'}
                  </span>
                  <span className="v-pay-order-id">Order #{order.orderId}</span>
                  <span className={`v-order-status ${statusColor[order.paymentStatus] || ''}`}>
                    {statusLabel[order.paymentStatus] || order.paymentStatus}
                  </span>
                  <span className="v-pay-date">
                    {new Date(order.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <span className="v-pay-amount">₹{order.amount.toFixed(2)}</span>
                {isUnpaid && (
                  <div className="v-order-actions v-order-actions-inline">
                    <button
                      className="v-btn-paid"
                      onClick={() => handleMarkPaid(order.orderId)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Mark Paid
                    </button>
                    <button
                      className="v-btn-failed"
                      onClick={() => handleMarkFailed(order.orderId)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                      Not Paid
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
