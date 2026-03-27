-- =============================================
-- Create Supabase Storage Bucket for Travel Book Covers
-- =============================================

-- Create the travel-covers bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'travel-covers',
    'travel-covers',
    true,  -- Public bucket so covers can be displayed on website
    5242880,  -- 5MB limit per file
    ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Allow public to read (view) covers
CREATE POLICY "Public can view travel covers"
ON storage.objects FOR SELECT
USING (bucket_id = 'travel-covers');

-- RLS Policy: Authenticated users (admins) can upload covers
CREATE POLICY "Authenticated users can upload travel covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'travel-covers');

-- RLS Policy: Authenticated users (admins) can update covers
CREATE POLICY "Authenticated users can update travel covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'travel-covers');

-- RLS Policy: Authenticated users (admins) can delete covers
CREATE POLICY "Authenticated users can delete travel covers"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'travel-covers');

-- =============================================
-- Comments
-- =============================================

COMMENT ON TABLE storage.buckets IS 'Storage buckets for file uploads';
