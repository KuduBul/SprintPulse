-- Storage setup for retro board background images.
-- Creates the `retro-backgrounds` bucket (public) and a public-read policy.
-- Uploads use the Supabase service role key, which bypasses RLS, so only a
-- read policy is required for participants to view images via the public URL.
--
-- Idempotent and additive — safe to run against any environment.

INSERT INTO storage.buckets (id, name, public)
VALUES ('retro-backgrounds', 'retro-backgrounds', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read access retro-backgrounds'
  ) THEN
    CREATE POLICY "Public read access retro-backgrounds"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'retro-backgrounds');
  END IF;
END $$;
