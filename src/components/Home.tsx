import { Link } from 'react-router-dom';

export function Home() {
  return (
    <div className="home-page">
      <header className="home-header">
        <h1 className="brand-title">OORUNII</h1>
        <p className="brand-subtitle">PhonePe Payment Platform</p>
      </header>

      <main className="home-content">
        <p className="home-welcome">
          Welcome! Choose how you want to sign in.
        </p>

        <div className="role-cards">
          <Link to="/login/vendor" className="role-card vendor-card">
            <span className="role-icon">🛍️</span>
            <span className="role-title">Vendor Login</span>
            <span className="role-desc">
              Manage your orders and verify payments
            </span>
          </Link>

          <Link to="/login/customer" className="role-card customer-card">
            <span className="role-icon">🛒</span>
            <span className="role-title">Customer Login</span>
            <span className="role-desc">
              View your orders and make payments
            </span>
          </Link>
        </div>

      </main>

      <footer className="payment-footer">
        <p className="footer-text">Need help? Contact us at support@oorunii.com</p>
      </footer>
    </div>
  );
}
