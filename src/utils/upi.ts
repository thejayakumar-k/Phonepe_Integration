import type { MerchantConfig } from '../types/payment';

/**
 * Generate UPI payment string for QR code
 * Format as per UPI QR code specification
 * 
 * Note: Static QR codes contain the merchant UPI ID and name.
 * Dynamic amount can be embedded in the QR if the merchant's UPI
 * collection supports it. For PhonePe Business static QR, the
 * customer enters the amount manually after scanning.
 */
export function generateUpiString(
  merchant: MerchantConfig,
  amount?: number,
  orderId?: string
): string {
  // UPI URI format: upi://pay?pa=...&pn=...&am=...&tn=...
  const params = new URLSearchParams({
    pa: merchant.upiId,        // Payee (merchant) UPI ID
    pn: merchant.merchantName, // Payee name
    cu: 'INR',                 // Currency
  });

  // Add amount if provided (dynamic QR).
  // Send as clean integer when possible - many UPI apps misread
  // decimal amounts (e.g., "1.00") in upi:// links and reject them.
  if (amount && amount > 0) {
    params.set('am', Number.isInteger(amount) ? String(amount) : amount.toFixed(2));
  }

  // Add transaction note with order ID
  if (orderId) {
    params.set('tn', `Payment for Order ${orderId}`);
  }

  return `upi://pay?${params.toString()}`;
}

/**
 * Validate UPI ID format
 * Basic validation: should contain @ and have minimum length
 */
export function isValidUpiId(upiId: string): boolean {
  const upiRegex = /^[\w.\-]+@[\w]+$/;
  return upiRegex.test(upiId);
}

/**
 * Format currency in Indian Rupees
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get payment status display text
 */
export function getPaymentStatusText(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Awaiting Payment';
    case 'CUSTOMER_SUBMITTED':
      return 'Payment Verification Pending';
    case 'PAID':
      return 'Payment Verified';
    case 'FAILED':
      return 'Payment Failed';
    case 'EXPIRED':
      return 'Payment Session Expired';
    case 'COD_PLACED':
      return 'Order Placed (Cash on Delivery)';
    case 'CANCELLED':
      return 'Payment Cancelled';
    default:
      return 'Unknown Status';
  }
}

/**
 * Get payment status color class
 */
export function getPaymentStatusColor(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'status-pending';
    case 'CUSTOMER_SUBMITTED':
      return 'status-submitted';
    case 'PAID':
      return 'status-paid';
    case 'FAILED':
      return 'status-failed';
    case 'EXPIRED':
      return 'status-expired';
    case 'COD_PLACED':
      return 'status-cod';
    case 'CANCELLED':
      return 'status-cancelled';
    default:
      return 'status-pending';
  }
}
