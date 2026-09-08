import { useEffect } from 'react';
import { MapTracker } from './MapTracker';
import { useGPS } from '../hooks/useGPS';
import { useRealtimeGPS } from '../hooks/useRealtimeGPS';

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

  // Get all bike locations as array for display
  const allLocations = Array.from(allBikeLocations.values());

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          🚲 Live Bike Tracking
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-800">
                  Live Map - {bikeId}
                </h2>
              </div>
              <div className="h-[500px]">
                <MapTracker
                  latitude={position?.latitude || bikeLocation?.latitude}
                  longitude={position?.longitude || bikeLocation?.longitude}
                  zoom={16}
                  showUserLocation={!!position}
                  className="h-full"
                />
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="space-y-4">
            {/* Connection Status */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Connection Status
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Supabase:</span>
                  <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                    isConnected 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">GPS:</span>
                  <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                    isTracking 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {isTracking ? '🟢 Active' : '⚪ Inactive'}
                  </span>
                </div>
              </div>
            </div>

            {/* Errors */}
            {(error || syncError) && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-red-800 text-sm">
                  {error || syncError}
                </p>
              </div>
            )}

            {/* Control Buttons */}
            <div className="bg-white rounded-lg shadow-md p-4">
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

            {/* Current Position */}
            {position && (
              <div className="bg-white rounded-lg shadow-md p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Current Position
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Latitude:</span>
                    <span className="font-mono">{position.latitude.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Longitude:</span>
                    <span className="font-mono">{position.longitude.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Accuracy:</span>
                    <span>{position.accuracy.toFixed(1)}m</span>
                  </div>
                  {position.speed && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Speed:</span>
                      <span>{(position.speed * 3.6).toFixed(1)} km/h</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Other Bikes on Map */}
            {allLocations.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Other Bikes ({allLocations.length})
                </h3>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {allLocations
                    .filter((loc) => loc.bike_id !== bikeId)
                    .map((loc) => (
                      <div
                        key={loc.bike_id}
                        className="bg-gray-50 rounded-md p-2 text-xs"
                      >
                        <div className="font-medium text-gray-800">
                          {loc.bike_id}
                        </div>
                        <div className="font-mono text-gray-600">
                          {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                        </div>
                        <div className="text-gray-500">
                          {new Date(loc.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-green-800 font-semibold mb-2">
            ✅ Real-time Supabase Sync Active
          </h3>
          <ul className="text-green-700 text-sm space-y-1">
            <li>• Your bike's location is being synced to Supabase in real-time</li>
            <li>• Other users can see your bike on their maps</li>
            <li>• All bikes are tracked simultaneously</li>
            <li>• Data is stored securely in your Supabase database</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
