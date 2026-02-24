-- FIX: Add missing updated_at column to emergency_alerts to resolve "column updated_at does not exist" error
-- This error occurs because a Trigger is trying to update this column, but it wasn't created.

ALTER TABLE public.emergency_alerts 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Optional: Ensure the trigger exists and is correct (Idempotent)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_emergency_alerts_updated_at ON public.emergency_alerts;

CREATE TRIGGER update_emergency_alerts_updated_at
    BEFORE UPDATE ON public.emergency_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
