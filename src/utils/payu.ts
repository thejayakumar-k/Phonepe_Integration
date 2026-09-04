/**
 * PayU Payment Gateway Integration Utilities
 *
 * Flow:
 * 1. Generate a unique transaction ID (txnid)
 * 2. Compute SHA-512 hash: SHA512(key|txnid|amount|productinfo|firstname|email|udf1-udf10|salt)
 * 3. POST form data to PayU's payment URL
 * 4. PayU processes payment, redirects to success_url or failure_url
 * 5. On callback, verify the response hash server-side
 *
 * IMPORTANT: Hash generation MUST be done server-side in production.
 * This client-side implementation is for UAT/testing only.
 */

import type { PayUConfig, PayUPaymentParams, PayUCallbackParams } from '../types/payment';

// ── PayU Test / Sandbox Configuration ──────────────────────────────────────

export const PAYU_TEST_CONFIG: PayUConfig = {
  key: import.meta.env.VITE_PAYU_MERCHANT_KEY || 'GvCowP',
  salt: import.meta.env.VITE_PAYU_MERCHANT_SALT || 'c7XPAxKOyDUEd72Qs7FdO057doJuYru4',
  // UAT / Sandbox endpoint
  paymentUrl: 'https://sandbox.payu.in/_payment',
  // Production endpoint (uncomment for live)
  // paymentUrl: 'https://secure.payu.in/_payment',
};

// ── SHA-512 Hash Generation ────────────────────────────────────────────────

/**
 * Compute SHA-512 hash using the Web Crypto API.
 * PayU requires: SHA512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10|salt)
 */
async function sha512(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-512', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate the PayU hash from payment parameters.
 *
 * Hash string format:
 *   key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5|||||||||salt
 */
export async function generatePayUHash(
  config: PayUConfig,
  params: PayUPaymentParams
): Promise<string> {
  const udf1 = params.udf1 ?? '';
  const udf2 = params.udf2 ?? '';
  const udf3 = params.udf3 ?? '';
  const udf4 = params.udf4 ?? '';
  const udf5 = params.udf5 ?? '';

  const hashString = [
    config.key,
    params.txnid,
    params.amount,
    params.productinfo,
    params.firstname,
    params.email,
    udf1, udf2, udf3, udf4, udf5,
    '', '', '', '', '', '', '', '', '', // udf6–udf10 (empty)
    config.salt,
  ].join('|');

  return sha512(hashString);
}

/**
 * Generate the PayU response hash for verification.
 *
 * Response hash string format:
 *   salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
 */
export async function generatePayUResponseHash(
  config: PayUConfig,
  params: PayUCallbackParams
): Promise<string> {
  const hashString = [
    config.salt,
    params.status,
    '', '', '', '', // reverse order of empty udf6–udf10
    params.udf5 ?? '',
    params.udf4 ?? '',
    params.udf3 ?? '',
    params.udf2 ?? '',
    params.udf1 ?? '',
    params.email,
    params.firstname,
    params.productinfo,
    params.amount,
    params.txnid,
    config.key,
  ].join('|');

  return sha512(hashString);
}

// ── Transaction ID ─────────────────────────────────────────────────────────

/**
 * Generate a unique transaction ID for PayU.
 * PayU recommends: auto-generated, unique per transaction, max 25 chars.
 */
export function generateTxnId(orderId: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  // Keep under 25 chars; prefix with TXN for traceability
  const raw = `TXN${orderId}${ts}${rand}`;
  return raw.slice(0, 25);
}

// ── Form Submission ────────────────────────────────────────────────────────

/**
 * Build the hidden form and submit it to PayU.
 * This is the standard PayU integration method — a server-side rendered
 * form POST. For a pure SPA, we dynamically create and submit the form.
 */
export async function submitPayUPayment(
  config: PayUConfig,
  params: PayUPaymentParams,
  appUrl: string
): Promise<void> {
  const hash = await generatePayUHash(config, params);

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = config.paymentUrl;

  const fields: Record<string, string> = {
    key: config.key,
    txnid: params.txnid,
    amount: String(params.amount),
    productinfo: params.productinfo,
    firstname: params.firstname,
    email: params.email,
    phone: params.phone || '',
    surl: params.surl || `${appUrl}/payu/success`,
    furl: params.furl || `${appUrl}/payu/failure`,
    hash,
    // UPI specific — offer UPI as a payment option
    pg: params.pg || 'UPI',
    udf1: params.udf1 ?? '',
    udf2: params.udf2 ?? '',
    udf3: params.udf3 ?? '',
    udf4: params.udf4 ?? '',
    udf5: params.udf5 ?? '',
  };

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Get the app's base URL for PayU callback URLs.
 */
export function getAppUrl(): string {
  return import.meta.env.VITE_APP_URL || window.location.origin;
}

/**
 * Check if PayU is configured (key and salt are set).
 */
export function isPayUConfigured(): boolean {
  const key = import.meta.env.VITE_PAYU_MERCHANT_KEY;
  const salt = import.meta.env.VITE_PAYU_MERCHANT_SALT;
  return !!(key && salt);
}

/**
 * Get the current PayU config.
 */
export function getPayUConfig(): PayUConfig {
  return {
    key: import.meta.env.VITE_PAYU_MERCHANT_KEY || PAYU_TEST_CONFIG.key,
    salt: import.meta.env.VITE_PAYU_MERCHANT_SALT || PAYU_TEST_CONFIG.salt,
    paymentUrl: import.meta.env.VITE_PAYU_ENV === 'production'
      ? 'https://secure.payu.in/_payment'
      : PAYU_TEST_CONFIG.paymentUrl,
  };
}
