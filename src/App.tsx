import { useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { PaymentPage } from './components';
import { Home } from './components/Home';
import { Login } from './components/Login';
import { VendorDashboard } from './components/VendorDashboard';
import { CustomerDashboard } from './components/CustomerDashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { demoOrders, getAddFundsOrder, getDemoOrder, sessionMinutes } from './data/demo';
import { seedDemoOrders } from './utils/storage';
import type { MerchantConfig } from './types/payment';
import './App.css';

// Configuration from environment variables
const merchant: MerchantConfig = {
  upiId: import.meta.env.VITE_MERCHANT_UPI_ID || 'merchant@phonepe',
  merchantName: import.meta.env.VITE_MERCHANT_NAME || 'OORUNII Store',
};

function PaymentRoute() {
  const [searchParams] = useSearchParams();
  const { session } = useAuth();

  const order = useMemo(() => {
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
    seedDemoOrders(demoOrders);
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Home */}
          <Route path="/" element={<Home />} />

          {/* Login */}
          <Route path="/login/:role" element={<Login />} />

          {/* Payment Page */}
          <Route path="/pay" element={<PaymentRoute />} />

          {/* Vendor Dashboard */}
          <Route
            path="/vendor"
            element={
              <ProtectedRoute role="vendor">
                <VendorDashboard />
              </ProtectedRoute>
            }
          />

          {/* Customer Dashboard */}
          <Route
            path="/customer"
            element={
              <ProtectedRoute role="customer">
                <CustomerDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
