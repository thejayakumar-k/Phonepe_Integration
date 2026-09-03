import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { saveOrder, getOrder } from '../utils/storage';
import type { Order } from '../types/payment';

export function PaymentVerification() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);


  const orderId = searchParams.get('orderId');

  useEffect(() => {
    if (orderId) {
      const existing = getOrder(orderId);
      if (existing) {
        setOrder(existing);
      } else {
        // Create new order for verification
        const newOrder: Order = {
          orderId: orderId,
          vendorId: 'VENDOR001',
          vendorName: 'OORUNII Store',
          customerId: session?.customerId,
          customerName: session?.customerName,
          amount: parseFloat(searchParams.get('amount') || '0'),
          currency: 'INR',
          description: 'QR Payment',
          createdAt: Date.now(),
          expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
          paymentStatus: 'CUSTOMER_SUBMITTED',
          paymentMethod: 'PHONEPE',
          paymentSubmittedAt: Date.now(),
        };
        saveOrder(newOrder);
        setOrder(newOrder);
      }
    }
  }, [orderId, session, searchParams]);

  useEffect(() => {
    if (!orderId) return;
    const fetchStatus = () => {
      const updated = getOrder(orderId);
      if (updated) setOrder(updated);
    };
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [orderId]);

  if (!order) {
    return (
      <div className="payment-verification">
        <p>Order not found</p>
        <button className="btn-return-home" onClick={() => navigate('/customer')}>Return to Home</button>
      </div>
    );
  }

  return (
    <div className="payment-verification">
      <div className="verification-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1>Payment Verification</h1>
      </div>

      <div className="verification-content">
        {order.paymentStatus === 'CUSTOMER_SUBMITTED' && (
          <div className="verification-card pending">
            <div className="verification-icon">⏳</div>
            <h2>Payment Pending Verification</h2>
            <p className="verification-message">
              Your payment of <strong>₹{order.amount.toFixed(2)}</strong> is being verified.
            </p>
            <div className="verification-details">
              <div className="detail-row">
                <span className="detail-label">Order ID</span>
                <span className="detail-value">{order.orderId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Amount</span>
                <span className="detail-value">₹{order.amount.toFixed(2)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Status</span>
                <span className="detail-value status">Pending</span>
              </div>
            </div>
            <p className="verification-note">
              Please wait while we verify your payment. This may take a few minutes.
            </p>
            <button className="btn-return-home" onClick={() => navigate('/customer')}>
              Return to Home
            </button>
          </div>
        )}

        {order.paymentStatus === 'PAID' && (
          <div className="verification-card success">
            <div className="verification-icon">✅</div>
            <h2>Payment Successful!</h2>
            <p className="verification-message">
              Your payment of <strong>₹{order.amount.toFixed(2)}</strong> has been verified.
            </p>
            <div className="verification-details">
              <div className="detail-row">
                <span className="detail-label">Order ID</span>
                <span className="detail-value">{order.orderId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Amount</span>
                <span className="detail-value">₹{order.amount.toFixed(2)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Status</span>
                <span className="detail-value status paid">Paid</span>
              </div>
            </div>
            <button className="btn-return-home" onClick={() => navigate('/customer')}>
              Return to Home
            </button>
          </div>
        )}

        {order.paymentStatus === 'FAILED' && (
          <div className="verification-card failed">
            <div className="verification-icon">❌</div>
            <h2>Payment Failed</h2>
            <p className="verification-message">
              Your payment could not be verified. Please try again.
            </p>
            <div className="verification-details">
              <div className="detail-row">
                <span className="detail-label">Order ID</span>
                <span className="detail-value">{order.orderId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Amount</span>
                <span className="detail-value">₹{order.amount.toFixed(2)}</span>
              </div>
            </div>
            <button className="btn-retry" onClick={() => navigate(-1)}>
              Try Again
            </button>
            <button className="btn-return-home" onClick={() => navigate('/customer')}>
              Return to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
