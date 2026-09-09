import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function DeliverySettings() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="dp-container">
      <div className="dp-header">
        <h1 className="dp-title">Partner Settings</h1>
        <p className="dp-subtitle">Manage your delivery partner profile</p>
      </div>

      <div className="dp-card" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: 'rgba(59, 130, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem',
            }}
          >
            🛵
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#111827' }}>
              {session?.partnerName || session?.username || 'Arun Kumar'}
            </h3>
            <p style={{ margin: '0.2rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
              ID: {session?.partnerId || 'DP001'} · Verified Delivery Partner
            </p>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#374151' }}>
            <span>Vehicle Type</span>
            <span style={{ fontWeight: 600 }}>Two Wheeler (Bike)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#374151' }}>
            <span>GPS Tracking Mode</span>
            <span style={{ fontWeight: 600, color: '#10b981' }}>High Accuracy GPS</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#374151' }}>
            <span>Location Update Rate</span>
            <span style={{ fontWeight: 600 }}>Real-time (1000ms)</span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          style={{
            marginTop: '1.5rem',
            width: '100%',
            padding: '0.75rem',
            background: '#fee2e2',
            color: '#dc2626',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          Log Out
        </button>
      </div>
    </div>
  );
}
