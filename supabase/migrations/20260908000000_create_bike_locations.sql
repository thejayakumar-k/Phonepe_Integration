-- Create bike_locations table for real-time GPS tracking
CREATE TABLE IF NOT EXISTS bike_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bike_id TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'anonymous',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  accuracy DOUBLE PRECISION NOT NULL DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one location per bike (upsert on bike_id)
  CONSTRAINT bike_locations_bike_id_key UNIQUE (bike_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_bike_locations_bike_id ON bike_locations(bike_id);
CREATE INDEX IF NOT EXISTS idx_bike_locations_timestamp ON bike_locations(timestamp DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE bike_locations ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (anyone can see bike locations)
CREATE POLICY "Public read access for bike locations" ON bike_locations
  FOR SELECT USING (true);

-- Create policy for authenticated insert/update (only logged-in users can update their own bikes)
CREATE POLICY "Authenticated users can update bike locations" ON bike_locations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update their bike locations" ON bike_locations
  FOR UPDATE USING (true);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE bike_locations;

-- Add comment to table
COMMENT ON TABLE bike_locations IS 'Real-time GPS locations for bike tracking. Each row represents the latest position of a bike.';
COMMENT ON COLUMN bike_locations.bike_id IS 'Unique identifier for the bike being tracked';
COMMENT ON COLUMN bike_locations.latitude IS 'GPS latitude coordinate';
COMMENT ON COLUMN bike_locations.longitude IS 'GPS longitude coordinate';
COMMENT ON COLUMN bike_locations.speed IS 'Speed in meters per second (optional)';
COMMENT ON COLUMN bike_locations.heading IS 'Heading in degrees (optional)';
COMMENT ON COLUMN bike_locations.accuracy IS 'GPS accuracy in meters';
