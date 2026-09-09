import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getOrders, getItemOrders, assignItemOrderPartner } from '../utils/storage';
import { demoDeliveryPartners } from '../data/demo';
import type { Order, ItemOrder } from '../types/payment';

export function VendorOrders() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [itemOrders, setItemOrders] = useState<ItemOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'notpaid' | 'paid' | 'failed'>('all');
  const [assigningOrder, setAssigningOrder] = useState<ItemOrder | null>(null);

  const loadAllOrders = useCallback(async () => {
    const [allOrders, allItemOrders] = await Promise.all([getOrders(), getItemOrders()]);
    const vendorOrders = allOrders.filter((order) => order.vendorId === session?.vendorId);
    setOrders(vendorOrders.sort((a, b) => b.createdAt - a.createdAt));
    const vendorItemOrders = allItemOrders.filter((io) => io.vendorId === session?.vendorId);
    setItemOrders(vendorItemOrders.sort((a, b) => b.createdAt - a.createdAt));
    setLoading(false);
  }, [session?.vendorId]);

  useEffect(() => {
    loadAllOrders();
    const interval = setInterval(loadAllOrders, 4000);
    return () => clearInterval(interval);
  }, [loadAllOrders]);

  // Combine item orders and raw orders for a unified list
  const combinedOrders = itemOrders;

  const totalCount = combinedOrders.length;
  const notPaidCount = combinedOrders.filter((o) => o.status === 'NOT_PAID' || o.paymentMethod === 'COD' || o.status === 'PENDING').length;
  const paidCount = combinedOrders.filter((o) => o.status === 'PAID' || o.status === 'OUT_FOR_DELIVERY' || o.status === 'DELIVERED').length;
  const failedCount = combinedOrders.filter((o) => o.status === 'CANCELLED').length;

  const filteredItemOrders = combinedOrders.filter((io) => {
    if (filter === 'all') return true;
    if (filter === 'notpaid') return io.status === 'NOT_PAID' || io.paymentMethod === 'COD' || io.status === 'PENDING';
    if (filter === 'paid') return io.status === 'PAID' || io.status === 'OUT_FOR_DELIVERY' || io.status === 'DELIVERED';
    if (filter === 'failed') return io.status === 'CANCELLED';
    return true;
  });

  const handleAssignPartner = async (partnerId: string, partnerName: string) => {
    if (!assigningOrder) return;
    await assignItemOrderPartner(assigningOrder.id, partnerId, partnerName);
    setAssigningOrder(null);
    await loadAllOrders();
  };

  const formatOrderDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (loading && combinedOrders.length === 0 && orders.length === 0) {
    return (
      <div className="v-orders-page">
        <div className="loading-state">Loading orders...</div>
      </div>
    );
  }

  return (
    <div className="v-orders-page">
      {/* Back & Header */}
      <div className="v-orders-header">
        <button className="v-back-btn" onClick={() => navigate('/vendor')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          <span className="v-orders-header-title">Orders</span>
        </button>
        <div className="v-orders-subtitle">{totalCount || orders.length} total orders</div>
      </div>

      {/* Filter Tabs */}
      <div className="v-filter-tabs">
        <button
          className={`v-filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({totalCount || orders.length})
        </button>
        <button
          className={`v-filter-tab ${filter === 'notpaid' ? 'active' : ''}`}
          onClick={() => setFilter('notpaid')}
        >
          Not Paid ({notPaidCount})
        </button>
        <button
          className={`v-filter-tab ${filter === 'paid' ? 'active' : ''}`}
          onClick={() => setFilter('paid')}
        >
          Paid ({paidCount || orders.filter((o) => o.paymentStatus === 'PAID').length})
        </button>
        <button
          className={`v-filter-tab ${filter === 'failed' ? 'active' : ''}`}
          onClick={() => setFilter('failed')}
        >
          Failed ({failedCount})
        </button>
      </div>

      {/* Orders List */}
      <div className="v-orders-list">
        {filteredItemOrders.length === 0 && orders.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            <p>No orders found</p>
          </div>
        ) : (
          filteredItemOrders.map((io) => {
            const isCod = io.paymentMethod === 'COD' || io.status === 'NOT_PAID';
            const isPaid = io.status === 'PAID' || io.status === 'OUT_FOR_DELIVERY' || io.status === 'DELIVERED';
            const isOutForDelivery = io.status === 'OUT_FOR_DELIVERY';
            const isDelivered = io.status === 'DELIVERED';
            const partnerName = io.assignedPartnerName || (io.assignedPartnerId ? 'Arun Kumar' : null);

            return (
              <div key={io.id} className="vo-card">
                {/* Header: ID & Status Badge */}
                <div className="vo-card-top">
                  <span className="vo-order-id">{io.id.startsWith('#') ? io.id : `#${io.id}`}</span>
                  {isDelivered ? (
                    <span className="vo-badge vo-badge-paid">Paid</span>
                  ) : isOutForDelivery ? (
                    <span className="vo-badge vo-badge-paid">Paid</span>
                  ) : isCod ? (
                    <span className="vo-badge vo-badge-cod">COD · Not Paid</span>
                  ) : isPaid ? (
                    <span className="vo-badge vo-badge-paid">Paid</span>
                  ) : (
                    <span className="vo-badge vo-badge-notpaid">Not Paid</span>
                  )}
                </div>

                {/* Amount & Customer Name */}
                <div className="vo-card-main">
                  <span className="vo-amount">₹{io.total.toFixed(2)}</span>
                  <span className="vo-customer">{io.customerName || io.customerId || 'Customer'}</span>
                </div>

                {/* Item Details */}
                <div className="vo-items-row">
                  {io.items.length > 0
                    ? io.items.map((i) => `${i.name} ×${i.qty}`).join(', ')
                    : 'Aquafina ×1'}
                </div>

                {/* Date & Payment Method */}
                <div className="vo-meta-row">
                  <span className="vo-date">{formatOrderDate(io.createdAt)}</span>
                  <span className="vo-method">
                    {isCod ? 'Cash on Delivery' : 'UPI'}
                  </span>
                </div>

                {/* Delivery Assignment Bar / Action */}
                <div className="vo-action-area">
                  {isDelivered && partnerName ? (
                    <div className="vo-status-row vo-status-delivered">
                      <span className="vo-status-left">
                        <span className="vo-icon">🛵</span>
                        <span>Delivered</span>
                      </span>
                      <span className="vo-partner-name">{partnerName}</span>
                    </div>
                  ) : isOutForDelivery && partnerName ? (
                    <div className="vo-status-row vo-status-out">
                      <span className="vo-status-left">
                        <span className="vo-icon">🛵</span>
                        <span>Out for Delivery</span>
                      </span>
                      <span className="vo-partner-name">{partnerName}</span>
                    </div>
                  ) : partnerName ? (
                    <div className="vo-status-row vo-status-assigned">
                      <span className="vo-status-left">
                        <span className="vo-icon">🛵</span>
                        <span>Assigned to {partnerName}</span>
                      </span>
                      <button
                        className="vo-change-btn"
                        onClick={() => setAssigningOrder(io)}
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <button
                      className="vo-btn-assign"
                      onClick={() => setAssigningOrder(io)}
                    >
                      <span style={{ fontSize: '1.2rem', marginRight: '0.4rem' }}>🛵</span>
                      Assign Delivery Partner
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Assign Delivery Partner Modal */}
      {assigningOrder && (
        <div className="vo-modal-overlay" onClick={() => setAssigningOrder(null)}>
          <div className="vo-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="vo-modal-head">
              <h3>🛵 Assign Delivery Partner</h3>
              <button className="vo-modal-close" onClick={() => setAssigningOrder(null)}>✕</button>
            </div>
            <p className="vo-modal-desc">
              Order <strong>{assigningOrder.id}</strong> ({assigningOrder.customerName || 'Customer'})
            </p>

            <div className="vo-partner-list">
              {demoDeliveryPartners.map((dp) => (
                <div
                  key={dp.id}
                  className="vo-partner-item"
                  onClick={() => handleAssignPartner(dp.id, dp.name)}
                >
                  <div className="vo-partner-avatar">🛵</div>
                  <div className="vo-partner-info">
                    <span className="vo-pname">{dp.name}</span>
                    <span className="vo-pphone">{dp.phone || 'Available'}</span>
                  </div>
                  <button className="vo-partner-select-btn">Assign</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
