import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { PaymentPage } from './components';
import { Home } from './components/Home';
import { Login } from './components/Login';
import { VendorDashboard } from './components/VendorDashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './auth/AuthContext';
import { demoOrders, getDemoOrder, sessionMinutes } from './data/demo';
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
  const order = getDemoOrder(searchParams.get('orderId') || undefined);

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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
