-- Gallery files move to Cloudflare R2 (zero egress) while existing files stay
-- on Supabase Storage. Each row records where its file actually lives, so
-- reads/deletes resolve per file and no migration of old galleries is needed
-- (they expire in 30–90 days anyway).
ALTER TABLE photographer_gallery_photos
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'supabase';
