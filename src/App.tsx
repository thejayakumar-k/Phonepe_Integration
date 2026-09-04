import { useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { PaymentPage, TransactionHistory } from './components';
import { Home } from './components/Home';
import { Login } from './components/Login';
import { VendorLayout } from './components/VendorLayout';
import { VendorHome } from './components/VendorHome';
import { VendorOrders } from './components/VendorOrders';
import { VendorPayments } from './components/VendorPayments';
import { VendorSettings } from './components/VendorSettings';
import { VendorRefunds } from './components/VendorRefunds';
import { CustomerLayout } from './components/CustomerLayout';
import { CustomerHome } from './components/CustomerHome';
import { CustomerCart } from './components/CustomerCart';
import { CustomerAddMoney } from './components/CustomerAddMoney';
import { PaymentVerification } from './components/PaymentVerification';
import { PayUCheckout } from './components/PayUCheckout';
import { PayUCallback } from './components/PayUCallback';
import { CustomerOrders } from './components/CustomerOrders';
import { CustomerSettings } from './components/CustomerSettings';
import { ManageUpi } from './components/ManageUpi';
import { CustomerBankMapping } from './components/CustomerBankMapping';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { getAddFundsOrder, getDemoOrder, sessionMinutes } from './data/demo';
import { clearDemoOrders, clearDemoItemOrders, getActiveUpiId, linkItemOrderToPayment } from './utils/storage';
import type { MerchantConfig } from './types/payment';
import './App.css';

function PaymentRoute() {
  const [searchParams] = useSearchParams();
  const { session } = useAuth();

  const merchant = useMemo<MerchantConfig>(
    () => ({
      upiId: getActiveUpiId(),
      merchantName: import.meta.env.VITE_MERCHANT_NAME || 'OORUNII Store',
    }),
    []
  );

  const order = useMemo(() => {
    const mode = searchParams.get('mode');
    if (mode === 'addfunds') {
      const amountParam = searchParams.get('amount');
      const parsedAmount = parseFloat(amountParam || '');
      const amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
      const order = getAddFundsOrder(
        {
          id: session?.customerId ?? 'CUST001',
          name: session?.customerName ?? 'Customer',
        },
        amount
      );
      const itemOrderId = searchParams.get('io');
      if (itemOrderId) {
        linkItemOrderToPayment(itemOrderId, order.orderId);
      }
      return order;
    }
    const amountParam = searchParams.get('amount');
    if (amountParam) {
      const amount = parseFloat(amountParam);
      if (Number.isFinite(amount) && amount > 0) {
        return getAddFundsOrder(
          {
            id: session?.customerId ?? 'CUST001',
            name: session?.customerName ?? 'Customer',
          },
          amount
        );
      }
    }
    return getDemoOrder(searchParams.get('orderId') || undefined);
  }, [searchParams, session]);

  return (
    <PaymentPage
      order={order}
      merchant={merchant}
      sessionMinutes={sessionMinutes}
    />
  );
}

function App() {
  useEffect(() => {
    clearDemoOrders();
    clearDemoItemOrders();
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Home */}
          <Route path="/" element={<Home />} />

          {/* Login */}
          <Route path="/login/:role" element={<Login />} />

          {/* Payment Page (PhonePe direct UPI) */}
          <Route path="/pay" element={<PaymentRoute />} />

          {/* Payment Verification (full screen) */}
          <Route
            path="/payment-verification"
            element={
              <ProtectedRoute role="customer">
                <PaymentVerification />
              </ProtectedRoute>
            }
          />

          {/* PayU Payment Gateway */}
          <Route
            path="/payu/checkout"
            element={
              <ProtectedRoute role="customer">
                <PayUCheckout />
              </ProtectedRoute>
            }
          />
          <Route path="/payu/success" element={<PayUCallback />} />
          <Route path="/payu/failure" element={<PayUCallback />} />

          {/* Vendor Routes with Layout */}
          <Route
            path="/vendor"
            element={
              <ProtectedRoute role="vendor">
                <VendorLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<VendorHome />} />
            <Route path="orders" element={<VendorOrders />} />
            <Route path="payments" element={<VendorPayments />} />
            <Route path="settings" element={<VendorSettings />} />
            <Route
              path="refunds"
              element={
                <ProtectedRoute role="vendor">
                  <VendorRefunds />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Customer Routes with Layout */}
          <Route
            path="/customer"
            element={
              <ProtectedRoute role="customer">
                <CustomerLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<CustomerHome />} />
            <Route path="cart" element={<CustomerCart />} />
            <Route path="add-money" element={<CustomerAddMoney />} />
            <Route path="orders" element={<CustomerOrders />} />
            <Route path="history" element={<TransactionHistory />} />
            <Route path="settings" element={<CustomerSettings />} />
            <Route path="manage-upi" element={<ManageUpi />} />
            <Route path="bank-mapping" element={<CustomerBankMapping />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
