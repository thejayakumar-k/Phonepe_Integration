import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

export function CustomerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [cartCount, setCartCount] = useState(0);
  const [selectedPayment, setSelectedPayment] = useState<string>('');

  useEffect(() => {
    const updateCartCount = () => {
      const saved = localStorage.getItem('customer_cart');
      const cart = saved ? JSON.parse(saved) : [];
      const total = cart.reduce((sum: number, item: {qty: number}) => sum + item.qty, 0);
      setCartCount(total);
    };

    updateCartCount();
    window.addEventListener('storage', updateCartCount);
    const interval = setInterval(updateCartCount, 500);

    const handlePaymentChange = (e: CustomEvent) => {
      setSelectedPayment(e.detail);
    };
    window.addEventListener('paymentMethodChanged', handlePaymentChange as EventListener);

    return () => {
      window.removeEventListener('storage', updateCartCount);
      window.removeEventListener('paymentMethodChanged', handlePaymentChange as EventListener);
      clearInterval(interval);
    };
  }, []);

  const isOnCart = location.pathname === '/customer/cart';
  const cartEmpty = cartCount === 0;

  const navItems = [
    {
      path: '/customer',
      label: 'Home',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
    },
    {
      path: '/customer/cart',
      label: 'Cart',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1"/>
          <circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
      ),
    },
    {
      path: '/customer/orders',
      label: 'Orders',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      ),
    },
    {
      path: '/customer/history',
      label: 'History',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      ),
    },
    {
      path: '/customer/settings',
      label: 'Settings',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      ),
    },
  ];

  const isActive = (path: string) => {
    if (path === '/customer') {
      return location.pathname === '/customer';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="customer-layout">
      <main className="customer-main">
        <Outlet key={location.key} />
      </main>
      
      <nav className="bottom-nav">
        {isOnCart && !cartEmpty && selectedPayment === 'cod' ? (
          <button className="nav-cod-btn" onClick={() => {
            const event = new CustomEvent('triggerCheckout');
            window.dispatchEvent(event);
          }}>
            <span className="nav-pay-icon">💵</span>
            <span className="nav-pay-text">Place Order</span>
          </button>
        ) : isOnCart && !cartEmpty && selectedPayment && selectedPayment !== 'cod' ? (
          <button className="nav-pay-btn" onClick={() => {
            const event = new CustomEvent('triggerCheckout');
            window.dispatchEvent(event);
          }}>
            <span className="nav-pay-icon">💳</span>
            <span className="nav-pay-text">Click to Pay</span>
          </button>
        ) : (
          navItems.map((item) => (
            <button
              key={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))
        )}
      </nav>
    </div>
  );
}
