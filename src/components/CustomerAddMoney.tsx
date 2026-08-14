import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../auth/AuthContext';
import { generateUpiString } from '../utils/upi';

type PaymentMethod = 'upi' | 'qr' | 'virtual';

const merchantUpiId = import.meta.env.VITE_MERCHANT_UPI_ID || 'merchant@phonepe';
const merchantName = import.meta.env.VITE_MERCHANT_NAME || 'OORUNII Store';

const virtualAccount = {
  accountNumber: '12345678901234',
  ifsc: 'ORUN0001234',
  accountName: merchantName,
  bankName: 'HDFC Bank',
};

export function CustomerAddMoney() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [amount, setAmount] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('upi');
  const [copied, setCopied] = useState('');

  const amountValue = parseFloat(amount);
  const amountError = amount
    ? amountValue < 50
      ? 'Minimum amount is ₹50'
      : amountValue > 10000
        ? 'Maximum amount is ₹10,000'
        : ''
    : '';

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleSendRequest = () => {
    // Generate UPI string and navigate to payment app
    const orderId = `AM${Date.now()}`;
    window.location.href = generateUpiString(
      { upiId: merchantUpiId, merchantName },
      parseFloat(amount) || 0,
      orderId,
      `${session?.customerName || 'Customer'} ${orderId}`
    );
  };

  const qrOrderId = `QR${Date.now()}`;

  const upiString = generateUpiString(
    { upiId: merchantUpiId, merchantName },
    parseFloat(amount) || 0,
    qrOrderId,
    `${session?.customerName || 'Customer'} ${qrOrderId}`
  );

  return (
    <div className="customer-add-money">
      <div className="add-money-header">
        <button className="back-btn" onClick={() => navigate('/customer/settings')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1>Add Money</h1>
      </div>

      <div className="add-money-content">
        <div className="amount-section">
          <label className="amount-label">Enter Amount</label>
          <div className="amount-input-wrap">
            <span className="amount-currency">₹</span>
            <input
              type="number"
              className="amount-input"
              placeholder="100"
              min="50"
              max="10000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          {amountError ? (
            <span className="amount-error-text">{amountError}</span>
          ) : (
            <span className="amount-hint-text">Min: ₹50 - Max: ₹10,000</span>
          )}
        </div>

        <div className="payment-methods-section">
          <span className="payment-methods-title">Select Payment Method</span>
          <div className="payment-methods-grid">
            <button 
              className={`payment-method-option ${selectedPayment === 'upi' ? 'active' : ''}`}
              onClick={() => setSelectedPayment('upi')}
            >
              <span className="payment-method-name">UPI</span>
            </button>

            <button 
              className={`payment-method-option ${selectedPayment === 'qr' ? 'active' : ''}`}
              onClick={() => setSelectedPayment('qr')}
            >
              <span className="payment-method-name">QR Code</span>
            </button>

            <button 
              className={`payment-method-option ${selectedPayment === 'virtual' ? 'active' : ''}`}
              onClick={() => setSelectedPayment('virtual')}
            >
              <span className="payment-method-name">Virtual Account</span>
            </button>
          </div>
        </div>

        {/* UPI Section */}
        {selectedPayment === 'upi' && (
          <div className="payment-detail-section upi-detail">
            <span className="payment-detail-title">Payment Method</span>
            <p className="upi-desc">Pay using UPI App</p>
            <p className="upi-hint">We will open your UPI app directly (no UPI id needed).</p>
            <button className="btn-send-request" onClick={handleSendRequest} disabled={!amount || parseFloat(amount) < 50}>
              📤 Send Payment Request
            </button>
          </div>
        )}

        {/* QR Code Section */}
        {selectedPayment === 'qr' && (
          <div className="payment-detail-section qr-detail">
            {amount && parseFloat(amount) >= 50 ? (
              <>
                <div className="qr-code-box">
                  <QRCodeSVG
                    value={upiString}
                    size={180}
                    bgColor="#ffffff"
                    fgColor="#1a1a2e"
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <div className="qr-upi-id">
                  <span className="qr-upi-label">UPI ID</span>
                  <span className="qr-upi-value">{merchantUpiId}</span>
                </div>
                <p className="qr-instruction">Scan this QR code with any UPI app</p>
                <button className="btn-payment-completed" onClick={() => {
                  navigate(`/payment-verification?orderId=${qrOrderId}&amount=${amount}`);
                }}>
                  ✅ Payment Completed
                </button>
              </>
            ) : (
              <p className="qr-placeholder">Enter amount to generate QR code</p>
            )}
          </div>
        )}

        {/* Virtual Account Section */}
        {selectedPayment === 'virtual' && (
          <div className="payment-detail-section virtual-detail">
            <div className="virtual-account-card">
              <div className="virtual-row">
                <div className="virtual-info">
                  <span className="virtual-label">Account Name</span>
                  <span className="virtual-value">{virtualAccount.accountName}</span>
                </div>
                <button className="copy-btn" onClick={() => handleCopy(virtualAccount.accountName, 'name')}>
                  {copied === 'name' ? '✓' : '📋'}
                </button>
              </div>

              <div className="virtual-row">
                <div className="virtual-info">
                  <span className="virtual-label">Account Number</span>
                  <span className="virtual-value">{virtualAccount.accountNumber}</span>
                </div>
                <button className="copy-btn" onClick={() => handleCopy(virtualAccount.accountNumber, 'account')}>
                  {copied === 'account' ? '✓' : '📋'}
                </button>
              </div>

              <div className="virtual-row">
                <div className="virtual-info">
                  <span className="virtual-label">IFSC Code</span>
                  <span className="virtual-value">{virtualAccount.ifsc}</span>
                </div>
                <button className="copy-btn" onClick={() => handleCopy(virtualAccount.ifsc, 'ifsc')}>
                  {copied === 'ifsc' ? '✓' : '📋'}
                </button>
              </div>

              <div className="virtual-row">
                <div className="virtual-info">
                  <span className="virtual-label">Bank Name</span>
                  <span className="virtual-value">{virtualAccount.bankName}</span>
                </div>
              </div>
            </div>
            <p className="virtual-note">Transfer the amount to this account. It will be credited within 2-4 hours.</p>
          </div>
        )}


      </div>
    </div>
  );
}
