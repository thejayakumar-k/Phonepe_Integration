import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getMargin, subtractMargin, saveItemOrder } from '../utils/storage';
import type { ItemOrder, ItemOrderStatus, PaymentMethod } from '../types/payment';

const products = [
  { id: 1, name: 'Aquafina', price: 20.00, unit: 'PACK (LITER)', image: '💧' },
  { id: 2, name: 'Bisleri', price: 40.00, unit: 'CAN (LITER)', image: '🧊' },
  { id: 3, name: 'Kinley', price: 25.00, unit: 'PACK (LITER)', image: '💧' },
];

type CartPaymentMethod = 'upi' | 'qr' | 'wallet' | 'cod';

export function CustomerCart() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [cart, setCart] = useState<{id: number; qty: number}[]>(() => {
    const saved = localStorage.getItem('customer_cart');
    return saved ? (JSON.parse(saved) as {id: number; qty: number}[]) : [];
  });
  const [selectedPayment, setSelectedPayment] = useState<CartPaymentMethod>('upi');
  const [paymentSuccess, setPaymentSuccess] = useState<{ amount: number; balance: number } | null>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getProduct = (id: number) => products.find((p) => p.id === id);

  const totalAmount = cart.reduce((sum, item) => {
    const product = getProduct(item.id);
    return sum + (product ? product.price * item.qty : 0);
  }, 0);

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getMargin(session?.customerId).then((value) => {
      if (!cancelled) setWalletBalance(value);
    });
    return () => {
      cancelled = true;
    };
  }, [session?.customerId, totalAmount]);

  const buildItemOrder = (status: ItemOrderStatus, method?: PaymentMethod): ItemOrder => ({
    id: `IO${Date.now()}`,
    customerId: session?.customerId || 'CUST001',
    customerName: session?.customerName,
    vendorId: 'VENDOR001',
    vendorName: 'OORUNII Store',
    items: cart
      .map((item) => {
        const product = getProduct(item.id);
        return product
          ? { name: product.name, qty: item.qty, price: product.price, unit: product.unit, image: product.image }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
    total: totalAmount,
    status,
    paymentMethod: method,
    createdAt: Date.now(),
  });

  useEffect(() => {
    // Listen for checkout trigger from navbar
    const handleCheckout = async () => {
      if (selectedPayment === 'wallet') {
        if (walletBalance < totalAmount) {
          alert('Insufficient wallet balance!');
          return;
        }
        const newBalance = session?.customerId
          ? await subtractMargin(session.customerId, totalAmount)
          : walletBalance;
        await saveItemOrder(buildItemOrder('PAID'));
        localStorage.removeItem('customer_cart');
        setWalletBalance(newBalance);
        setPaymentSuccess({ amount: totalAmount, balance: newBalance });
        if (redirectTimer.current) clearTimeout(redirectTimer.current);
        redirectTimer.current = setTimeout(() => {
          navigate('/customer/orders');
        }, 1800);
      } else if (selectedPayment === 'qr') {
        if (session?.customerId) {
          await subtractMargin(session.customerId, totalAmount);
        }
        const itemOrder = buildItemOrder('PENDING', 'PHONEPE');
        await saveItemOrder(itemOrder);
        navigate(`/pay?mode=addfunds&amount=${totalAmount}&io=${itemOrder.id}`);
      } else {
        if (session?.customerId) {
          await subtractMargin(session.customerId, totalAmount);
        }
        await saveItemOrder(buildItemOrder('NOT_PAID', 'COD'));
        alert('Order placed with Cash on Delivery!');
        localStorage.removeItem('customer_cart');
        navigate('/customer/orders');
      }
    };

    window.addEventListener('triggerCheckout', handleCheckout);
    return () => window.removeEventListener('triggerCheckout', handleCheckout);
  }, [selectedPayment, walletBalance, totalAmount, cart, navigate, session?.customerId, session?.customerName]);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  const handleAdd = (productId: number) => {
    setCart((prev) => {
      const exists = prev.find((item) => item.id === productId);
      const newCart = exists
        ? prev.map((item) => item.id === productId ? { ...item, qty: item.qty + 1 } : item)
        : [...prev, { id: productId, qty: 1 }];
      localStorage.setItem('customer_cart', JSON.stringify(newCart));
      return newCart;
    });
  };

  const handleRemove = (productId: number) => {
    setCart((prev) => {
      const exists = prev.find((item) => item.id === productId);
      if (exists && exists.qty > 1) {
        const newCart = prev.map((item) => item.id === productId ? { ...item, qty: item.qty - 1 } : item);
        localStorage.setItem('customer_cart', JSON.stringify(newCart));
        return newCart;
      }
      const newCart = prev.filter((item) => item.id !== productId);
      localStorage.setItem('customer_cart', JSON.stringify(newCart));
      return newCart;
    });  };

  if (cart.length === 0) {
    return (
      <div className="customer-cart">
      <div className="cart-header">
        <div className="cart-header-left">
          <button className="back-btn" onClick={() => navigate('/customer')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <h1>My Cart</h1>
        </div>
      </div>
        <div className="empty-cart">
          <span className="empty-icon">🛒</span>
          <p>Your cart is empty</p>
          <button className="btn-browse" onClick={() => navigate('/customer')}>
            Browse Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-cart">
      <div className="cart-header">
        <div className="cart-header-left">
          <button className="back-btn" onClick={() => navigate('/customer')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <h1>My Cart</h1>
        </div>
        <span className="cart-badge">{totalItems} item{totalItems > 1 ? 's' : ''}</span>
      </div>

      <div className="cart-items">
        {cart.map((item) => {
          const product = getProduct(item.id);
          if (!product) return null;
          return (
            <div key={item.id} className="cart-item">
              <div className="cart-item-image">{product.image}</div>
              <div className="cart-item-info">
                <h3 className="cart-item-name">{product.name}</h3>
                <p className="cart-item-unit">{product.unit}</p>
                <p className="cart-item-price">₹{product.price.toFixed(2)}</p>
              </div>
              <div className="cart-item-actions">
                <div className="quantity-selector">
                  <button className="qty-btn minus" onClick={() => handleRemove(item.id)}>-</button>
                  <span className="qty-value">{item.qty}</span>
                  <button className="qty-btn plus" onClick={() => handleAdd(item.id)}>+</button>
                </div>
                <p className="cart-item-total">₹{(product.price * item.qty).toFixed(2)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="cart-summary">
        <div className="summary-row">
          <span>Items ({totalItems})</span>
          <span>₹{totalAmount.toFixed(2)}</span>
        </div>
        <div className="summary-row total">
          <span>Total</span>
          <span>₹{totalAmount.toFixed(2)}</span>
        </div>
        <div className="payment-methods">
          <h3 className="payment-title">Select Payment Method</h3>
          
          <button 
            className="payment-option disabled"
            disabled
          >
            <span className="payment-icon">📱</span>
            <div className="payment-details">
              <span className="payment-name">Pay by PhonePe</span>
              <span className="payment-desc">Coming soon</span>
            </div>
            <span className="coming-soon-badge">Coming Soon</span>
          </button>

          <button 
            className={`payment-option ${selectedPayment === 'qr' ? 'active' : ''}`}
            onClick={() => {
              setSelectedPayment('qr');
              window.dispatchEvent(new CustomEvent('paymentMethodChanged', { detail: 'qr' }));
            }}
          >
            <span className="payment-icon">📷</span>
            <div className="payment-details">
              <span className="payment-name">Pay via QR Code</span>
              <span className="payment-desc">Scan & pay with PhonePe</span>
            </div>
            <span className="payment-check">{selectedPayment === 'qr' && '✓'}</span>
          </button>

          <button 
            className={`payment-option ${selectedPayment === 'wallet' ? 'active' : ''} ${walletBalance < totalAmount ? 'insufficient' : ''}`}
            onClick={() => {
              setSelectedPayment('wallet');
              window.dispatchEvent(new CustomEvent('paymentMethodChanged', { detail: 'wallet' }));
            }}
          >
            <span className="payment-icon">💰</span>
            <div className="payment-details">
              <span className="payment-name">OORUNII Wallet</span>
              <span className="payment-desc">
                Balance: ₹{walletBalance.toFixed(2)}
                {walletBalance < totalAmount && <span className="insufficient-text"> - Insufficient balance</span>}
              </span>
            </div>
            <span className="payment-check">{selectedPayment === 'wallet' && '✓'}</span>
          </button>

          <button 
            className={`payment-option ${selectedPayment === 'cod' ? 'active' : ''}`}
            onClick={() => {
              setSelectedPayment('cod');
              window.dispatchEvent(new CustomEvent('paymentMethodChanged', { detail: 'cod' }));
            }}
          >
            <span className="payment-icon">💵</span>
            <div className="payment-details">
              <span className="payment-name">Cash on Delivery</span>
              <span className="payment-desc">Pay when you receive</span>
            </div>
            <span className="payment-check">{selectedPayment === 'cod' && '✓'}</span>
          </button>
        </div>


      </div>

      {paymentSuccess && (
        <div className="pay-success-overlay">
          <div className="pay-success-card">
            <div className="pay-success-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h2 className="pay-success-title">Payment Successful</h2>
            <p className="pay-success-message">
              ₹{paymentSuccess.amount.toFixed(2)} deducted from OORUNII Wallet
            </p>
            <div className="pay-success-balance">
              <span className="psb-label">New Balance</span>
              <span className="psb-value">₹{paymentSuccess.balance.toFixed(2)}</span>
            </div>
            <p className="pay-success-hint">Redirecting to your orders...</p>
          </div>
        </div>
      )}
    </div>
  );
}
