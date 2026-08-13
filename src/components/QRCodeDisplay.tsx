import type { ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { generateUpiString, formatCurrency } from '../utils/upi';
import type { MerchantConfig } from '../types/payment';

interface QRCodeDisplayProps {
  merchant: MerchantConfig;
  amount: number;
  orderId: string;
  disabled?: boolean;
  timer?: ReactNode;
  onInitiatePayment?: () => void;
}

export function QRCodeDisplay({ merchant, amount, orderId, disabled = false, timer, onInitiatePayment }: QRCodeDisplayProps) {
  const upiString = generateUpiString(merchant, amount, orderId);

  const handleOpenUpiApp = () => {
    onInitiatePayment?.();
    // Launch the UPI intent via an invisible iframe. Some phones resolve
    // this like a native app-to-app intent, unlike anchor clicks or
    // location redirects which can mangle the URI.
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = upiString;
    document.body.appendChild(iframe);
    window.setTimeout(() => iframe.remove(), 1000);
  };

  return (
    <div className={`qr-section ${disabled ? 'disabled' : ''}`}>
      <div className="scan-header">
        <h3 className="scan-title">Scan & Pay</h3>
        {timer && <div className="scan-timer">{timer}</div>}
      </div>
      
      <div className="qr-container">
        <QRCodeSVG
          value={upiString}
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
          <span className="pay-amount">{formatCurrency(amount)}</span>
        </div>
      </div>

      {/* Open UPI App Button */}
      <button 
        className="btn btn-upi"
        onClick={handleOpenUpiApp}
        disabled={disabled}
      >
        <span className="upi-icon">📱</span>
        Pay via UPI App
      </button>

      <div className="payment-instructions">
        <p className="instruction-step">
          <span className="step-number">1</span>
          Tap "Pay via UPI App" or scan QR
        </p>
        <p className="instruction-step">
          <span className="step-number">2</span>
          Select your UPI app (PhonePe, GPay, Paytm)
        </p>
        <p className="instruction-step">
          <span className="step-number">3</span>
          Enter amount: <strong>{formatCurrency(amount)}</strong>
        </p>
        <p className="instruction-step">
          <span className="step-number">4</span>
          Complete the payment
        </p>
      </div>
    </div>
  );
}
