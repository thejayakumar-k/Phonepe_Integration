import type { Order } from '../types/payment';
import { formatCurrency, formatDateTime } from '../utils/upi';

interface OrderSummaryProps {
  order: Order;
}

export function OrderSummary({ order }: OrderSummaryProps) {
  return (
    <div className="order-summary">
      <h2 className="section-title">Order Summary</h2>
      
      <div className="order-details">
        <div className="detail-row">
          <span className="detail-label">Order ID</span>
          <span className="detail-value order-id">{order.orderId}</span>
        </div>

        <div className="detail-row">
          <span className="detail-label">Date &amp; Time</span>
          <span className="detail-value">{formatDateTime(order.createdAt)}</span>
        </div>
        
        <div className="detail-row amount-row">
          <span className="detail-label">Amount</span>
          <span className="detail-value amount">{formatCurrency(order.amount)}</span>
        </div>
        
        <div className="detail-row">
          <span className="detail-label">Currency</span>
          <span className="detail-value">{order.currency}</span>
        </div>

        {order.paymentMethod && order.paymentStatus !== 'PENDING' && (
          <div className="detail-row">
            <span className="detail-label">Payment Method</span>
            <span className="detail-value">{order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'PhonePe'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
