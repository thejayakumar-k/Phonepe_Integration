import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getItemOrders, updateItemOrderStatus, collectItemOrderPayment } from '../utils/storage';
import { useVendorDelivery } from '../hooks/useVendorDelivery';
import { VendorDeliveryMap } from './VendorDeliveryMap';
import type { ItemOrder } from '../types/payment';

export function DeliveryDashboard() {
  const { session } = useAuth();
  const [orders, setOrders] = useState<ItemOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMapOrder, setActiveMapOrder] = useState<ItemOrder | null>(null);

  const deliveryStream = useVendorDelivery();

  const loadOrders = useCallback(async () => {
    const all = await getItemOrders();
    // Show orders assigned to this delivery partner, or unassigned/active orders
    const partnerOrders = all.filter((o) => {
      if (session?.partnerId && o.assignedPartnerId) {
        return o.assignedPartnerId === session.partnerId;
      }
      return true; // show all available in demo mode
    });
    setOrders(partnerOrders.sort((a, b) => b.createdAt - a.createdAt));
    setLoading(false);
  }, [session?.partnerId]);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 4000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const activeCount = orders.filter((o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length;
  const totalCount = orders.length;

  const handleStartDelivery = async (order: ItemOrder) => {
    await updateItemOrderStatus(order.id, 'OUT_FOR_DELIVERY');
    deliveryStream.startDelivery(order);
    await loadOrders();
  };

  const handleMarkDelivered = async (order: ItemOrder) => {
    await updateItemOrderStatus(order.id, 'DELIVERED');
    deliveryStream.stopDelivery();
    await loadOrders();
  };

  const handleCollectPayment = async (order: ItemOrder, method: 'CASH' | 'UPI') => {
    await collectItemOrderPayment(order.id, method);
    deliveryStream.stopDelivery();
    await loadOrders();
  };

  return (
    <div className="dp-container">
      {/* Top Location Status Bar */}
      <div className="dp-status-bar">
        {deliveryStream.isDelivering && deliveryStream.activeOrder ? (
          <span className="dp-status-active">
            <span className="dp-dot-active"></span>
            Sharing live location · {deliveryStream.activeOrder.id}
          </span>
        ) : (
          <span className="dp-status-idle">
            <span className="dp-dot-idle"></span>
            Not sharing location
          </span>
        )}
      </div>

      {/* Header */}
      <div className="dp-header">
        <h1 className="dp-title">Deliveries</h1>
        <p className="dp-subtitle">
          {activeCount} active · {totalCount} total
        </p>
      </div>

      {/* Orders List */}
      <div className="dp-orders-list">
        {loading && orders.length === 0 ? (
          <div className="dp-empty">Loading deliveries...</div>
        ) : orders.length === 0 ? (
          <div className="dp-empty">
            <span style={{ fontSize: '2.5rem' }}>🛵</span>
            <p style={{ marginTop: '0.5rem', fontWeight: 600 }}>No Deliveries Assigned</p>
            <small style={{ color: '#888' }}>
              Orders assigned by vendors will appear here automatically.
            </small>
          </div>
        ) : (
          orders.map((order) => {
            const isDeliveringThis = deliveryStream.isDelivering && deliveryStream.activeOrder?.id === order.id;
            const isAssigned = order.status === 'PENDING' || order.status === 'PAID' || !order.status || (!order.assignedPartnerId && order.status !== 'OUT_FOR_DELIVERY' && order.status !== 'DELIVERED');
            const isOutForDelivery = order.status === 'OUT_FOR_DELIVERY' || isDeliveringThis;
            const isDelivered = order.status === 'DELIVERED';
            const isCod = order.paymentMethod === 'COD' || order.status === 'NOT_PAID';

            return (
              <div key={order.id} className="dp-card">
                {/* Card Top Row: Order ID and Status Badge */}
                <div className="dp-card-top">
                  <span className="dp-order-id">{order.id}</span>
                  {isDelivered ? (
                    <span className="dp-badge dp-badge-delivered">Delivered</span>
                  ) : isOutForDelivery ? (
                    <span className="dp-badge dp-badge-out">Out for Delivery</span>
                  ) : (
                    <span className="dp-badge dp-badge-assigned">Assigned</span>
                  )}
                </div>

                {/* Customer Name */}
                <div className="dp-customer-name">
                  {order.customerName || order.customerId || 'Customer'}
                </div>

                {/* Delivery Address */}
                <div className="dp-address-row">
                  <span className="dp-pin-icon">📍</span>
                  <span className="dp-address-text">
                    {order.deliveryAddress?.address ||
                      'Pillaiyar Koil Street, Maduravoyal, Chennai'}
                  </span>
                </div>

                {/* Actions based on state */}
                {isAssigned && !isOutForDelivery && !isDelivered && (
                  <button
                    className="dp-btn-start"
                    onClick={() => handleStartDelivery(order)}
                  >
                    ▶ Start Delivery
                  </button>
                )}

                {isOutForDelivery && !isDelivered && (
                  <div className="dp-active-delivery-actions">
                    <button
                      className="dp-btn-mark-delivered"
                      onClick={() => handleMarkDelivered(order)}
                    >
                      ✓ Mark Delivered
                    </button>

                    {/* View Live Route Map Link */}
                    <button
                      className="dp-btn-view-map"
                      onClick={() => setActiveMapOrder(order)}
                    >
                      🗺️ Open Navigation Map
                    </button>

                    {/* Cash on Delivery / Amount Collection Box */}
                    {isCod && (
                      <div className="dp-collect-box">
                        <div className="dp-collect-title">
                          💰 Collect ₹{order.total.toFixed(2)} from customer
                        </div>
                        <div className="dp-collect-buttons">
                          <button
                            className="dp-collect-btn dp-btn-cash"
                            onClick={() => handleCollectPayment(order, 'CASH')}
                          >
                            💵 Cash
                          </button>
                          <button
                            className="dp-collect-btn dp-btn-upi"
                            onClick={() => handleCollectPayment(order, 'UPI')}
                          >
                            📲 UPI
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isDelivered && (
                  <div className="dp-delivered-box">
                    <span className="dp-delivered-check">✓</span>
                    <span>
                      {order.collectedPaymentMethod
                        ? `Amount received · ${order.collectedPaymentMethod}`
                        : 'Amount received · UPI'}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Full screen navigation map modal */}
      {activeMapOrder && (
        <VendorDeliveryMap
          order={activeMapOrder}
          delivery={deliveryStream}
          onClose={() => setActiveMapOrder(null)}
        />
      )}
    </div>
  );
}
