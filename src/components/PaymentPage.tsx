import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Order, MerchantConfig, PaymentMethod } from '../types/payment';
import { OrderSummary } from './OrderSummary';
import { QRCodeDisplay } from './QRCodeDisplay';
import { PaymentTimer } from './PaymentTimer';
import { PaymentStatus } from './PaymentStatus';
import { useCountdown } from '../hooks/useCountdown';
import { useOrderStatus } from '../hooks/useOrderStatus';
import { saveOrder, getOrder } from '../utils/storage';

interface PaymentPageProps {
  order: Order;
  merchant: MerchantConfig;
  sessionMinutes: number;
}

export function PaymentPage({
  order: initialOrder,
  merchant,
  sessionMinutes,
}: PaymentPageProps) {
  const countdown = useCountdown();
  const navigate = useNavigate();
  const { order: storedOrder } = useOrderStatus(initialOrder.orderId);
  const [order, setOrder] = useState<Order>(initialOrder);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initialOrder.paymentMethod || 'UPI'
  );

  const hasReturnedRef = useRef(false);
  const hasLeftPageRef = useRef(false);
  const hasInitiatedRef = useRef(false);

  // Load order from storage on mount
  useEffect(() => {
    const existing = getOrder(initialOrder.orderId);
    if (existing) {
      // If the saved session already expired, start a fresh one
      if (existing.paymentStatus === 'EXPIRED' || existing.expiresAt <= Date.now()) {
        const refreshed: Order = {
          ...existing,
          paymentStatus: 'PENDING',
          expiresAt: Date.now() + sessionMinutes * 60 * 1000,
        };
        setOrder(refreshed);
        saveOrder(refreshed);
      } else {
        setOrder(existing);
      }
    } else {
      // First visit - save order
      saveOrder(initialOrder);
    }
  }, [initialOrder, sessionMinutes]);

  // Update when admin verifies the order (PAID / FAILED / CANCELLED).
  // Local transitions (submit, COD, expiry) are NOT overwritten by stale
  // polling snapshots.
  useEffect(() => {
    if (
      storedOrder &&
      (storedOrder.paymentStatus === 'PAID' ||
        storedOrder.paymentStatus === 'FAILED' ||
        storedOrder.paymentStatus === 'CANCELLED') &&
      storedOrder.paymentStatus !== order.paymentStatus
    ) {
      setOrder(storedOrder);
      countdown.stop();
    }
  }, [storedOrder, order.paymentStatus, countdown]);

  // Initialize countdown on mount
  useEffect(() => {
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((order.expiresAt - now) / 1000));
    
    if (remaining > 0 && order.paymentStatus === 'PENDING') {
      countdown.start(remaining);
    } else if (remaining <= 0 && order.paymentStatus === 'PENDING') {
      const updated = { ...order, paymentStatus: 'EXPIRED' as const };
      setOrder(updated);
      saveOrder(updated);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle timer expiry
  useEffect(() => {
    if (countdown.isExpired && order.paymentStatus === 'PENDING') {
      const updated = { ...order, paymentStatus: 'EXPIRED' as const };
      setOrder(updated);
      saveOrder(updated);
    }
  }, [countdown.isExpired, order.paymentStatus, order]);

  // After payment verification screen, wait 3s then return home for vendor approval
  useEffect(() => {
    if (order.paymentStatus === 'CUSTOMER_SUBMITTED') {
      const timer = setTimeout(() => navigate('/'), 3000);
      return () => clearTimeout(timer);
    }
  }, [order.paymentStatus, navigate]);

  // AUTO-DETECT: When customer returns from UPI app, auto-show "Verifying payment..."
  // Only triggers if the customer actually started a UPI payment (tapped
  // "Pay via UPI App") AND left the page first, so login / initial load
  // focus events never falsely place the order.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        hasLeftPageRef.current = true;
        return;
      }
      if (
        hasInitiatedRef.current &&
        hasLeftPageRef.current &&
        order.paymentStatus === 'PENDING' &&
        paymentMethod === 'UPI' &&
        !hasReturnedRef.current
      ) {
        // Customer returned to the page after starting a UPI payment
        hasReturnedRef.current = true;
        handleAutoSubmit();
      }
    };

    const handleBlur = () => {
      hasLeftPageRef.current = true;
    };

    const handleFocus = () => {
      if (
        hasInitiatedRef.current &&
        hasLeftPageRef.current &&
        order.paymentStatus === 'PENDING' &&
        paymentMethod === 'UPI' &&
        !hasReturnedRef.current
      ) {
        hasReturnedRef.current = true;
        handleAutoSubmit();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [order.paymentStatus, paymentMethod]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAutoSubmit = useCallback(() => {
    const now = Date.now();
    const updated: Order = {
      ...order,
      paymentStatus: 'CUSTOMER_SUBMITTED',
      paymentSubmittedAt: now,
      orderPlacedAt: order.orderPlacedAt || now,
    };
    setOrder(updated);
    saveOrder(updated);
    countdown.stop();
  }, [order, countdown]);

  const handleCancelPayment = useCallback(() => {
    const updated: Order = {
      ...order,
      paymentStatus: 'CANCELLED',
    };
    setOrder(updated);
    saveOrder(updated);
    countdown.stop();
  }, [order, countdown]);

  const handlePlaceCodOrder = useCallback(() => {
    const now = Date.now();
    const updated: Order = {
      ...order,
      paymentStatus: 'COD_PLACED',
      paymentMethod: 'COD',
      codPlacedAt: now,
      orderPlacedAt: order.orderPlacedAt || now,
    };
    setOrder(updated);
    saveOrder(updated);
    countdown.stop();
  }, [order, countdown]);

  const handleRestartPayment = useCallback(() => {
    const newExpiresAt = Date.now() + sessionMinutes * 60 * 1000;
    const updated: Order = {
      ...order,
      paymentStatus: 'PENDING',
      expiresAt: newExpiresAt,
      paymentSubmittedAt: undefined,
      orderPlacedAt: undefined,
    };
    setOrder(updated);
    saveOrder(updated);
    hasReturnedRef.current = false;
    hasLeftPageRef.current = false;
    hasInitiatedRef.current = false;
    countdown.reset(sessionMinutes * 60);
  }, [order, sessionMinutes, countdown]);

  const canRestart =
    order.paymentStatus === 'EXPIRED' ||
    order.paymentStatus === 'FAILED' ||
    order.paymentStatus === 'CANCELLED';

  return (
    <div className="payment-page">
      <header className="payment-header">
        <h1 className="brand-title">OORUNII</h1>
        <p className="brand-subtitle">Secure UPI Payment</p>
      </header>

      <main className="payment-content">
        {/* Order Summary */}
        <OrderSummary order={order} />

        {/* Payment Method Selection - Only show if payment is pending */}
        {order.paymentStatus === 'PENDING' && (
          <div className="method-selector">
            <button
              className={`method-option ${paymentMethod === 'UPI' ? 'active' : ''}`}
              onClick={() => setPaymentMethod('UPI')}
            >
              <span className="method-icon">📱</span>
              <span className="method-name">Pay Online (UPI)</span>
            </button>
            <button
              className="method-option"
              onClick={handlePlaceCodOrder}
            >
              <span className="method-icon">💵</span>
              <span className="method-name">Cash on Delivery</span>
            </button>
          </div>
        )}

        {/* UPI Section - Only show if payment is pending and UPI selected */}
        {order.paymentStatus === 'PENDING' && paymentMethod === 'UPI' && (
          <QRCodeDisplay
            merchant={merchant}
            amount={order.amount}
            orderId={order.orderId}
            disabled={countdown.isExpired}
            onInitiatePayment={() => {
              hasInitiatedRef.current = true;
            }}
            timer={
              <PaymentTimer
                timeLeft={countdown.timeLeft}
                formattedTime={countdown.formattedTime}
                isExpired={countdown.isExpired}
                sessionMinutes={sessionMinutes}
                compact
              />
            }
          />
        )}

        {/* Payment Status */}
        <PaymentStatus
          status={order.paymentStatus}
          onRestartPayment={handleRestartPayment}
          onCancelPayment={handleCancelPayment}
          onReturnHome={() => navigate('/')}
          canRestart={canRestart}
        />
      </main>

      <footer className="payment-footer">
        <p className="footer-text">
          Need help? Contact us at support@oorunii.com
        </p>
      </footer>
    </div>
  );
}
