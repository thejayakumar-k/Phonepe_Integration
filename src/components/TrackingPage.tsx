import { useState, useEffect } from 'react';
import { MapTracker } from './MapTracker';
import { useGPS } from '../hooks/useGPS';

export function TrackingPage() {
  const { position, error, isTracking, startTracking, stopTracking } = useGPS({
    enableHighAccuracy: true,
    maximumAge: 3000,
    timeout: 10000,
    watchPosition: true,
  });

  const [trackingHistory, setTrackingHistory] = useState<Array<{
    latitude: number;
    longitude: number;
    timestamp: number;
  }>>([]);

  // Record GPS positions to history
  useEffect(() => {
    if (position) {
      setTrackingHistory((prev) => [
        ...prev,
        {
          latitude: position.latitude,
          longitude: position.longitude,
          timestamp: position.timestamp,
        },
      ]);
    }
  }, [position]);

  const formatCoordinate = (value: number, type: 'lat' | 'lng') => {
    const direction = type === 'lat' ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
    return `${Math.abs(value).toFixed(6)}° ${direction}`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="tracking-page">
      {/* Header */}
      <div className="tracking-header">
        <div className="tracking-header-inner">
          <h1>🚲 Bike GPS Tracker</h1>
          <p>Real-time location tracking powered by OpenStreetMap</p>
        </div>
      </div>

      <div className="tracking-body">
        {/* Map Section */}
        <div className="tracking-map-section">
          <div className="tracking-card">
            <div className="tracking-card-header">
              <h2>Live Map</h2>
            </div>
            <div className="tracking-map-container">
              <MapTracker
                latitude={position?.latitude}
                longitude={position?.longitude}
                zoom={position ? 16 : 12}
                showUserLocation={!!position}
              />
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="tracking-panel">
          {/* Tracking Status */}
          <div className="tracking-card">
            <div className="tracking-card-header">
              <h3>Tracking Status</h3>
            </div>
            <div className="tracking-card-body">
              <div className="tracking-status-row">
                <span className="tracking-status-label">Status:</span>
                <span className={`tracking-status-badge ${isTracking ? 'active' : 'inactive'}`}>
                  {isTracking ? '🟢 Active' : '⚪ Inactive'}
                </span>
              </div>

              {error && (
                <div className="tracking-error">
                  <p>{error}</p>
                </div>
              )}

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
                  <span className="tracking-detail-value">
                    {formatCoordinate(position.latitude, 'lat')}
                  </span>
                </div>
                <div className="tracking-detail-row">
                  <span className="tracking-detail-label">Longitude:</span>
                  <span className="tracking-detail-value">
                    {formatCoordinate(position.longitude, 'lng')}
                  </span>
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
                <div className="tracking-detail-row">
                  <span className="tracking-detail-label">Last Update:</span>
                  <span className="tracking-detail-value">{formatTime(position.timestamp)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tracking History */}
          <div className="tracking-card">
            <div className="tracking-card-header">
              <h3>Position History ({trackingHistory.length} points)</h3>
            </div>
            <div className="tracking-card-body">
              <div className="tracking-history-list">
                {trackingHistory.length === 0 ? (
                  <p className="tracking-empty">
                    No tracking data yet. Start tracking to see history.
                  </p>
                ) : (
                  trackingHistory.slice().reverse().map((point, index) => (
                    <div key={index} className="tracking-history-item">
                      <div className="tracking-history-top">
                        <span>#{trackingHistory.length - index}</span>
                        <span>{formatTime(point.timestamp)}</span>
                      </div>
                      <div className="tracking-history-coords">
                        {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px 20px' }}>
        <div className="tracking-info-box">
          <h3>ℹ️ About This Tracker</h3>
          <ul>
            <li>• <strong>100% Free:</strong> Uses MapLibre GL JS + OpenFreeMap (no API keys needed)</li>
            <li>• <strong>Privacy:</strong> GPS data stays in your browser until you choose to share it</li>
            <li>• <strong>Accuracy:</strong> Uses high-accuracy GPS when available</li>
            <li>• <strong>No Limits:</strong> Unlimited map views and tracking sessions</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
