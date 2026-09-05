import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { getOrder, updateOrderStatus } from '../utils/storage';
import { generatePayUResponseHash, getPayUConfig } from '../utils/payu';
import { formatCurrency } from '../utils/upi';
import type { Order, PayUCallbackParams } from '../types/payment';

interface VerifyResult {
  verified: boolean;
  status: 'success' | 'failure' | 'error';
  message: string;
}

export function PayUCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [verifying, setVerifying] = useState(true);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

  const orderId = searchParams.get('oid') || searchParams.get('udf1') || '';

  useEffect(() => {
    async function verify() {
      try {
        // Gather PayU callback parameters
        const params: PayUCallbackParams = {
          txnid: searchParams.get('txnid') || '',
          amount: searchParams.get('amount') || '0',
          productinfo: searchParams.get('productinfo') || '',
          firstname: searchParams.get('firstname') || '',
          email: searchParams.get('email') || '',
          status: searchParams.get('status') || '',
          PayUOrderId: searchParams.get('PayUOrderId') || undefined,
          mihpayid: searchParams.get('mihpayid') || undefined,
          mode: searchParams.get('mode') || undefined,
          bankcode: searchParams.get('bankcode') || undefined,
          bank_ref_no: searchParams.get('bank_ref_no') || undefined,
          udf1: searchParams.get('udf1') || undefined,
          udf2: searchParams.get('udf2') || undefined,
          udf3: searchParams.get('udf3') || undefined,
          udf4: searchParams.get('udf4') || undefined,
          udf5: searchParams.get('udf5') || undefined,
          hash: searchParams.get('hash') || '',
          error: searchParams.get('error') || undefined,
        };

        const oid = params.udf1 || orderId;
        const config = getPayUConfig();

        // Verify hash
        let hashValid = false;
        if (params.hash) {
          const expectedHash = await generatePayUResponseHash(config, params);
          hashValid = expectedHash === params.hash;
        }

        if (!hashValid && params.hash) {
          // Hash mismatch — possible tampering
          setResult({
            verified: false,
            status: 'error',
            message: 'Payment verification failed. Hash mismatch detected.',
          });
          if (oid) {
            await updateOrderStatus(oid, 'FAILED');
          }
          setVerifying(false);
          return;
        }

        // Determine payment status
        if (params.status === 'success') {
          if (oid) {
            await updateOrderStatus(oid, 'PAID', params.PayUOrderId || params.bank_ref_no);
          }
          setResult({
            verified: true,
            status: 'success',
            message: `Payment of ${formatCurrency(parseFloat(params.amount))} was successful.`,
          });
        } else if (params.status === 'failure') {
          if (oid) {
            await updateOrderStatus(oid, 'FAILED');
          }
          setResult({
            verified: false,
            status: 'failure',
            message: params.error || 'Payment failed. Please try again.',
          });
        } else {
          // Pending or unknown status
          if (oid) {
            await updateOrderStatus(oid, 'FAILED');
          }
          setResult({
            verified: false,
            status: 'failure',
            message: `Payment status: ${params.status || 'unknown'}. ${params.error || ''}`,
          });
        }
      } catch (err) {
        setResult({
          verified: false,
          status: 'error',
          message: 'An error occurred while verifying your payment.',
        });
      } finally {
        setVerifying(false);
      }
    }

    verify();
  }, [searchParams, orderId]);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    getOrder(orderId).then((o) => {
      if (!cancelled) setOrder(o);
    });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return (
    <div className="payu-callback">
      <div className="payu-callback-card">
        {verifying ? (
          <>
            <div className="payu-callback-icon">⏳</div>
            <h2>Verifying Payment...</h2>
            <p>Please wait while we confirm your payment with PayU.</p>
            <div className="payu-spinner-large" />
          </>
        ) : result?.status === 'success' ? (
          <>
            <div className="payu-callback-icon success">✅</div>
            <h2>Payment Successful!</h2>
            <p className="payu-callback-msg">{result.message}</p>
            {order && (
              <div className="payu-callback-details">
                <div className="payu-detail-row">
                  <span className="payu-detail-label">Order ID</span>
                  <span className="payu-detail-value">{order.orderId}</span>
                </div>
                <div className="payu-detail-row">
                  <span className="payu-detail-label">Amount</span>
                  <span className="payu-detail-value">{formatCurrency(order.amount)}</span>
                </div>
                <div className="payu-detail-row">
                  <span className="payu-detail-label">Status</span>
                  <span className="payu-detail-value payu-paid">Paid</span>
                </div>
              </div>
            )}
            <button className="payu-btn-primary" onClick={() => navigate('/customer')}>
              Return to Home
            </button>
          </>
        ) : (
          <>
            <div className="payu-callback-icon failed">❌</div>
            <h2>Payment Failed</h2>
            <p className="payu-callback-msg">{result?.message || 'Unknown error occurred.'}</p>
            {result?.status === 'error' && (
              <div className="payu-callback-warning">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>If you believe this is an error, contact support with Order ID: {orderId}</span>
              </div>
            )}
            <div className="payu-callback-actions">
              <button className="payu-btn-primary" onClick={() => navigate('/payu/checkout')}>
                Try Again
              </button>
              <button className="payu-btn-secondary" onClick={() => navigate('/customer')}>
                Return to Home
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Success page — wraps PayUCallback */
export function PayUSuccess() {
  return <PayUCallback />;
}

/** Failure page — wraps PayUCallback */
export function PayUFailure() {
  return <PayUCallback />;
}
