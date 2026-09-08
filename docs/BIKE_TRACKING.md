# 🚲 Free Bike GPS Tracking

A completely free bike tracking solution using MapLibre GL JS + OpenFreeMap + OpenStreetMap.

## ✨ Features

- **100% Free** - No API keys, no usage limits, no fees
- **Real-time Tracking** - Live GPS updates using browser Geolocation API
- **Beautiful Maps** - Multiple map styles (Bright, Light, Dark)
- **Supabase Integration** - Store and share bike locations in real-time
- **Privacy First** - GPS data stays in your browser until you choose to share

## 🛠️ Tech Stack

- **MapLibre GL JS** - Open-source map rendering library
- **OpenFreeMap** - Free tile hosting (no API keys needed!)
- **OpenStreetMap** - Free map data
- **Supabase** - Real-time database and authentication

## 🚀 Getting Started

### 1. Access the Tracking Page

Navigate to:
```
/track
```

Or with a specific bike ID:
```
/track/bike-123
```

### 2. Start Tracking

1. Click **"▶️ Start Tracking"** button
2. Allow location access when prompted
3. Your bike's location will appear on the map in real-time

### 3. Map Features

- **Map Style Selector** - Switch between Bright, Light, and Dark themes
- **Navigation Controls** - Zoom in/out with + and - buttons
- **Scale Control** - See distance measurements
- **Automatic Centering** - Map follows your bike's movement

## 📊 Real-time Data

### GPS Information Displayed

- **Latitude/Longitude** - Current coordinates
- **Accuracy** - GPS accuracy in meters
- **Speed** - Current speed in km/h (when available)
- **Last Update** - Timestamp of last GPS reading
- **Position History** - Track of all recorded positions

### Supabase Integration

To enable real-time sharing with other users:

1. **Create the database table**:
   ```sql
   -- Run this in your Supabase SQL editor
   -- File: supabase/migrations/20260908000000_create_bike_locations.sql
   ```

2. **Update the TrackingPage** to use Supabase:
   ```typescript
   import { useRealtimeGPS } from '../hooks/useRealtimeGPS';
   
   const { saveLocation, allBikeLocations } = useRealtimeGPS({
     bikeId: 'my-bike-123',
     userId: currentUser?.id,
   });
   
   // Save GPS position to Supabase
   useEffect(() => {
     if (position) {
       saveLocation(position);
     }
   }, [position]);
   ```

3. **View multiple bikes** on the same map by subscribing to `allBikeLocations`

## 🎨 Map Styles

| Style | Description |
|-------|-------------|
| **Bright** | Colorful, detailed map (default) |
| **Light** | Minimalist, light theme |
| **Dark** | Dark theme for low-light conditions |

## 🔧 Customization

### Change Default Location

Edit `src/components/MapTracker.tsx`:

```typescript
// Default to your city (e.g., Bangalore, India)
latitude = 12.9716
longitude = 77.5946
```

### Adjust GPS Accuracy

Edit `src/hooks/useGPS.ts`:

```typescript
const { position, error, isTracking } = useGPS({
  enableHighAccuracy: true,    // Use high-accuracy GPS
  maximumAge: 3000,            // Cache position for 3 seconds
  timeout: 10000,              // Timeout after 10 seconds
  watchPosition: true,         // Continuously watch position
});
```

### Add Custom Map Markers

```typescript
// In MapTracker.tsx, add custom markers
const marker = new maplibregl.Marker({
  color: '#10b981',  // Green color
  scale: 1.5,       // Larger marker
})
  .setLngLat([longitude, latitude])
  .setPopup(
    new maplibregl.Popup().setHTML('<h3>My Bike</h3>')
  )
  .addTo(map.current);
```

## 📱 Mobile Support

The tracking works great on mobile devices:

1. Open the app in your mobile browser
2. Navigate to `/track`
3. Allow location access
4. The map will track your bike as you ride

**Tip**: Add the app to your home screen for a native-like experience!

## 🔒 Privacy & Security

- **Browser GPS Only** - No data sent until you explicitly enable Supabase sync
- **No Tracking** - We don't track you or sell your data
- **Open Source** - All code is transparent and auditable
- **Local Storage** - GPS history stored locally in your browser

## 🐛 Troubleshooting

### Location Permission Denied

1. Click the lock icon in your browser's address bar
2. Set Location to "Allow"
3. Refresh the page

### Map Not Loading

- Check your internet connection
- OpenFreeMap might be temporarily down (rare)
- Try refreshing the page

### Low GPS Accuracy

- Move to an open area with clear sky view
- Avoid tunnels and dense urban areas
- Enable "High Accuracy" in your device's location settings

## 📈 Performance Tips

1. **Close other tabs** - Reduces battery drain
2. **Use WiFi** - Improves initial location fix
3. **Lower update frequency** - Increase `maximumAge` for better battery life
4. **Cache tiles** - MapLibre automatically caches map tiles

## 🎯 Use Cases

- **Bike Sharing** - Track rental bikes in real-time
- **Delivery Tracking** - Monitor delivery riders
- **Fleet Management** - Track company vehicles
- **Personal Use** - Log your cycling routes
- **Safety** - Share location with friends/family

## 📚 Resources

- [MapLibre GL JS Docs](https://maplibre.org/maplibre-gl-js/docs/)
- [OpenFreeMap](https://openfreemap.org/)
- [OpenStreetMap](https://www.openstreetmap.org/)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)

## 🤝 Contributing

Found a bug or want to improve the tracker? Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - Free to use, modify, and distribute.

---

**Made with ❤️ using 100% free and open-source technologies**
