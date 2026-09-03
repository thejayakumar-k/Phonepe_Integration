import { useState, useEffect } from 'react';
import type { Order } from '../types/payment';
import { getOrders, updateOrderStatus } from '../utils/storage';
import { formatCurrency, formatDateTime } from '../utils/upi';

interface OrdersPanelProps {
  vendorId?: string;
}

export function OrdersPanel({ vendorId }: OrdersPanelProps) {
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [transactionId, setTransactionId] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadOrders = () => {
    const all = getOrders();
    if (vendorId) {
      setOrders(
        Object.fromEntries(
          Object.entries(all).filter(([, o]) => o.vendorId === vendorId)
        )
      );
    } else {
      setOrders(all);
    }
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [vendorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVerify = (orderId: string, status: 'PAID' | 'FAILED') => {
    const updated = updateOrderStatus(orderId, status, transactionId || undefined);
    if (updated) {
      setMessage({
        type: 'success',
        text: `Order ${orderId} marked as ${status}`,
      });
      setSelectedOrderId('');
      setTransactionId('');
      loadOrders();

      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: 'error', text: 'Failed to update order' });
    }
  };

  const orderList = Object.values(orders);
  const pendingOrders = orderList.filter((o) => o.paymentStatus === 'CUSTOMER_SUBMITTED');
  const allOrders = orderList;

  return (
    <>
      {message && (
        <div className={`admin-message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Pending Verifications */}
      <section className="admin-section">
        <h2>Pending Verification ({pendingOrders.length})</h2>

        {pendingOrders.length === 0 ? (
          <p className="empty-state">No pending payments to verify</p>
        ) : (
          <div className="order-list">
            {pendingOrders.map((order) => (
              <div key={order.orderId} className="order-card pending">
                <div className="order-info">
                  <span className="order-id">{order.orderId}</span>
                  <span className="order-amount">{formatCurrency(order.amount)}</span>
                </div>
                <div className="order-meta">
                  {order.vendorName && <span>Vendor: {order.vendorName}</span>}
                  <span>Submitted: {formatDateTime(order.paymentSubmittedAt!)}</span>
                </div>

                <div className="verify-actions">
                  <input
                    type="text"
                    placeholder="Transaction ID (optional)"
                    value={selectedOrderId === order.orderId ? transactionId : ''}
                    onChange={(e) => {
                      setSelectedOrderId(order.orderId);
                      setTransactionId(e.target.value);
                    }}
                    className="transaction-input"
                  />
                  <div className="verify-buttons">
                    <button
                      className="btn btn-verify-paid"
                      onClick={() => handleVerify(order.orderId, 'PAID')}
                    >
                      ✅ Mark Paid
                    </button>
                    <button
                      className="btn btn-verify-failed"
                      onClick={() => handleVerify(order.orderId, 'FAILED')}
                    >
                      ❌ Mark Failed
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* All Orders */}
      <section className="admin-section">
        <h2>All Orders ({allOrders.length})</h2>

        {allOrders.length === 0 ? (
          <p className="empty-state">No orders yet</p>
        ) : (
          <div className="order-list">
            {allOrders.map((order) => (
              <div key={order.orderId} className={`order-card ${order.paymentStatus.toLowerCase()}`}>
                <div className="order-info">
                  <span className="order-id">{order.orderId}</span>
                  <span className="order-amount">{formatCurrency(order.amount)}</span>
                </div>
                <div className="order-status">
                  <span className={`status-badge ${order.paymentStatus.toLowerCase()}`}>
                    {order.paymentStatus}
                  </span>
                </div>
                <div className="order-meta">
                  {order.vendorName && <span>Vendor: {order.vendorName}</span>}
                  <span>Created: {formatDateTime(order.createdAt)}</span>
                  {order.orderPlacedAt && (
                    <span>Placed: {formatDateTime(order.orderPlacedAt)}</span>
                  )}
                  {order.paymentMethod && (
                    <span>Method: {order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'PhonePe'}</span>
                  )}
                  {order.codPlacedAt && (
                    <span>COD Placed: {formatDateTime(order.codPlacedAt)}</span>
                  )}
                  {order.paymentSubmittedAt && (
                    <span>Submitted: {formatDateTime(order.paymentSubmittedAt)}</span>
                  )}
                  {order.paymentVerifiedAt && (
                    <span>Verified: {formatDateTime(order.paymentVerifiedAt)}</span>
                  )}
                  {order.transactionId && (
                    <span>TXN: {order.transactionId}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
