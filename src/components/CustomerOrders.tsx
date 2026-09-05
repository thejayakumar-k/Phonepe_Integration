import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getItemOrders, updateItemOrderStatus } from '../utils/storage';
import type { ItemOrder, ItemOrderStatus } from '../types/payment';

// Product IDs match the catalog in CustomerCart.tsx.
const PRODUCT_ID_BY_NAME: Record<string, number> = {
  Aquafina: 1,
  Bisleri: 2,
  Kinley: 3,
};

type OrderFilter = 'all' | 'paid' | 'unpaid';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PAID: { label: 'Paid', cls: 'cstatus-paid' },
  PENDING: { label: 'Payment Pending', cls: 'cstatus-submitted' },
  NOT_PAID: { label: 'Not Paid', cls: 'cstatus-unpaid' },
  CANCELLED: { label: 'Cancelled', cls: 'cstatus-expired' },
};

const isPaid = (status: ItemOrderStatus) => status === 'PAID';

export function CustomerOrders() {
  const { session } = useAuth();
  const [orders, setOrders] = useState<ItemOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderFilter>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
    status === 'PENDING' || status === 'NOT_PAID';

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

  const paidCount = orders.filter((o) => isPaid(o.status)).length;
  const unpaidCount = orders.length - paidCount;

  const filteredOrders = orders.filter((order) => {
    if (filter === 'paid') return isPaid(order.status);
    if (filter === 'unpaid') return !isPaid(order.status);
    return true;
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

      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({orders.length})
        </button>
        <button
          className={`filter-tab ${filter === 'paid' ? 'active' : ''}`}
          onClick={() => setFilter('paid')}
        >
          Paid ({paidCount})
        </button>
        <button
          className={`filter-tab ${filter === 'unpaid' ? 'active' : ''}`}
          onClick={() => setFilter('unpaid')}
        >
          Not Paid ({unpaidCount})
        </button>
      </div>

      <div className="orders-content">
        {message && (
          <div className={`order-action-msg ${message.type}`}>{message.text}</div>
        )}

        {filteredOrders.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            <p>No orders yet</p>
            <p className="empty-subtext">Your orders will appear here</p>
          </div>
        ) : (
          <div className="orders-list">
            {filteredOrders.map((order) => {
              const meta = STATUS_META[order.status] || STATUS_META.NOT_PAID;
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
                  <div className="order-actions">
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
