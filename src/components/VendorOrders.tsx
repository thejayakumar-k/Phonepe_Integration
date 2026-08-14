import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getOrders, updateOrderStatus } from '../utils/storage';
import type { Order, PaymentStatus } from '../types/payment';

const statusLabel: Record<string, string> = {
  PENDING: 'Not Paid',
  CUSTOMER_SUBMITTED: 'Not Paid',
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

export function VendorOrders() {
  const { session } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'notpaid' | 'paid' | 'failed'>('all');

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
  }, [session?.vendorId]);

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

  const handleMarkPaid = (orderId: string) => {
    updateOrderStatus(orderId, 'PAID');
    setOrders(orders.map((o) =>
      o.orderId === orderId ? { ...o, paymentStatus: 'PAID' as PaymentStatus } : o
    ));
  };

  const handleMarkFailed = (orderId: string) => {
    updateOrderStatus(orderId, 'FAILED');
    setOrders(orders.map((o) =>
      o.orderId === orderId ? { ...o, paymentStatus: 'FAILED' as PaymentStatus } : o
    ));
  };

  const pendingCount = orders.filter(
    (o) =>
      o.paymentStatus === 'PENDING' ||
      o.paymentStatus === 'CUSTOMER_SUBMITTED' ||
      o.paymentStatus === 'COD_PLACED'
  ).length;
  const paidCount = orders.filter((o) => o.paymentStatus === 'PAID').length;
  const failedCount = orders.filter(
    (o) =>
      o.paymentStatus === 'FAILED' ||
      o.paymentStatus === 'EXPIRED' ||
      o.paymentStatus === 'CANCELLED'
  ).length;

  if (loading) {
    return (
      <div className="vendor-orders">
        <div className="loading-state">Loading orders...</div>
      </div>
    );
  }

  return (
    <div className="vendor-orders">
      <div className="v-orders-head">
        <h1 className="v-orders-title">Orders</h1>
        <p className="v-orders-subtitle">{orders.length} total orders</p>
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

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📋</span>
          <p>No orders found</p>
        </div>
      ) : (
        <div className="v-orders-list">
          {filteredOrders.map((order) => (
            <div key={order.orderId} className="v-order-card">
              <div className="v-order-top">
                <span className="v-order-id">#{order.orderId.slice(-8)}</span>
                <span className={`v-order-status ${statusColor[order.paymentStatus] || ''}`}>
                  {statusLabel[order.paymentStatus] || order.paymentStatus}
                </span>
              </div>

              <div className="v-order-main">
                <span className="v-order-amount">₹{order.amount.toFixed(2)}</span>
                <span className="v-order-customer">
                  {order.customerName || order.customerId || 'Customer'}
                </span>
              </div>

              <div className="v-order-meta">
                <span className="v-order-date">
                  {new Date(order.createdAt).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="v-order-method">
                  {order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'UPI'}
                </span>
              </div>

              {order.paymentStatus === 'PENDING' && (
                <div className="v-order-actions">
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
                    Mark Failed
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
