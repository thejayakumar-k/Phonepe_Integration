import { useEffect } from 'react';
import { LiveTrackingMap } from './LiveTrackingMap';
import { useGPS } from '../hooks/useGPS';
import { useRealtimeGPS } from '../hooks/useRealtimeGPS';

// OORUNII WATER SUPPLY - Maduravoyal, Chennai
const SHOP_LOCATION = { lat: 13.0538, lng: 80.1635 };

interface LiveTrackingExampleProps {
  bikeId: string;
  userId?: string;
}

export function LiveTrackingExample({ bikeId, userId }: LiveTrackingExampleProps) {
  const { position, error, isTracking, startTracking, stopTracking } = useGPS({
    enableHighAccuracy: true,
    maximumAge: 3000,
    timeout: 10000,
    watchPosition: true,
  });

  const {
    bikeLocation,
    allBikeLocations,
    error: syncError,
    isConnected,
    saveLocation,
  } = useRealtimeGPS({ bikeId, userId });

  // Save GPS position to Supabase when position updates
  useEffect(() => {
    if (position && isTracking) {
      saveLocation(position);
    }
  }, [position, isTracking, saveLocation]);

  const bike = bikeLocation
    ? {
        lat: bikeLocation.latitude,
        lng: bikeLocation.longitude,
        heading: bikeLocation.heading ?? null,
        timestamp: bikeLocation.timestamp ? Date.parse(bikeLocation.timestamp) : null,
        speed: bikeLocation.speed ?? null,
      }
    : position
      ? {
          lat: position.latitude,
          lng: position.longitude,
          heading: position.heading ?? null,
          timestamp: position.timestamp,
          speed: position.speed ?? null,
        }
      : null;

  // Get all bike locations as array for display
  const allLocations = Array.from(allBikeLocations.values());

  return (
    <div className="tracking-page">
      <div className="tracking-header">
        <div className="tracking-header-inner">
          <h1>🛵 Live Bike Tracking</h1>
          <p>Real-time location synced with Supabase + OSRM routes</p>
        </div>
      </div>

      <div className="tracking-body">
        {/* Map Section */}
        <div className="tracking-map-section">
          <div className="tracking-card">
            <div className="tracking-card-header">
              <h2>Live Map - {bikeId}</h2>
            </div>
            <div className="tracking-map-container">
              <LiveTrackingMap
                className="ltm-size-420"
                bike={bike}
                destination={SHOP_LOCATION}
                destinationLabel="VVK Water Supply"
                partnerLabel="Bike"
              />
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="tracking-panel">
          {/* Connection Status */}
          <div className="tracking-card">
            <div className="tracking-card-header">
              <h3>Connection Status</h3>
            </div>
            <div className="tracking-card-body">
              <div className="tracking-status-row">
                <span className="tracking-status-label">Supabase:</span>
                <span className={`tracking-status-badge ${isConnected ? 'active' : 'inactive'}`}>
                  {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                </span>
              </div>
              <div className="tracking-status-row">
                <span className="tracking-status-label">GPS:</span>
                <span className={`tracking-status-badge ${isTracking ? 'active' : 'inactive'}`}>
                  {isTracking ? '🟢 Active' : '⚪ Inactive'}
                </span>
              </div>
            </div>
          </div>

          {/* Errors */}
          {(error || syncError) && (
            <div className="tracking-error">
              <p>{error || syncError}</p>
            </div>
          )}

          {/* Control Buttons */}
          <div className="tracking-card">
            <div className="tracking-card-body">
              <button
                onClick={isTracking ? stopTracking : startTracking}
                className={`tracking-btn ${isTracking ? 'stop' : 'start'}`}
              >
                {isTracking ? '⏹️ Stop Tracking' : '▶️ Start Tracking'}
              </button>
            </div>
          </div>

          {/* Current Position */}
          {position && (
            <div className="tracking-card">
              <div className="tracking-card-header">
                <h3>Current Position</h3>
              </div>
              <div className="tracking-card-body">
                <div className="tracking-detail-row">
                  <span className="tracking-detail-label">Latitude:</span>
                  <span className="tracking-detail-value">{position.latitude.toFixed(6)}</span>
                </div>
                <div className="tracking-detail-row">
                  <span className="tracking-detail-label">Longitude:</span>
                  <span className="tracking-detail-value">{position.longitude.toFixed(6)}</span>
                </div>
                <div className="tracking-detail-row">
                  <span className="tracking-detail-label">Accuracy:</span>
                  <span className="tracking-detail-value">{position.accuracy.toFixed(1)}m</span>
                </div>
                {position.speed && (
                  <div className="tracking-detail-row">
                    <span className="tracking-detail-label">Speed:</span>
                    <span className="tracking-detail-value">{(position.speed * 3.6).toFixed(1)} km/h</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Other Bikes on Map */}
          {allLocations.length > 0 && (
            <div className="tracking-card">
              <div className="tracking-card-header">
                <h3>Other Bikes ({allLocations.length})</h3>
              </div>
              <div className="tracking-card-body">
                <div className="tracking-history-list">
                  {allLocations
                    .filter((loc) => loc.bike_id !== bikeId)
                    .map((loc) => (
                      <div key={loc.bike_id} className="tracking-history-item">
                        <div className="tracking-history-top">
                          <span>{loc.bike_id}</span>
                          <span>{new Date(loc.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="tracking-history-coords">
                          {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px 20px' }}>
        <div className="tracking-info-box" style={{ background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
          <h3 style={{ color: '#10b981' }}>✅ Real-time Tracking Active</h3>
          <ul>
            <li style={{ color: '#059669' }}>• Your bike's location is synced to Supabase in real-time</li>
            <li style={{ color: '#059669' }}>• OSRM road routes shown automatically (free public server)</li>
            <li style={{ color: '#059669' }}>• Other users can track this bike from any device</li>
          </ul>
        </div>
      </div>
    </div>
  );
}