import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { generateTxnId, submitPayUPayment, getPayUConfig, getAppUrl } from '../utils/payu';
import { formatCurrency } from '../utils/upi';
import { saveOrder, getActiveUpiId } from '../utils/storage';
import type { Order } from '../types/payment';

type PayMethod = 'upi' | 'card' | 'netbanking';

export function PayUCheckout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();

  const [amount, setAmount] = useState(() => searchParams.get('amount') || '');
  const [payMethod, setPayMethod] = useState<PayMethod>('upi');
  const [upiId, setUpiId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const amountValue = parseFloat(amount);
  const amountValid = Number.isFinite(amountValue) && amountValue > 0;
  const minAmount = 1;
  const maxAmount = 100000;

  const handlePay = useCallback(async () => {
    if (!amountValid || amountValue < minAmount || amountValue > maxAmount) {
      setError(`Amount must be between ₹${minAmount} and ₹${maxAmount.toLocaleString('en-IN')}`);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const config = getPayUConfig();
      const appUrl = getAppUrl();
      const orderId = `PU${Date.now()}`;
      const txnId = generateTxnId(orderId);

      // Create order record
      const order: Order = {
        orderId,
        vendorId: 'VENDOR001',
        vendorName: import.meta.env.VITE_MERCHANT_NAME || 'OORUNII Store',
        customerId: session?.customerId,
        customerName: session?.customerName,
        amount: amountValue,
        currency: 'INR',
        description: `PayU Payment - ${payMethod.toUpperCase()}`,
        createdAt: Date.now(),
        expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
        paymentStatus: 'PENDING',
        paymentMethod: 'PAYU',
      };
      saveOrder(order);

      // Submit to PayU
      await submitPayUPayment(
        config,
        {
          txnid: txnId,
          amount: amountValue,
          productinfo: `OORUNII Order ${orderId}`,
          firstname: session?.customerName || 'Customer',
          email: `${session?.customerId || 'cust'}@oorunii.com`,
          phone: '9999999999',
          surl: `${appUrl}/payu/success?oid=${orderId}`,
          furl: `${appUrl}/payu/failure?oid=${orderId}`,
          pg: payMethod === 'upi' ? 'UPI' : payMethod === 'card' ? 'CC' : 'NB',
          udf1: orderId,
          udf2: session?.customerId || '',
          udf3: payMethod,
        },
        appUrl
      );
    } catch (err) {
      setError('Failed to initiate payment. Please try again.');
      setLoading(false);
    }
  }, [amountValue, amountValid, payMethod, session]);

  return (
    <div className="payu-checkout">
      <div className="payu-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1>PayU Payment</h1>
        <span className="payu-badge">UAT</span>
      </div>

      <div className="payu-content">
        {/* Amount */}
        <div className="payu-amount-section">
          <label className="payu-label" htmlFor="payu-amount">Amount</label>
          <div className="payu-amount-input-wrap">
            <span className="payu-currency">₹</span>
            <input
              id="payu-amount"
              className="payu-amount-input"
              type="number"
              min={minAmount}
              max={maxAmount}
              step="1"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
              disabled={loading}
            />
          </div>
          <span className="payu-range-hint">
            Min: ₹{minAmount} — Max: ₹{maxAmount.toLocaleString('en-IN')}
          </span>
        </div>

        {/* Payment Method */}
        <div className="payu-method-section">
          <span className="payu-label">Payment Method</span>
          <div className="payu-method-tabs">
            <button
              className={`payu-method-tab ${payMethod === 'upi' ? 'active' : ''}`}
              onClick={() => setPayMethod('upi')}
              disabled={loading}
            >
              <span className="payu-method-icon">📱</span>
              UPI
            </button>
            <button
              className={`payu-method-tab ${payMethod === 'card' ? 'active' : ''}`}
              onClick={() => setPayMethod('card')}
              disabled={loading}
            >
              <span className="payu-method-icon">💳</span>
              Card
            </button>
            <button
              className={`payu-method-tab ${payMethod === 'netbanking' ? 'active' : ''}`}
              onClick={() => setPayMethod('netbanking')}
              disabled={loading}
            >
              <span className="payu-method-icon">🏦</span>
              Net Banking
            </button>
          </div>
        </div>

        {/* UPI ID (optional — for collect request) */}
        {payMethod === 'upi' && (
          <div className="payu-upi-section">
            <label className="payu-label" htmlFor="payu-vpa">
              UPI ID (VPA) <span className="payu-optional">optional</span>
            </label>
            <input
              id="payu-vpa"
              className="payu-input"
              type="text"
              placeholder="name@upi"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              disabled={loading}
            />
            <span className="payu-hint">
              Leave blank to pay via PayU's payment page. Enter a VPA to send a collect request.
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="payu-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Order Summary */}
        {amountValid && (
          <div className="payu-summary">
            <div className="payu-summary-row">
              <span>Amount</span>
              <span>{formatCurrency(amountValue)}</span>
            </div>
            <div className="payu-summary-row">
              <span>Platform Fee</span>
              <span className="payu-free">FREE</span>
            </div>
            <div className="payu-summary-row payu-total">
              <span>Total</span>
              <span>{formatCurrency(amountValue)}</span>
            </div>
          </div>
        )}

        {/* Pay Button */}
        <button
          className="payu-pay-btn"
          onClick={handlePay}
          disabled={!amountValid || loading}
        >
          {loading ? (
            <>
              <span className="payu-spinner" />
              Redirecting to PayU...
            </>
          ) : (
            <>
              Pay {amountValid ? formatCurrency(amountValue) : ''}
            </>
          )}
        </button>

        {/* Info */}
        <div className="payu-info">
          <div className="payu-info-row">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Secured by PayU — 256-bit SSL encryption</span>
          </div>
          <div className="payu-info-row">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Test mode — no real money will be deducted</span>
          </div>
          <div className="payu-info-row">
            <span className="payu-env-badge">SANDBOX</span>
            <span>Merchant Key: {getPayUConfig().key}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
