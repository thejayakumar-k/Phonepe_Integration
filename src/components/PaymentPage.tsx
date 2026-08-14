import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import type { Order, MerchantConfig } from '../types/payment';
import { OrderSummary } from './OrderSummary';
import { PaymentTimer } from './PaymentTimer';
import { PaymentStatus } from './PaymentStatus';
import { useCountdown } from '../hooks/useCountdown';
import { useOrderStatus } from '../hooks/useOrderStatus';
import { saveOrder, getOrder } from '../utils/storage';
import { generateUpiString, formatCurrency } from '../utils/upi';

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
  const [amountInput, setAmountInput] = useState(() =>
    String(initialOrder.amount || '')
  );
  const [paymentRequestSent, setPaymentRequestSent] = useState(false);
  const [payTab, setPayTab] = useState<'upi' | 'qr'>('upi');

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
  }, [order.paymentStatus]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setPaymentRequestSent(false);
    hasReturnedRef.current = false;
    hasLeftPageRef.current = false;
    hasInitiatedRef.current = false;
    countdown.reset(sessionMinutes * 60);
  }, [order, sessionMinutes, countdown]);

  const canRestart =
    order.paymentStatus === 'EXPIRED' ||
    order.paymentStatus === 'FAILED' ||
    order.paymentStatus === 'CANCELLED';

  const payAmount = useMemo(() => {
    const parsed = parseFloat(amountInput);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : order.amount;
  }, [amountInput, order.amount]);

  const amountValid = payAmount > 0;

  const handleAmountChange = (value: string) => {
    setAmountInput(value);
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      setOrder((prev) => ({ ...prev, amount: parsed }));
    }
  };

  const handleOpenUpiApp = useCallback(() => {
    hasInitiatedRef.current = true;
    const upiString = generateUpiString(merchant, payAmount, order.orderId);
    // Launch the UPI intent via an invisible iframe. Some phones resolve
    // this like a native app-to-app intent, unlike anchor clicks or
    // location redirects which can mangle the URI.
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = upiString;
    document.body.appendChild(iframe);
    window.setTimeout(() => iframe.remove(), 1000);
  }, [merchant, payAmount, order.orderId]);

  const timer = (
    <PaymentTimer
      timeLeft={countdown.timeLeft}
      formattedTime={countdown.formattedTime}
      isExpired={countdown.isExpired}
      sessionMinutes={sessionMinutes}
      compact
    />
  );

  return (
    <div className="payment-page">
      <header className="payment-header">
        <h1 className="brand-title">OORUNII</h1>
        <p className="brand-subtitle">Secure UPI Payment</p>
      </header>

      <main className="payment-content">
        {/* Order Summary */}
        <OrderSummary order={{ ...order, amount: payAmount }} />

        {/* Payment Section - Only show if payment is pending */}
        {order.paymentStatus === 'PENDING' && (
          <>
            {/* Enter Amount */}
            <div className="amount-field">
              <label className="amount-label" htmlFor="pay-amount">
                Enter Amount
              </label>
              <div className="amount-input-wrap">
                <span className="amount-currency">₹</span>
                <input
                  id="pay-amount"
                  className="fund-input"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="0"
                  value={amountInput}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  aria-label="Amount to add funds"
                />
              </div>
            </div>

            {/* UPI / QR Tabs */}
            <div className="fund-tabs" role="tablist">
              <button
                className={`fund-tab ${payTab === 'upi' ? 'active' : ''}`}
                role="tab"
                aria-selected={payTab === 'upi'}
                onClick={() => setPayTab('upi')}
              >
                UPI App
              </button>
              <button
                className={`fund-tab ${payTab === 'qr' ? 'active' : ''}`}
                role="tab"
                aria-selected={payTab === 'qr'}
                onClick={() => setPayTab('qr')}
              >
                QR Code
              </button>
            </div>

            {amountValid ? (
              <>
                {order.description === 'Wallet Add Funds' ? (
                  /* Add Funds Mode */
                  !paymentRequestSent ? (
                    <div className="add-funds-action">
                      <button
                        className="btn btn-primary btn-send-request"
                        onClick={() => {
                          handleOpenUpiApp();
                          setPaymentRequestSent(true);
                        }}
                        disabled={countdown.isExpired}
                      >
                        <span className="upi-icon">📱</span>
                        Send Payment Request
                      </button>
                    </div>
                  ) : (
                    /* Payment Request Sent Status */
                    <div className="payment-request-sent">
                      <div className="request-sent-header">
                        <h3>Payment Request Sent</h3>
                      </div>
                      <div className="request-details">
                        <div className="detail-row">
                          <span className="detail-label">Amount:</span>
                          <span className="detail-value">{formatCurrency(payAmount)}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Sent to:</span>
                          <span className="detail-value">UPI intent link</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Order ID:</span>
                          <span className="detail-value">{order.orderId}</span>
                        </div>
                      </div>
                      <div className="request-status">
                        <p>Please accept the request in your UPI app.</p>
                        <div className="status-timer">{timer}</div>
                        <p className="checking-status">Checking for payment status...</p>
                      </div>
                    </div>
                  )
                ) : (
                  /* Standard Payment Mode */
                  <>
                    {payTab === 'upi' && (
                      <div className="qr-section">
                        <div className="scan-header">
                          <h3 className="scan-title">Pay with UPI</h3>
                          <div className="scan-timer">{timer}</div>
                        </div>

                        <button
                          className="btn btn-upi"
                          onClick={handleOpenUpiApp}
                          disabled={countdown.isExpired}
                        >
                          <span className="upi-icon">📱</span>
                          Pay via UPI App
                        </button>

                        <div className="payment-instructions">
                          <p className="instruction-step">
                            <span className="step-number">1</span>
                            Tap "Pay via UPI App"
                          </p>
                          <p className="instruction-step">
                            <span className="step-number">2</span>
                            Select your UPI app (PhonePe, GPay, Paytm)
                          </p>
                          <p className="instruction-step">
                            <span className="step-number">3</span>
                            Enter amount: <strong>{formatCurrency(payAmount)}</strong>
                          </p>
                          <p className="instruction-step">
                            <span className="step-number">4</span>
                            Complete the payment
                          </p>
                        </div>
                      </div>
                    )}

                    {payTab === 'qr' && (
                      <div className="qr-section">
                        <div className="scan-header">
                          <h3 className="scan-title">Scan & Pay</h3>
                          <div className="scan-timer">{timer}</div>
                        </div>

                        <div className="fund-qr">
                          <QRCodeSVG
                            value={generateUpiString(merchant, payAmount, order.orderId)}
                            size={180}
                            bgColor="#ffffff"
                            fgColor="#1a1a2e"
                            level="H"
                            includeMargin={false}
                          />
                        </div>

                        <div className="qr-details">
                          <div className="merchant-upi">
                            <span className="upi-label">Merchant UPI ID</span>
                            <span className="upi-id">{merchant.upiId}</span>
                          </div>
                          <div className="amount-display">
                            <span className="pay-amount">{formatCurrency(payAmount)}</span>
                          </div>
                        </div>

                        <button
                          className="btn btn-upi"
                          onClick={handleOpenUpiApp}
                          disabled={countdown.isExpired}
                        >
                          <span className="upi-icon">📱</span>
                          Pay via UPI App
                        </button>
                      </div>
                    )}

                    <button className="cod-link" onClick={handlePlaceCodOrder}>
                      Pay via Cash on Delivery
                    </button>
                  </>
                )}
              </>
            ) : (
              <p className="amount-hint">
                Enter a valid amount to see payment options
              </p>
            )}
          </>
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
