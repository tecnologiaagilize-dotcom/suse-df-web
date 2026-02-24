-- Enable PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;

-- Add Geography column to location_updates if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'location_updates' AND column_name = 'geom') THEN
        ALTER TABLE location_updates ADD COLUMN geom geography(POINT, 4326);
        CREATE INDEX idx_location_updates_geom ON location_updates USING GIST (geom);
    END IF;
END $$;

-- Trigger to automatically populate geom from lat/lng on insert (Backward Compatibility)
CREATE OR REPLACE FUNCTION sync_geom_from_latlng()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_geom ON location_updates;
CREATE TRIGGER trg_sync_geom
BEFORE INSERT OR UPDATE ON location_updates
FOR EACH ROW
EXECUTE FUNCTION sync_geom_from_latlng();

-- RPC: Update Location with GIS support (Explicit)
CREATE OR REPLACE FUNCTION update_location_gis(
    p_alert_id UUID,
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION,
    p_speed DOUBLE PRECISION DEFAULT 0,
    p_heading DOUBLE PRECISION DEFAULT 0,
    p_accuracy DOUBLE PRECISION DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO location_updates (
        alert_id, 
        latitude, 
        longitude, 
        speed, 
        heading, 
        accuracy,
        geom
    ) VALUES (
        p_alert_id,
        p_lat,
        p_lng,
        p_speed,
        p_heading,
        p_accuracy,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get Route Polyline (Simplified for Frontend)
CREATE OR REPLACE FUNCTION get_alert_route(p_alert_id UUID)
RETURNS TABLE (
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    recorded_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        latitude, 
        longitude, 
        recorded_at
    FROM location_updates
    WHERE alert_id = p_alert_id
    ORDER BY recorded_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
