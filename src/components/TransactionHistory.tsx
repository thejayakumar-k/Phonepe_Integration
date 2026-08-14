import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getOrders } from '../utils/storage';
import type { Order } from '../types/payment';

type FilterType = 'today' | '7days' | 'custom';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Not Paid', cls: 'th-status-pending' },
  CUSTOMER_SUBMITTED: { label: 'Payment Verification', cls: 'th-status-verify' },
  PAID: { label: 'Paid', cls: 'th-status-paid' },
  FAILED: { label: 'Failed', cls: 'th-status-failed' },
  EXPIRED: { label: 'Expired', cls: 'th-status-expired' },
  CANCELLED: { label: 'Cancelled', cls: 'th-status-cancelled' },
  COD_PLACED: { label: 'COD · Not Paid', cls: 'th-status-cod' },
};

function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function formatInputDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${date.getFullYear()}`;
}

function parseInputDate(value: string): Date | null {
  const parts = value.split('-').map((p) => Number(p.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return new Date(parts[2], parts[1] - 1, parts[0]);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function TransactionHistory() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [activeFilter, setActiveFilter] = useState<FilterType>('today');
  const [fromDate, setFromDate] = useState(formatInputDate(new Date()));
  const [toDate, setToDate] = useState(formatInputDate(new Date()));
  const [appliedFrom, setAppliedFrom] = useState(formatInputDate(new Date()));
  const [appliedTo, setAppliedTo] = useState(formatInputDate(new Date()));

  const [transactions, setTransactions] = useState<Order[]>([]);

  useEffect(() => {
    const fetchTransactions = () => {
      const all = Object.values(getOrders());
      setTransactions(
        all
          .filter((o) => o.customerId === session?.customerId)
          .sort((a, b) => b.createdAt - a.createdAt)
      );
    };

    fetchTransactions();
    const interval = setInterval(fetchTransactions, 5000);
    return () => clearInterval(interval);
  }, [session?.customerId]);

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    const today = new Date();
    if (filter === 'today') {
      const value = formatInputDate(today);
      setFromDate(value);
      setToDate(value);
      setAppliedFrom(value);
      setAppliedTo(value);
    } else if (filter === '7days') {
      const sevenDaysAgo = new Date(today.getTime() - 6 * DAY_MS);
      const from = formatInputDate(sevenDaysAgo);
      const to = formatInputDate(today);
      setFromDate(from);
      setToDate(to);
      setAppliedFrom(from);
      setAppliedTo(to);
    }
  };

  const handleFetch = () => {
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
  };

  const filtered = useMemo(() => {
    if (activeFilter === 'today') {
      const todayStart = startOfDay(new Date());
      return transactions.filter((o) => o.createdAt >= todayStart);
    }
    if (activeFilter === '7days') {
      const from = startOfDay(new Date()) - 6 * DAY_MS;
      return transactions.filter((o) => o.createdAt >= from);
    }
    const from = parseInputDate(appliedFrom);
    const to = parseInputDate(appliedTo);
    if (!from || !to) return [];
    return transactions.filter(
      (o) => o.createdAt >= startOfDay(from) && o.createdAt <= endOfDay(to)
    );
  }, [transactions, activeFilter, appliedFrom, appliedTo]);

  const totalSpent = filtered
    .filter((o) => o.paymentStatus === 'PAID')
    .reduce((sum, o) => sum + o.amount, 0);
  const paidCount = filtered.filter((o) => o.paymentStatus === 'PAID').length;

  return (
    <div className="transaction-history-page">
      <div className="transaction-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ←
        </button>
        <h1>Transaction History</h1>
      </div>

      <div className="transaction-content">
        <div className="filters-card">
          <h2>Filters</h2>
          <div className="filter-buttons">
            <button
              className={`filter-btn ${activeFilter === 'today' ? 'active' : ''}`}
              onClick={() => handleFilterChange('today')}
            >
              Today
            </button>
            <button
              className={`filter-btn ${activeFilter === '7days' ? 'active' : ''}`}
              onClick={() => handleFilterChange('7days')}
            >
              Last 7 Days
            </button>
            <button
              className={`filter-btn ${activeFilter === 'custom' ? 'active' : ''}`}
              onClick={() => setActiveFilter('custom')}
            >
              Choose Dates
            </button>
          </div>

          {activeFilter === 'custom' && (
            <div className="date-pickers">
              <div className="date-group">
                <label>From (DD-MM-YYYY)</label>
                <input
                  type="text"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  placeholder="DD-MM-YYYY"
                />
              </div>
              <div className="date-group">
                <label>To (DD-MM-YYYY)</label>
                <input
                  type="text"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  placeholder="DD-MM-YYYY"
                />
              </div>
            </div>
          )}

          <button className="fetch-btn" onClick={handleFetch}>
            Fetch
          </button>
        </div>

        <div className="th-summary">
          <span className="th-summary-label">Total Spent</span>
          <span className="th-summary-value">₹{totalSpent.toFixed(2)}</span>
          <span className="th-summary-sub">
            {filtered.length} transaction(s) · {paidCount} paid
          </span>
        </div>

        <div className="results-card">
          <h2>Results</h2>
          {filtered.length === 0 ? (
            <p className="placeholder-text">No transactions found for the selected period.</p>
          ) : (
            <div className="th-list">
              {filtered.map((order) => {
                const meta = STATUS_META[order.paymentStatus] || {
                  label: order.paymentStatus,
                  cls: 'th-status-pending',
                };
                const isPaid = order.paymentStatus === 'PAID';
                return (
                  <div key={order.orderId} className="th-item">
                    <span className={`th-item-icon ${isPaid ? 'paid' : ''}`}>
                      {isPaid ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                      )}
                    </span>
                    <div className="th-item-info">
                      <span className="th-item-title">{order.description}</span>
                      <span className={`th-status ${meta.cls}`}>{meta.label}</span>
                      <span className="th-item-date">
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <span className="th-item-amount">₹{order.amount.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
