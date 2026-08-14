import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getMargin } from '../utils/storage';
import { DateTimeDisplay } from './DateTimeDisplay';

const APP_VERSION = 'v1.0.14';

export function CustomerDashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [margin, setMargin] = useState(() => getMargin(session?.customerId));
  const [fundAmount, setFundAmount] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setMargin(getMargin(session?.customerId));
      setRefreshing(false);
    }, 500);
  };

  const handleAddFunds = () => {
    const amount = parseFloat(fundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Please enter a valid amount to add funds.');
      return;
    }
    navigate(`/pay?amount=${amount}`);
  };

  const handleWithdraw = () => {
    // TODO: Implement withdraw functionality
    alert('Withdraw feature coming soon!');
  };

  return (
    <div className="customer-dashboard">
      {/* Version Tag */}
      <div className="version-tag">
        Version {APP_VERSION}
        <DateTimeDisplay />
      </div>

      {/* Welcome Section */}
      <h1 className="welcome-text">
        Welcome, {session?.customerName || 'Customer'}
      </h1>

      {/* Available Margin Card */}
      <div className="margin-card">
        <div className="margin-header">
          <span className="margin-label">Available Margin</span>
          <button
            className={`refresh-btn ${refreshing ? 'spinning' : ''}`}
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh balance"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
            </svg>
          </button>
        </div>
        <div className="margin-amount">₹{margin.toFixed(2)}</div>
      </div>

      {/* Add Funds Input */}
      <div className="fund-input-row">
        <input
          className="fund-input"
          type="number"
          min="1"
          step="1"
          placeholder="Enter amount to add"
          value={fundAmount}
          onChange={(e) => setFundAmount(e.target.value)}
          aria-label="Amount to add funds"
        />
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button className="btn-action btn-add-funds" onClick={handleAddFunds}>
          <span className="btn-icon-circle">+</span>
          Add Funds
        </button>
        <button className="btn-action btn-withdraw" onClick={handleWithdraw}>
          <span className="btn-icon-circle">↓</span>
          Withdraw
        </button>
      </div>
    </div>
  );
}
