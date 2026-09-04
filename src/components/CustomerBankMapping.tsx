import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  getBankAccounts,
  saveBankAccount,
  removeBankAccount,
  setPreferredBankAccount,
  validateBankAccount,
} from '../utils/storage';
import type { BankAccount } from '../types/payment';

const POPULAR_BANKS = [
  'HDFC Bank',
  'SBI (State Bank of India)',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Punjab National Bank (PNB)',
  'Bank of Baroda',
  'Canara Bank',
  'Union Bank of India',
  'Indian Bank',
  'IDBI Bank',
  'Central Bank of India',
  'Indian Overseas Bank',
  'UCO Bank',
  'Bandhan Bank',
  'Federal Bank',
  'South Indian Bank',
  'Yes Bank',
  'IndusInd Bank',
  'Karnataka Bank',
  'Karur Vysya Bank',
  'City Union Bank',
  'Dhanlaxmi Bank',
  'Tamilnad Mercantile Bank',
  'USCNB',
  'Other',
];

export function CustomerBankMapping() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const customerId = session?.customerId || 'CUST001';

  const [accounts, setAccounts] = useState<BankAccount[]>(() =>
    getBankAccounts(customerId)
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form state
  const [bankName, setBankName] = useState('');
  const [customBankName, setCustomBankName] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [showAccountNumbers, setShowAccountNumbers] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refreshAccounts = () => {
    setAccounts(getBankAccounts(customerId));
  };

  const resetForm = () => {
    setBankName('');
    setCustomBankName('');
    setAccountHolderName('');
    setAccountNumber('');
    setConfirmAccountNumber('');
    setIfscCode('');
    setFormError('');
  };

  const handleAddAccount = () => {
    const finalBankName = bankName === 'Other' ? customBankName.trim() : bankName;

    const error = validateBankAccount({
      bankName: finalBankName,
      accountHolderName,
      accountNumber,
      confirmAccountNumber,
      ifscCode,
    });

    if (error) {
      setFormError(error);
      return;
    }

    const newAccount = saveBankAccount({
      customerId,
      bankName: finalBankName,
      accountHolderName: accountHolderName.trim(),
      accountNumber: accountNumber.trim(),
      ifscCode: ifscCode.toUpperCase().trim(),
      isPreferred: accounts.length === 0, // First account is auto-preferred
    });

    refreshAccounts();
    resetForm();
    setShowAddForm(false);
    setSuccessMsg(
      `Bank account (${newAccount.maskedAccountNumber}) added successfully.`
    );
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleDelete = (accountId: string) => {
    removeBankAccount(customerId, accountId);
    refreshAccounts();
    setConfirmDelete(null);
    setSuccessMsg('Bank account removed.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleSetPreferred = (accountId: string) => {
    setPreferredBankAccount(customerId, accountId);
    refreshAccounts();
    setSuccessMsg('Preferred bank updated.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const toggleShowAccount = (id: string) => {
    setShowAccountNumbers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="customer-settings">
      <div className="settings-header">
        <button
          className="back-btn"
          onClick={() => navigate('/customer/settings')}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1>Bank Accounts</h1>
      </div>

      <div className="settings-content">
        {/* Success message */}
        {successMsg && (
          <div className="bank-success-msg">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {successMsg}
          </div>
        )}

        {/* Info note */}
        <div className="bank-info-note">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <p>
            Add your bank account to link it for UPI payments. Your preferred bank will be shown
            during payment. Full account numbers are never displayed — only masked versions.
          </p>
        </div>

        {/* Bank Accounts List */}
        <div className="settings-section">
          {accounts.length === 0 && !showAddForm && (
            <div className="bank-empty-state">
              <span className="bank-empty-icon">🏦</span>
              <p>No bank accounts added yet.</p>
              <p className="bank-empty-sub">
                Add a bank account to link it with UPI payments.
              </p>
            </div>
          )}

          {accounts.map((account) => (
            <div
              key={account.id}
              className={`bank-account-card ${account.isPreferred ? 'preferred' : ''}`}
            >
              <div className="bank-card-header">
                <div className="bank-card-info">
                  <div className="bank-card-name">{account.bankName}</div>
                  <div className="bank-card-account">
                    {showAccountNumbers[account.id]
                      ? account.accountNumber
                      : account.maskedAccountNumber}
                  </div>
                </div>
                {account.isPreferred && (
                  <span className="bank-preferred-badge">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      stroke="none"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
                    </svg>
                    Preferred
                  </span>
                )}
              </div>

              <div className="bank-card-details">
                <div className="bank-detail-row">
                  <span className="bank-detail-label">Account Holder</span>
                  <span className="bank-detail-value">
                    {account.accountHolderName}
                  </span>
                </div>
                <div className="bank-detail-row">
                  <span className="bank-detail-label">IFSC</span>
                  <span className="bank-detail-value bank-ifsc">
                    {account.ifscCode}
                  </span>
                </div>
              </div>

              <div className="bank-card-actions">
                <button
                  className="bank-action-btn toggle-visibility"
                  onClick={() => toggleShowAccount(account.id)}
                  title={
                    showAccountNumbers[account.id]
                      ? 'Hide account number'
                      : 'Show account number'
                  }
                >
                  {showAccountNumbers[account.id] ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </button>

                {!account.isPreferred && (
                  <button
                    className="bank-action-btn set-preferred"
                    onClick={() => handleSetPreferred(account.id)}
                    title="Set as preferred bank"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
                    </svg>
                    Set Preferred
                  </button>
                )}

                {confirmDelete === account.id ? (
                  <div className="bank-delete-confirm">
                    <span>Delete?</span>
                    <button
                      className="bank-action-btn delete-yes"
                      onClick={() => handleDelete(account.id)}
                    >
                      Yes
                    </button>
                    <button
                      className="bank-action-btn delete-no"
                      onClick={() => setConfirmDelete(null)}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    className="bank-action-btn delete"
                    onClick={() => setConfirmDelete(account.id)}
                    title="Remove bank account"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add Bank Account Form */}
        {showAddForm ? (
          <div className="settings-section bank-form-section">
            <h3 className="bank-form-title">Add Bank Account</h3>

            {formError && <div className="bank-form-error">{formError}</div>}

            <div className="bank-form-group">
              <label className="bank-form-label">Bank Name *</label>
              <select
                className="bank-form-input"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              >
                <option value="">Select your bank</option>
                {POPULAR_BANKS.map((bank) => (
                  <option key={bank} value={bank}>
                    {bank}
                  </option>
                ))}
              </select>
            </div>

            {bankName === 'Other' && (
              <div className="bank-form-group">
                <label className="bank-form-label">Enter Bank Name *</label>
                <input
                  className="bank-form-input"
                  type="text"
                  placeholder="e.g., City Union Bank"
                  value={customBankName}
                  onChange={(e) => setCustomBankName(e.target.value)}
                  maxLength={100}
                />
              </div>
            )}

            <div className="bank-form-group">
              <label className="bank-form-label">Account Holder Name *</label>
              <input
                className="bank-form-input"
                type="text"
                placeholder="e.g., Ravi Kumar"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="bank-form-group">
              <label className="bank-form-label">Account Number *</label>
              <input
                className="bank-form-input"
                type="password"
                placeholder="Enter your account number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                maxLength={20}
                autoComplete="off"
              />
            </div>

            <div className="bank-form-group">
              <label className="bank-form-label">Confirm Account Number *</label>
              <input
                className="bank-form-input"
                type="password"
                placeholder="Re-enter your account number"
                value={confirmAccountNumber}
                onChange={(e) => setConfirmAccountNumber(e.target.value)}
                maxLength={20}
                autoComplete="off"
              />
            </div>

            <div className="bank-form-group">
              <label className="bank-form-label">IFSC Code *</label>
              <input
                className="bank-form-input bank-form-ifsc"
                type="text"
                placeholder="e.g., HDFC0001234"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                maxLength={11}
              />
            </div>

            <div className="bank-form-actions">
              <button
                className="bank-form-btn bank-form-btn-primary"
                onClick={handleAddAccount}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Account
              </button>
              <button
                className="bank-form-btn bank-form-btn-cancel"
                onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="settings-section">
            <button
              className="bank-add-btn"
              onClick={() => setShowAddForm(true)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Bank Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
