import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUpiIds, saveUpiId, removeUpiId, setActiveUpiId, getActiveUpiId } from '../utils/storage';

export function ManageUpi() {
  const navigate = useNavigate();
  const [ids, setIds] = useState(() => getUpiIds());
  const [newId, setNewId] = useState('');
  const [error, setError] = useState('');

  const refresh = () => setIds(getUpiIds());

  const handleAdd = () => {
    const trimmed = newId.trim();
    if (!trimmed) {
      setError('Enter a UPI ID first.');
      return;
    }
    if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(trimmed)) {
      setError('Enter a valid UPI ID (example: name@okhdfcbank).');
      return;
    }
    setError('');
    saveUpiId(trimmed);
    setNewId('');
    refresh();
  };

  const handleUse = (id: string) => {
    setActiveUpiId(id);
    refresh();
  };

  const handleRemove = (id: string) => {
    removeUpiId(id);
    refresh();
  };

  const activeId = getActiveUpiId();

  return (
    <div className="customer-settings">
      <div className="settings-header">
        <button className="back-btn" onClick={() => navigate('/customer/settings')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1>Manage UPI Numbers</h1>
      </div>

      <div className="settings-content">
        <div className="manage-upi-note">
          Add all your UPI IDs and pick the active one for payments. If one shows an
          &quot;exceed&quot; limit error, switch to another.
        </div>

        <div className="settings-section">
          <div className="upi-id-list">
            {ids.length === 0 && (
              <p className="upi-id-empty">
                No UPI IDs added yet. The default one from the app settings is used.
              </p>
            )}
            {ids.map((id) => (
              <div key={id} className={`upi-id-row ${id === activeId ? 'active' : ''}`}>
                <div className="upi-id-info">
                  <span className="upi-id-value">{id}</span>
                  {id === activeId && <span className="upi-id-badge">Active</span>}
                </div>
                <div className="upi-id-actions">
                  {id !== activeId && (
                    <button className="upi-id-btn use" onClick={() => handleUse(id)}>
                      Use
                    </button>
                  )}
                  <button className="upi-id-btn remove" onClick={() => handleRemove(id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <div className="upi-id-add">
            <input
              className="upi-id-input"
              type="text"
              placeholder="Enter UPI ID (name@bank)"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
            />
            <button className="upi-id-add-btn" onClick={handleAdd}>
              Add
            </button>
          </div>
          {error && <p className="upi-id-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
