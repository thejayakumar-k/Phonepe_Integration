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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">🚲 Bike GPS Tracker</h1>
          <p className="text-gray-600">Real-time location tracking powered by OpenStreetMap</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-800">Live Map</h2>
              </div>
              <div className="h-[500px]">
                <MapTracker
                  latitude={position?.latitude}
                  longitude={position?.longitude}
                  zoom={position ? 16 : 12}
                  showUserLocation={!!position}
                  className="h-full"
                />
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="space-y-4">
            {/* Tracking Status */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Tracking Status</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                    isTracking 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {isTracking ? '🟢 Active' : '⚪ Inactive'}
                  </span>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-red-800 text-sm">{error}</p>
                  </div>
                )}

                <button
                  onClick={isTracking ? stopTracking : startTracking}
                  className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
                    isTracking
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-blue-500 hover:bg-blue-600'
                  }`}
                >
                  {isTracking ? '⏹️ Stop Tracking' : '▶️ Start Tracking'}
                </button>
              </div>
            </div>

            {/* Current Position */}
            {position && (
              <div className="bg-white rounded-lg shadow-md p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Current Position</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Latitude:</span>
                    <span className="font-mono text-sm">
                      {formatCoordinate(position.latitude, 'lat')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Longitude:</span>
                    <span className="font-mono text-sm">
                      {formatCoordinate(position.longitude, 'lng')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Accuracy:</span>
                    <span className="text-sm">{position.accuracy.toFixed(1)}m</span>
                  </div>
                  {position.speed && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Speed:</span>
                      <span className="text-sm">{(position.speed * 3.6).toFixed(1)} km/h</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Update:</span>
                    <span className="text-sm">{formatTime(position.timestamp)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tracking History */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Position History ({trackingHistory.length} points)
              </h3>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {trackingHistory.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No tracking data yet. Start tracking to see history.
                  </p>
                ) : (
                  trackingHistory.slice().reverse().map((point, index) => (
                    <div key={index} className="bg-gray-50 rounded-md p-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">#{trackingHistory.length - index}</span>
                        <span className="text-gray-500">{formatTime(point.timestamp)}</span>
                      </div>
                      <div className="font-mono text-gray-700">
                        {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-blue-800 font-semibold mb-2">ℹ️ About This Tracker</h3>
          <ul className="text-blue-700 text-sm space-y-1">
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
