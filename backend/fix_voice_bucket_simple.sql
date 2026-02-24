
-- Create bucket if not exists (using extension function if available, or insert)
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-recordings', 'voice-recordings', true)
ON CONFLICT (id) DO NOTHING;

-- Policies (safe creation)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Access Voice Recordings'
    ) THEN
        CREATE POLICY "Public Access Voice Recordings" ON storage.objects FOR SELECT USING ( bucket_id = 'voice-recordings' );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Auth Upload Voice Recordings'
    ) THEN
        CREATE POLICY "Auth Upload Voice Recordings" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'voice-recordings' );
    END IF;
END
$$;
