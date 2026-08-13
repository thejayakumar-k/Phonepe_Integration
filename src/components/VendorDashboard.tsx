import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { OrdersPanel } from './OrdersPanel';

export function VendorDashboard() {
  const { session, logout } = useAuth();

  return (
    <div className="admin-panel">
      <header className="admin-header">
        <div className="dashboard-nav">
          <span className="nav-user">
            🛍️ {session?.vendorName || 'Vendor'} ({session?.vendorId})
          </span>
          <span className="nav-actions">
            <Link to="/" className="nav-link">Home</Link>
            <Link to="/pay" className="nav-link">Payment Page</Link>
            <button className="btn-logout" onClick={logout}>Logout</button>
          </span>
        </div>
        <h1>Vendor Dashboard</h1>
        <p>Signed in as {session?.username}</p>
      </header>

      <OrdersPanel vendorId={session?.vendorId} />
    </div>
  );
}
