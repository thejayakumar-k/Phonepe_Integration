import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const products = [
  {
    id: 1,
    name: 'Aquafina',
    rating: 4.8,
    price: 20.00,
    unit: 'PACK (LITER)',
    image: '💧',
  },
  {
    id: 2,
    name: 'Bisleri',
    rating: 4.0,
    price: 40.00,
    unit: 'CAN (LITER)',
    image: '🧊',
  },
  {
    id: 3,
    name: 'Kinley',
    rating: 4.5,
    price: 25.00,
    unit: 'PACK (LITER)',
    image: '💧',
  },
];

export function CustomerHome() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState<{id: number; qty: number}[]>(() => {
    const saved = localStorage.getItem('customer_cart');
    return saved ? JSON.parse(saved) : [];
  });

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
    });
  };

  const getCartQty = (productId: number) => {
    return cart.find((item) => item.id === productId)?.qty || 0;
  };

  const totalCartItems = cart.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="customer-home">
      {/* Vendor Header */}
      <div className="vendor-header">
        <div className="vendor-top">
          <div className="vendor-info">
            <div className="vendor-avatar">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div className="vendor-details">
              <h2 className="vendor-name">{session?.customerName || 'Demo Vendor'}</h2>
            </div>
          </div>
          <button className="vendor-contact-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </button>
        </div>

      </div>

      {/* Banner */}
      <div className="home-banner">
        <div className="banner-content">
          <span className="banner-tag">FRESH & PURE</span>
          <h3 className="banner-title">HYDRATION STATION</h3>
          <p className="banner-subtitle">STAY HEALTHY, STAY HYDRATED</p>
        </div>
      </div>

      {/* Products */}
      <div className="products-list">
        {products.map((product) => (
          <div key={product.id} className="product-card">
            <div className="product-info">
              <h3 className="product-name">{product.name}</h3>
              <div className="product-rating">
                <span className="star">⭐</span>
                <span>{product.rating}</span>
              </div>
              <p className="product-price">₹ {product.price.toFixed(2)}</p>
              <p className="product-unit">{product.unit}</p>
              {getCartQty(product.id) > 0 ? (
                <div className="quantity-selector">
                  <button className="qty-btn minus" onClick={() => handleRemove(product.id)}>-</button>
                  <span className="qty-value">{getCartQty(product.id)}</span>
                  <button className="qty-btn plus" onClick={() => handleAdd(product.id)}>+</button>
                </div>
              ) : (
                <button className="btn-add-product" onClick={() => handleAdd(product.id)}>Add</button>
              )}
            </div>
            <div className="product-image">
              <span className="product-emoji">{product.image}</span>
            </div>
          </div>
        ))}
      </div>

      {/* View Cart Button */}
      {totalCartItems > 0 && (
        <div className="view-cart-bar">
          <div className="cart-info">
            <span className="cart-icon">🛒</span>
            <span className="cart-count">{totalCartItems} item{totalCartItems > 1 ? 's' : ''}</span>
          </div>
          <button className="btn-view-cart" onClick={() => navigate('/customer/cart')}>
            View Cart
          </button>
        </div>
      )}
    </div>
  );
}
