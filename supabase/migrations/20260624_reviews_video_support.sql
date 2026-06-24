-- Add video_url and media_type to reviews table
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image'
    CHECK (media_type IN ('image', 'video'));

-- Create public review-media bucket supporting both images and videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-media',
  'review-media',
  true,
  104857600, -- 100MB (covers video)
  ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: admins can upload, public can read (bucket is public)
DROP POLICY IF EXISTS "Admins upload review media" ON storage.objects;
CREATE POLICY "Admins upload review media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'review-media' AND is_admin());

DROP POLICY IF EXISTS "Public reads review media" ON storage.objects;
CREATE POLICY "Public reads review media"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'review-media');

DROP POLICY IF EXISTS "Admins delete review media" ON storage.objects;
CREATE POLICY "Admins delete review media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'review-media' AND is_admin());
