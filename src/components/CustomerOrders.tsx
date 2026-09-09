import { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getItemOrders, updateItemOrderStatus } from '../utils/storage';
import type { ItemOrder, ItemOrderStatus } from '../types/payment';

const OrderTrackingMap = lazy(() => import('./OrderTrackingMap').then(m => ({ default: m.OrderTrackingMap })));

// Product IDs match the catalog in CustomerCart.tsx.
const PRODUCT_ID_BY_NAME: Record<string, number> = {
  Aquafina: 1,
  Bisleri: 2,
  Kinley: 3,
};

type OrderFilter = 'pending' | 'history';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PAID: { label: 'Pending', cls: 'cstatus-submitted' },
  PENDING: { label: 'Pending', cls: 'cstatus-submitted' },
  NOT_PAID: { label: 'Pending', cls: 'cstatus-submitted' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', cls: 'cstatus-out' },
  DELIVERED: { label: 'Delivered', cls: 'cstatus-paid' },
  CANCELLED: { label: 'Cancelled', cls: 'cstatus-expired' },
};

export function CustomerOrders() {
  const { session } = useAuth();
  const [orders, setOrders] = useState<ItemOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderFilter>('pending');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);

  const flash = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // Reorder: add this order's items back to the cart (merging quantities).
  const handleReorder = (order: ItemOrder) => {
    try {
      const saved = localStorage.getItem('customer_cart');
      const cart = saved ? (JSON.parse(saved) as { id: number; qty: number }[]) : [];
      const next = [...cart];
      for (const item of order.items) {
        const productId = PRODUCT_ID_BY_NAME[item.name];
        if (!productId) continue;
        const existing = next.find((c) => c.id === productId);
        if (existing) {
          existing.qty += item.qty;
        } else {
          next.push({ id: productId, qty: item.qty });
        }
      }
      localStorage.setItem('customer_cart', JSON.stringify(next));
      const count = order.items.reduce((s, i) => s + i.qty, 0);
      flash('success', `Added ${count} item(s) to your cart. Open Cart to checkout.`);
    } catch {
      flash('error', 'Could not reorder. Please try again.');
    }
  };

  // Cancel: only allowed while the order is not yet paid.
  const handleCancel = async (orderId: string) => {
    const updated = await updateItemOrderStatus(orderId, 'CANCELLED');
    if (updated) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      flash('success', `Order ${orderId} cancelled.`);
    } else {
      flash('error', 'Could not cancel this order.');
    }
  };

  const canCancel = (status: ItemOrderStatus) =>
    status === 'PENDING' || status === 'NOT_PAID' || status === 'PAID';

  // Tracking only makes sense once the delivery partner has picked up the
  // order and started the trip (OUT_FOR_DELIVERY). Before that there is
  // nothing to track.
  const canTrack = (status: ItemOrderStatus) =>
    status === 'OUT_FOR_DELIVERY';

  useEffect(() => {
    let cancelled = false;
    const fetchOrders = async () => {
      const all = await getItemOrders();
      if (cancelled) return;
      const customerOrders = all.filter(
        (order) => order.customerId === session?.customerId
      );
      setOrders(customerOrders.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session?.customerId]);

  const pendingCount = orders.filter(
    (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
  ).length;
  const historyCount = orders.length - pendingCount;

  const filteredOrders = orders.filter((order) => {
    if (filter === 'pending') return order.status !== 'DELIVERED' && order.status !== 'CANCELLED';
    // History: delivered and cancelled orders.
    return order.status === 'DELIVERED' || order.status === 'CANCELLED';
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="customer-orders">
        <div className="orders-header">
          <h1>My Orders</h1>
        </div>
        <div className="loading-state">Loading orders...</div>
      </div>
    );
  }

  return (
    <div className="customer-orders">
      <div className="orders-header">
        <h1>My Orders</h1>
      </div>

      {/* Tabs: Pending / History */}
      <div className="filter-tabs">
        <button
          className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Pending ({pendingCount})
        </button>
        <button
          className={`filter-tab ${filter === 'history' ? 'active' : ''}`}
          onClick={() => setFilter('history')}
        >
          History ({historyCount})
        </button>
      </div>

      <div className="orders-content">
        {message && (
          <div className={`order-action-msg ${message.type}`}>{message.text}</div>
        )}

        {filteredOrders.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            <p>{filter === 'pending' ? 'No pending orders' : 'No orders in history yet'}</p>
            <p className="empty-subtext">
              {filter === 'pending'
                ? 'Orders waiting for a delivery partner will appear here'
                : 'Delivered and cancelled orders will appear here'}
            </p>
          </div>
        ) : (
          <div className="orders-list">
            {filteredOrders.map((order) => {
              const meta = STATUS_META[order.status] || STATUS_META.NOT_PAID;
              const isTracking = trackingOrderId === order.id;
              return (
                <div key={order.id} className="order-card">
                  <div className="order-header">
                    <span className="order-id">{order.id}</span>
                    <span className={`order-status ${meta.cls}`}>{meta.label}</span>
                  </div>
                  <div className="order-details">
                    <div className="item-order-vendor">
                      {order.vendorName || 'OORUNII Store'}
                    </div>
                    <div className="item-order-items">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="item-order-row">
                          <span className="item-order-name">
                            {item.image && <span className="item-order-image">{item.image}</span>}
                            {item.name}
                            <span className="item-order-qty"> × {item.qty}</span>
                          </span>
                          <span className="item-order-line-total">
                            ₹{(item.price * item.qty).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="item-order-total-row">
                      <span className="item-order-total-label">Total</span>
                      <span className="item-order-total-value">₹{order.total.toFixed(2)}</span>
                    </div>
                    <p className="order-date">{formatDate(order.createdAt)}</p>
                  </div>

                  {/* Inline Tracking Map */}
                  {isTracking && (
                    <Suspense fallback={<div className="otm-loading">Loading map...</div>}>
                      <OrderTrackingMap
                        orderId={order.id}
                        onClose={() => setTrackingOrderId(null)}
                      />
                    </Suspense>
                  )}

                  <div className="order-actions">
                    {canTrack(order.status) && (
                      <button
                        className={`order-btn track ${isTracking ? 'tracking-active' : ''}`}
                        onClick={() => setTrackingOrderId(isTracking ? null : order.id)}
                      >
                        {isTracking ? '🗺️ Hide Map' : '🗺️ Track Order'}
                      </button>
                    )}
                    <button className="order-btn reorder" onClick={() => handleReorder(order)}>
                      Reorder
                    </button>
                    {canCancel(order.status) && (
                      <button className="order-btn cancel" onClick={() => handleCancel(order.id)}>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
