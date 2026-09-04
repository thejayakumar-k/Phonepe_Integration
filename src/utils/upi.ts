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
  orderId?: string,
  note?: string
): string {
  // UPI URI format per NPCI spec: upi://pay?pa=...&pn=...&am=...&tn=...
  // IMPORTANT: UPI apps expect literal '@' in pa and literal spaces in pn.
  // Do NOT use URLSearchParams — it encodes '@' → '%40' and spaces → '+',
  // which causes GPay/PhonePe to reject the VPA.
  const pairs: string[] = [
    `pa=${merchant.upiId}`,
    `pn=${encodeURIComponent(merchant.merchantName)}`,
    `cu=INR`,
  ];

  // Add amount if provided (dynamic QR).
  if (amount && amount > 0) {
    pairs.push(`am=${Number.isInteger(amount) ? String(amount) : amount.toFixed(2)}`);
  }

  // Add transaction note (customer name + order number)
  if (note) {
    pairs.push(`tn=${encodeURIComponent(note)}`);
  } else if (orderId) {
    pairs.push(`tn=${orderId}`);
  }

  // Add unique transaction reference to help banks identify legitimate
  // business transactions and reduce "risky" fraud detection flags.
  const tr = orderId
    ? `TXN${orderId}${Date.now()}`
    : `TXN${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  pairs.push(`tr=${encodeURIComponent(tr)}`);

  return `upi://pay?${pairs.join('&')}`;
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
 * Known valid UPI PSP handles (Payment Service Provider suffixes).
 * Used to warn if the configured UPI ID might not be valid.
 */
const KNOWN_UPI_HANDLES = [
  '@okaxis', '@okhdfcbank', '@okicici', '@okbank', '@okbis',
  '@okicici', '@oksbi', '@okubi', '@okpunjab',
  '@ybl', '@ibl', '@axl', '@sbi', '@paytm', '@phonepe',
  '@gokwik', '@icici', '@hdfcbank', '@axisbank', '@kotak',
  '@upi', '@nsdl', '@jio', '@fam', '@slice', '@cub',
  '@aubank', '@indus', '@bob', '@pnb', '@canara',
  '@federal', '@southindian', '@karurvysya', '@cityunion',
];

/**
 * Check if a UPI ID looks like it uses a known PSP handle.
 * Returns true if recognized, false if the handle is unknown (but may still be valid).
 */
export function isKnownUpiHandle(upiId: string): boolean {
  const lower = upiId.toLowerCase();
  return KNOWN_UPI_HANDLES.some((h) => lower.endsWith(h));
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
 * Format a date with date and time (en-IN locale)
 */
export function formatDateTime(date: Date | number | string): string {
  const value = date instanceof Date ? date : new Date(date);
  return value.toLocaleString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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
