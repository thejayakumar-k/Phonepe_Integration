import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LiveTrackingMap, type LiveTrackingStats } from './LiveTrackingMap';
import { useGPS } from '../hooks/useGPS';
import { useRealtimeGPS } from '../hooks/useRealtimeGPS';

// VVK WATER SUPPLY - Jeeva Complex, Alapakkam, Maduravoyal, Chennai
const SHOP_LOCATION = { lat: 13.054, lng: 80.17 };

export function TrackingPage() {
  const { bikeId } = useParams<{ bikeId: string }>();
  const { position, error, isTracking, startTracking, stopTracking } = useGPS({
    enableHighAccuracy: true,
    maximumAge: 3000,
    timeout: 10000,
    watchPosition: true,
  });

  // When the URL carries a bike id, the remote bike (a real delivery
  // partner streaming from another device) is the one we follow.
  const { bikeLocation, saveLocation } = useRealtimeGPS({
    bikeId: bikeId || 'demo-bike',
    enabled: !!bikeId,
  });

  const [trackingHistory, setTrackingHistory] = useState<Array<{
    latitude: number;
    longitude: number;
    timestamp: number;
  }>>([]);
  const [stats, setStats] = useState<LiveTrackingStats | null>(null);

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

  // Share this device's location as the bike when a bike id is set.
  useEffect(() => {
    if (position && bikeId) {
      saveLocation(position);
    }
  }, [position, bikeId, saveLocation]);

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

  const formatCoordinate = (value: number, type: 'lat' | 'lng') => {
    const direction = type === 'lat' ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
    return `${Math.abs(value).toFixed(6)}° ${direction}`;
  };

  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString();

  const lastStamp =
    position?.timestamp ??
    (bikeLocation?.timestamp ? Date.parse(bikeLocation.timestamp) : undefined);

  return (
    <div className="tracking-page">
      {/* Header */}
      <div className="tracking-header">
        <div className="tracking-header-inner">
          <h1>🛵 {bikeId ? `Live Delivery · ${bikeId}` : 'Bike GPS Tracker'}</h1>
          <p>Real-time delivery tracking with OSRM routes · 100% free</p>
        </div>
      </div>

      <div className="tracking-body">
        {/* Map Section */}
        <div className="tracking-map-section">
          <div className="tracking-card">
            <div className="tracking-card-header">
              <h2>Live Map {bikeId ? `- ${bikeId}` : ''}</h2>
              <span className="tracking-status-badge active">
                {isTracking || bikeLocation ? '🟢 Live' : '⚪ Waiting'}
              </span>
            </div>
            <div className="tracking-map-container">
              <LiveTrackingMap
                className="ltm-size-420"
                bike={bike}
                destination={SHOP_LOCATION}
                destinationLabel="VVK Water Supply"
                partnerLabel="Delivery bike"
                onStats={setStats}
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

              {stats && (
                <div className="tracking-status-row">
                  <span className="tracking-status-label">ETA:</span>
                  <span className="tracking-status-value">
                    {stats.etaSeconds > 0 ? `${Math.max(1, Math.round(stats.etaSeconds / 60))} min · ${(stats.distanceMeters / 1000).toFixed(2)} km` : '--'}
                  </span>
                </div>
              )}

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
          {(position || bikeLocation) && (
            <div className="tracking-card">
              <div className="tracking-card-header">
                <h3>Current Position</h3>
              </div>
              <div className="tracking-card-body">
                <div className="tracking-detail-row">
                  <span className="tracking-detail-label">Latitude:</span>
                  <span className="tracking-detail-value">
                    {formatCoordinate(position?.latitude ?? bikeLocation!.latitude, 'lat')}
                  </span>
                </div>
                <div className="tracking-detail-row">
                  <span className="tracking-detail-label">Longitude:</span>
                  <span className="tracking-detail-value">
                    {formatCoordinate(position?.longitude ?? bikeLocation!.longitude, 'lng')}
                  </span>
                </div>
                {position && position.accuracy && (
                  <div className="tracking-detail-row">
                    <span className="tracking-detail-label">Accuracy:</span>
                    <span className="tracking-detail-value">{position.accuracy.toFixed(1)}m</span>
                  </div>
                )}
                {(position?.speed || bikeLocation?.speed) && (
                  <div className="tracking-detail-row">
                    <span className="tracking-detail-label">Speed:</span>
                    <span className="tracking-detail-value">
                      {(((position?.speed ?? 0) || (bikeLocation?.speed ?? 0)) * 3.6).toFixed(1)} km/h
                    </span>
                  </div>
                )}
                <div className="tracking-detail-row">
                  <span className="tracking-detail-label">Last Update:</span>
                  <span className="tracking-detail-value">
                    {lastStamp ? formatTime(lastStamp) : '--'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tracking History */}
          {trackingHistory.length > 0 && (
            <div className="tracking-card">
              <div className="tracking-card-header">
                <h3>Position History ({trackingHistory.length} points)</h3>
              </div>
              <div className="tracking-card-body">
                <div className="tracking-history-list">
                  {trackingHistory.slice().reverse().map((point, index) => (
                    <div key={index} className="tracking-history-item">
                      <div className="tracking-history-top">
                        <span>#{trackingHistory.length - index}</span>
                        <span>{formatTime(point.timestamp)}</span>
                      </div>
                      <div className="tracking-history-coords">
                        {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
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
        <div className="tracking-info-box">
          <h3>ℹ️ About This Tracker</h3>
          <ul>
            <li>• <strong>100% Free:</strong> MapLibre GL JS + OpenFreeMap basemap (no API keys)</li>
            <li>• <strong>OSRM Routing:</strong> road-following route lines from the free public OSRM server</li>
            <li>• <strong>Real-time:</strong> browser GPS + Supabase realtime for cross-device delivery tracking</li>
            <li>• <strong>No Limits:</strong> unlimited map views and tracking sessions</li>
          </ul>
        </div>
      </div>
    </div>
  );
}