import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getMargin, subtractMargin, saveItemOrder, generateItemOrderId } from '../utils/storage';
import type { ItemOrder, ItemOrderStatus, PaymentMethod } from '../types/payment';
import type { CustomerAddress } from '../types/customer';
import { getStoreInfo, type StoreInfo } from '../utils/store';
import { useProducts } from '../hooks/useProducts';
import {
  getPricingConfig,
  subscribeToPricingConfig,
  calculateUnitPrice,
  DEFAULT_PRICING,
  type PricingConfig,
} from '../utils/pricing';

const ChooseAddress = lazy(() => import('./ChooseAddress').then(m => ({ default: m.ChooseAddress })));

type CartPaymentMethod = 'upi' | 'qr' | 'wallet' | 'cod';

export function CustomerCart() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { products } = useProducts();
  const [store, setStore] = useState<StoreInfo>({ vendorId: 'VENDOR001', vendorName: 'OORUNII Store' });
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(DEFAULT_PRICING);

  useEffect(() => {
    let cancelled = false;
    getPricingConfig().then((config) => {
      if (!cancelled) setPricingConfig(config);
    });
    const unsubscribe = subscribeToPricingConfig((config) => {
      if (!cancelled) setPricingConfig(config);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Store identity from the store_settings table (fallback to defaults).
  useEffect(() => {
    let cancelled = false;
    getStoreInfo().then((info) => {
      if (!cancelled) setStore(info);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const [cart, setCart] = useState<{id: number; qty: number}[]>(() => {
    const saved = localStorage.getItem('customer_cart');
    return saved ? (JSON.parse(saved) as {id: number; qty: number}[]) : [];
  });
  const [selectedPayment, setSelectedPayment] = useState<CartPaymentMethod>('cod');
  const [paymentSuccess, setPaymentSuccess] = useState<{ amount: number; balance: number } | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<{
    addr: CustomerAddress;
    onDone: () => void;
  } | null>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);

  const getProduct = (id: number | string) => products.find((p) => String(p.id) === String(id));

  const getItemPriceInfo = (basePrice: number) => {
    return calculateUnitPrice(basePrice, selectedAddress?.addr, pricingConfig);
  };

  const totalAmount = cart.reduce((sum, item) => {
    const product = getProduct(item.id);
    if (!product) return sum;
    const { unitPrice } = getItemPriceInfo(product.price);
    return sum + unitPrice * item.qty;
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

  const buildItemOrder = (id: string, status: ItemOrderStatus, method?: PaymentMethod): ItemOrder => ({
    id,
    customerId: session?.customerId || 'CUST001',
    customerName: session?.customerName,
    vendorId: store.vendorId,
    vendorName: store.vendorName,
    items: cart
      .map((item) => {
        const product = getProduct(item.id);
        if (!product) return null;
        const { unitPrice } = getItemPriceInfo(product.price);
        return { name: product.name, qty: item.qty, price: unitPrice, unit: product.unit, image: product.image };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
    total: totalAmount,
    status,
    paymentMethod: method,
    createdAt: Date.now(),
    deliveryAddress: selectedAddress?.addr.lat && selectedAddress?.addr.lng
      ? { address: selectedAddress.addr.address, lat: selectedAddress.addr.lat, lng: selectedAddress.addr.lng }
      : undefined,
  });

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    if (selectedPayment === 'wallet') {
      if (walletBalance < totalAmount) {
        alert('Insufficient wallet balance! Please add funds or choose another payment method.');
        return;
      }
      const newBalance = session?.customerId
        ? await subtractMargin(session.customerId, totalAmount)
        : walletBalance;
      await saveItemOrder(buildItemOrder(await generateItemOrderId(), 'PAID'));
      localStorage.removeItem('customer_cart');
      setCart([]);
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
      const itemOrder = buildItemOrder(await generateItemOrderId(), 'PENDING', 'PHONEPE');
      await saveItemOrder(itemOrder);
      // encodeURIComponent: order ids now start with "#", which would
      // otherwise be read as a URL fragment and lost.
      navigate(`/pay?mode=addfunds&amount=${totalAmount}&io=${encodeURIComponent(itemOrder.id)}`);
    } else {
      // COD — default
      if (session?.customerId) {
        await subtractMargin(session.customerId, totalAmount);
      }
      await saveItemOrder(buildItemOrder(await generateItemOrderId(), 'NOT_PAID', 'COD'));
      localStorage.removeItem('customer_cart');
      setCart([]);
      navigate('/customer/orders');
    }
  };

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
          const { unitPrice, floorCharge } = getItemPriceInfo(product.price);
          return (
            <div key={item.id} className="cart-item">
              <div className="cart-item-image">{product.image}</div>
              <div className="cart-item-info">
                <h3 className="cart-item-name">{product.name}</h3>
                <p className="cart-item-unit">{product.unit}</p>
                <p className="cart-item-price">
                  ₹{unitPrice.toFixed(2)}
                  {floorCharge > 0 && (
                    <span style={{ fontSize: '11px', color: '#6b7280', display: 'block', fontWeight: 400 }}>
                      (Base ₹{product.price.toFixed(2)} + ₹{floorCharge.toFixed(2)} floor)
                    </span>
                  )}
                </p>
              </div>
              <div className="cart-item-actions">
                <div className="quantity-selector">
                  <button className="qty-btn minus" onClick={() => handleRemove(item.id)}>-</button>
                  <span className="qty-value">{item.qty}</span>
                  <button className="qty-btn plus" onClick={() => handleAdd(item.id)}>+</button>
                </div>
                <p className="cart-item-total">₹{(unitPrice * item.qty).toFixed(2)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="cart-summary">
        {/* Delivery address (modal trigger) */}
        {!selectedAddress ? (
          <button type="button" className="cart-address-picker" onClick={() => setShowAddressModal(true)}>
            <span className="cart-address-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </span>
            <div className="cart-address-text">
              <span className="cart-address-label">Delivery to</span>
              <span className="cart-address-badge">Apt</span>
              <span className="cart-address-placeholder">Tap to choose address</span>
            </div>
            <svg className="cart-address-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        ) : (
          <div className="cart-address-confirmed">
            <span className="cart-address-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </span>
            <div className="cart-address-text">
              <span className="cart-address-label">Delivering to</span>
              <span className="cart-address-address">{selectedAddress.addr.address}</span>
            </div>
            <button type="button" className="cart-address-edit" onClick={() => setShowAddressModal(true)}>
              Change
            </button>
          </div>
        )}

        {/* Bill summary */}
        <div className="bill-summary">
          <div className="bill-row">
            <span className="bill-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </span>
            <span className="bill-label">Subtotal</span>
            <span className="bill-value">₹{totalAmount.toFixed(2)}</span>
          </div>
          <div className="bill-row">
            <span className="bill-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13"/>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                <circle cx="5.5" cy="18.5" r="2.5"/>
                <circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
            </span>
            <span className="bill-label">Delivery Charges</span>
            <span className="bill-value">₹0</span>
          </div>
          <div className="bill-row">
            <span className="bill-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                <line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
            </span>
            <span className="bill-label">Discount</span>
            <span className="bill-value bill-value-discount">-₹0</span>
          </div>
          <div className="bill-row bill-row-total">
            <span className="bill-label">Total Amount</span>
            <span className="bill-value bill-value-bold">₹{totalAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment methods */}
        <div className="cart-payment">
          <h3 className="cart-payment-title">Select Payment Method</h3>
          
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

          {/* Inline Place Order Section directly after Cash on Delivery */}
          <div className="cart-inline-checkout">
            <div className="cart-inline-total-row">
              <span className="cart-inline-total-label">TOTAL</span>
              <span className="cart-inline-total-amount">₹{totalAmount.toFixed(2)}</span>
            </div>
            <button
              type="button"
              className="cart-inline-place-order-btn"
              onClick={handlePlaceOrder}
            >
              Place Order
            </button>
          </div>
        </div>
      </div>

      {/* Address picker modal */}
      {showAddressModal && (
        <Suspense fallback={<div className="ca-modal-loading">Loading...</div>}>
          <ChooseAddress
            onAddressConfirm={(addr, onDone) => {
              setSelectedAddress({ addr, onDone });
              setShowAddressModal(false);
            }}
            onDone={() => setShowAddressModal(false)}
          />
        </Suspense>
      )}

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
