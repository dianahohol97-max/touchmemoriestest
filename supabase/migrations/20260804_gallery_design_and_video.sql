-- Gallery design constructor + video support (Diana, 2026-08-04).
-- design: {bg, font, font_scale, cover} — validated by the PATCH API.
-- media_type: 'photo' | 'video' for gallery items; videos upload straight to
-- storage via short-lived signed URLs (multipart through Vercel caps ~4.5MB).
ALTER TABLE photographer_galleries
  ADD COLUMN IF NOT EXISTS design jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE photographer_gallery_photos
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'photo';
