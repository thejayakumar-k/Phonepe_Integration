import type { PaymentStatus as PaymentStatusType } from '../types/payment';
import { getPaymentStatusText, getPaymentStatusColor } from '../utils/upi';

interface PaymentStatusProps {
  status: PaymentStatusType;
  onRestartPayment?: () => void;
  onCancelPayment?: () => void;
  onReturnHome?: () => void;
  canRestart?: boolean;
}

export function PaymentStatus({
  status,
  onRestartPayment,
  onCancelPayment,
  onReturnHome,
  canRestart = false,
}: PaymentStatusProps) {
  const statusColor = getPaymentStatusColor(status);
  const statusText = getPaymentStatusText(status);

  return (
    <div className={`payment-status-section ${statusColor}`}>
      <div className="status-badge">
        <span className="status-indicator" />
        <span className="status-text">{statusText}</span>
      </div>

      {status === 'PENDING' && (
        <div className="status-actions">
          <p className="status-message">
            Scan the QR code or tap "Pay via UPI App" to complete payment.
          </p>
          {onCancelPayment && (
            <button
              className="btn btn-cancel"
              onClick={onCancelPayment}
            >
              Cancel Payment
            </button>
          )}
        </div>
      )}

      {status === 'CUSTOMER_SUBMITTED' && (
        <div className="status-actions">
          <div className="success-notice">
            <span className="notice-icon">✅</span>
            <div className="notice-content">
              <p className="notice-title">Order Placed!</p>
              <p className="notice-text">
                Your order is confirmed. Payment verification is pending -
                the vendor will approve it shortly.
              </p>
            </div>
          </div>
          {onReturnHome && (
            <button className="btn btn-secondary" onClick={onReturnHome}>
              Return to Home
            </button>
          )}
        </div>
      )}

      {status === 'COD_PLACED' && (
        <div className="status-actions">
          <div className="cod-notice">
            <span className="notice-icon">💵</span>
            <div className="notice-content">
              <p className="notice-title">Order Placed!</p>
              <p className="notice-text">
                Your order has been confirmed. Please keep the cash ready to pay on delivery.
              </p>
            </div>
          </div>
          {onReturnHome && (
            <button className="btn btn-secondary" onClick={onReturnHome}>
              Return to Home
            </button>
          )}
        </div>
      )}

      {status === 'PAID' && (
        <div className="status-actions">
          <div className="success-notice">
            <span className="notice-icon">✅</span>
            <div className="notice-content">
              <p className="notice-title">Payment Successful!</p>
              <p className="notice-text">
                Your payment has been confirmed. Thank you for your order!
              </p>
            </div>
          </div>
        </div>
      )}

      {status === 'CANCELLED' && (
        <div className="status-actions">
          <div className="cancelled-notice">
            <span className="notice-icon">✋</span>
            <div className="notice-content">
              <p className="notice-title">Payment Cancelled</p>
              <p className="notice-text">
                Your payment has been cancelled. You can restart the payment anytime.
              </p>
            </div>
          </div>
          {canRestart && (
            <button
              className="btn btn-secondary"
              onClick={onRestartPayment}
            >
              Restart Payment
            </button>
          )}
          {onReturnHome && (
            <button className="btn btn-primary" onClick={onReturnHome}>
              Return to Home
            </button>
          )}
        </div>
      )}

      {status === 'FAILED' && (
        <div className="status-actions">
          <div className="failed-notice">
            <span className="notice-icon">❌</span>
            <div className="notice-content">
              <p className="notice-title">Payment Failed</p>
              <p className="notice-text">
                Your payment could not be verified. Please contact support or try again.
              </p>
            </div>
          </div>
          {canRestart && (
            <button 
              className="btn btn-secondary"
              onClick={onRestartPayment}
            >
              Restart Payment
            </button>
          )}
          {onReturnHome && (
            <button className="btn btn-primary" onClick={onReturnHome}>
              Return to Home
            </button>
          )}
        </div>
      )}

      {status === 'EXPIRED' && (
        <div className="status-actions">
          <div className="expired-notice">
            <span className="notice-icon">⏰</span>
            <div className="notice-content">
              <p className="notice-title">Session Expired</p>
              <p className="notice-text">
                The payment session has expired. If you have already made a payment,
                please contact support with your UPI transaction reference.
              </p>
            </div>
          </div>
          {canRestart && (
            <button 
              className="btn btn-secondary"
              onClick={onRestartPayment}
            >
              Restart Payment
            </button>
          )}
          {onReturnHome && (
            <button className="btn btn-primary" onClick={onReturnHome}>
              Return to Home
            </button>
          )}
        </div>
      )}
    </div>
  );
}
