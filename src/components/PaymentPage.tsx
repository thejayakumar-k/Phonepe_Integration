import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import type { Order, MerchantConfig } from '../types/payment';
import { OrderSummary } from './OrderSummary';
import { PaymentTimer } from './PaymentTimer';
import { PaymentStatus } from './PaymentStatus';
import { useCountdown } from '../hooks/useCountdown';
import { useOrderStatus } from '../hooks/useOrderStatus';
import { saveOrder, getOrder, getPreferredBankAccount } from '../utils/storage';
import { generateUpiString, formatCurrency, isKnownUpiHandle } from '../utils/upi';
import { useAuth } from '../auth/AuthContext';

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
  const { session } = useAuth();
  const { order: storedOrder } = useOrderStatus(initialOrder.orderId);
  const preferredBank = getPreferredBankAccount(session?.customerId || initialOrder.customerId || '');
  const [order, setOrder] = useState<Order>(initialOrder);
  const [amountInput, setAmountInput] = useState(() =>
    String(initialOrder.amount || '')
  );
  const [paymentRequestSent, setPaymentRequestSent] = useState(false);
  const [payTab, setPayTab] = useState<'upi' | 'qr'>('upi');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [showGpayGuide, setShowGpayGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const guideTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [guideCountdown, setGuideCountdown] = useState(120);

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

  // AUTO-DETECT: When customer returns from PhonePe, auto-show "Verifying payment..."
  // Only triggers if the customer actually started a PhonePe payment (tapped
  // "Pay with PhonePe") AND left the page first, so login / initial load
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
        // Customer returned to the page after starting a PhonePe payment
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

  // GPay Guide overlay
  const openGpayWithGuide = useCallback(() => {
    // Copy UPI ID to clipboard
    navigator.clipboard.writeText(merchant.upiId).catch(() => {});
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);

    // Show guide overlay
    setShowGpayGuide(true);
    setGuideStep(0);
    setGuideCountdown(120);

    // Start countdown
    if (guideTimerRef.current) clearInterval(guideTimerRef.current);
    guideTimerRef.current = setInterval(() => {
      setGuideCountdown((prev) => {
        if (prev <= 1) {
          if (guideTimerRef.current) clearInterval(guideTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Open GPay via Android Intent (better compatibility) or gpay:// fallback
    const isAndroid = /android/i.test(navigator.userAgent);
    if (isAndroid) {
      // Android Intent URI — opens GPay directly
      window.location.href =
        'intent://upi-pay#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end';
    } else {
      window.location.href = 'gpay://';
    }
  }, [merchant.upiId]);

  const closeGpayGuide = useCallback(() => {
    setShowGpayGuide(false);
    setGuideStep(0);
    if (guideTimerRef.current) clearInterval(guideTimerRef.current);
  }, []);

  // Cleanup guide timer on unmount
  useEffect(() => {
    return () => {
      if (guideTimerRef.current) clearInterval(guideTimerRef.current);
    };
  }, []);

  const canRestart =
    order.paymentStatus === 'EXPIRED' ||
    order.paymentStatus === 'FAILED' ||
    order.paymentStatus === 'CANCELLED';

  const payAmount = useMemo(() => {
    const parsed = parseFloat(amountInput);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : order.amount;
  }, [amountInput, order.amount]);

  const amountValid = payAmount > 0;
  const upiIdLooksValid = isKnownUpiHandle(merchant.upiId);

  const handleAmountChange = (value: string) => {
    setAmountInput(value);
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      setOrder((prev) => ({ ...prev, amount: parsed }));
    }
  };

  const handleOpenUpiApp = useCallback(() => {
    hasInitiatedRef.current = true;
    // Launch PhonePe with the amount only (no reference note).
    const upiString = generateUpiString(merchant, payAmount);
    window.location.href = upiString;
  }, [merchant, payAmount]);

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
        <p className="brand-subtitle">Secure PhonePe Payment</p>
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

            {/* PhonePe / QR Tabs */}
            <div className="fund-tabs" role="tablist">
              <button
                className={`fund-tab ${payTab === 'upi' ? 'active' : ''}`}
                role="tab"
                aria-selected={payTab === 'upi'}
                onClick={() => setPayTab('upi')}
              >
                PhonePe
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
                          <span className="detail-value">PhonePe</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Order ID:</span>
                          <span className="detail-value">{order.orderId}</span>
                        </div>
                      </div>
                      <div className="request-status">
                        <p>Please accept the request in your PhonePe app.</p>
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

                        {preferredBank && (
                          <div className="preferred-bank-banner">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="1" y="3" width="22" height="18" rx="2" ry="2"/>
                              <line x1="1" y1="9" x2="23" y2="9"/>
                            </svg>
                            <div className="preferred-bank-info">
                              <span className="preferred-bank-label">Linked Bank</span>
                              <span className="preferred-bank-name">
                                {preferredBank.bankName} {preferredBank.maskedAccountNumber}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* UPI ID Display with Copy */}
                        <div className="upi-id-display-box">
                          <div className="upi-id-row">
                            <div className="upi-id-text-wrap">
                              <span className="upi-id-label">Merchant UPI ID</span>
                              <span className="upi-id-value">{merchant.upiId}</span>
                            </div>
                            <button
                              className="upi-copy-btn"
                              onClick={() => {
                                navigator.clipboard.writeText(merchant.upiId);
                                setCopiedUpi(true);
                                setTimeout(() => setCopiedUpi(false), 2000);
                              }}
                            >
                              {copiedUpi ? (
                                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> Copied</>
                              ) : (
                                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
                              )}
                            </button>
                          </div>
                          <div className="upi-id-amount-row">
                            <span className="upi-id-label">Amount</span>
                            <span className="upi-id-amount">{formatCurrency(payAmount)}</span>
                          </div>
                        </div>

                        {/* Direct UPI Link Button */}
                        <button
                          className="btn btn-upi"
                          onClick={handleOpenUpiApp}
                          disabled={countdown.isExpired}
                        >
                          <span className="upi-icon">📱</span>
                          Pay with PhonePe
                        </button>

                        {/* Copy & Open GPay / Any UPI App */}
                        <button
                          className="btn btn-upi-copy"
                          onClick={openGpayWithGuide}
                          disabled={countdown.isExpired}
                        >
                          <span className="upi-icon">💬</span>
                          Copy UPI ID & Open GPay
                        </button>

                        <div className="payment-instructions">
                          {preferredBank && (
                            <p className="instruction-step instruction-info">
                              <span className="step-number">ℹ</span>
                              Please complete the UPI payment using your linked bank account ({preferredBank.bankName} {preferredBank.maskedAccountNumber}).
                            </p>
                          )}
                          <p className="instruction-step">
                            <span className="step-number">1</span>
                            Tap &quot;Copy UPI ID &amp; Open GPay&quot;
                          </p>
                          <p className="instruction-step">
                            <span className="step-number">2</span>
                            In GPay, tap <strong>Pay anyone</strong>
                          </p>
                          <p className="instruction-step">
                            <span className="step-number">3</span>
                            Paste the UPI ID and enter amount: <strong>{formatCurrency(payAmount)}</strong>
                          </p>
                          <p className="instruction-step">
                            <span className="step-number">4</span>
                            Select your linked bank and complete payment
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
                            value={generateUpiString(
                              merchant,
                              payAmount,
                              order.orderId,
                              `${order.customerName || 'Customer'} ${order.orderId}`
                            )}
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
                          {!upiIdLooksValid && (
                            <p className="payment-warning" style={{fontSize: '0.75rem', color: '#e67e22', marginTop: '4px'}}>
                              ⚠️ UPI ID "{merchant.upiId}" uses an uncommon handle. If payment fails, check your UPI ID in Vendor Settings.
                            </p>
                          )}
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
                          Pay with PhonePe
                        </button>
                      </div>
                    )}

                    <button className="cod-link" onClick={handlePlaceCodOrder}>
                      Pay via Cash on Delivery
                    </button>

                    <div className="upi-limit-note">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                      </svg>
                      <p>If payment fails with &quot;exceeded bank limit&quot;, try a smaller amount or check your UPI daily limit in your bank app.</p>
                    </div>
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

      {/* Clipboard Toast — persists while user is in GPay */}
      {copiedUpi && !showGpayGuide && (
        <div className="upi-clipboard-toast">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <span>UPI ID <strong>{merchant.upiId}</strong> copied to clipboard</span>
        </div>
      )}

      {/* GPay Guide Overlay */}
      {showGpayGuide && (
        <div className="gpay-guide-overlay" onClick={closeGpayGuide}>
          <div className="gpay-guide-card" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="gpay-guide-header">
              <div className="gpay-guide-title-row">
                <h3>Complete Payment in GPay</h3>
                <button className="gpay-guide-close" onClick={closeGpayGuide}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              {/* Timer */}
              <div className="gpay-guide-timer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>{Math.floor(guideCountdown / 60)}:{(guideCountdown % 60).toString().padStart(2, '0')}</span>
                <span className="gpay-guide-timer-label">remaining</span>
              </div>
            </div>

            {/* UPI ID Box (copied) */}
            <div className="gpay-guide-upi-box">
              <span className="gpay-guide-upi-label">UPI ID (copied to clipboard)</span>
              <div className="gpay-guide-upi-value">
                <span>{merchant.upiId}</span>
                <button
                  className="gpay-guide-copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(merchant.upiId).catch(() => {});
                    setCopiedUpi(true);
                    setTimeout(() => setCopiedUpi(false), 2000);
                  }}
                >
                  {copiedUpi ? '✓ Copied' : '📋 Copy'}
                </button>
              </div>
              <span className="gpay-guide-upi-amount">Amount: {formatCurrency(payAmount)}</span>
            </div>

            {/* Steps */}
            <div className="gpay-guide-steps">
              {[
                {
                  icon: '📱',
                  title: 'GPay is opening...',
                  desc: "If it didn't open, open GPay manually",
                },
                {
                  icon: '👆',
                  title: "Tap 'Pay anyone'",
                  desc: "In GPay home screen, find the 'Pay anyone' button",
                },
                {
                  icon: '📋',
                  title: 'Paste UPI ID',
                  desc: 'Tap the search field and paste the UPI ID from clipboard',
                },
                {
                  icon: '💰',
                  title: `Enter amount: ${formatCurrency(payAmount)}`,
                  desc: 'Type the exact amount shown above',
                 },
                {
                  icon: '🏦',
                  title: preferredBank ? `Select ${preferredBank.bankName}` : 'Select your bank',
                  desc: preferredBank
                    ? `Choose ${preferredBank.bankName} ${preferredBank.maskedAccountNumber}`
                    : 'Pick the bank account you want to pay from',
                },
                {
                  icon: '✅',
                  title: 'Enter PIN & Pay',
                  desc: 'Complete the payment with your UPI PIN',
                },
              ].map((step, idx) => (
                <div
                  key={idx}
                  className={`gpay-guide-step ${idx <= guideStep ? 'active' : ''} ${idx < guideStep ? 'done' : ''}`}
                  onClick={() => setGuideStep(idx + 1)}
                >
                  <div className="gpay-guide-step-num">
                    {idx < guideStep ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                  <div className="gpay-guide-step-content">
                    <div className="gpay-guide-step-title">
                      <span>{step.icon}</span> {step.title}
                    </div>
                    <div className="gpay-guide-step-desc">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="gpay-guide-footer">
              <p>UPI ID is in your clipboard — paste it in GPay</p>
              <button className="gpay-guide-done-btn" onClick={closeGpayGuide}>
                Done — I've Completed Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
