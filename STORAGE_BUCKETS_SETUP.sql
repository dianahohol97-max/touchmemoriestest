-- =====================================================
-- MANUAL SETUP: Supabase Storage Buckets
-- Run this in Supabase Dashboard SQL Editor
-- =====================================================

-- NOTE: Storage buckets cannot be created via SQL in some Supabase versions.
-- If this script fails, create buckets manually via Supabase Dashboard:
-- 1. Go to Storage section in Supabase Dashboard
-- 2. Click "New bucket"
-- 3. Create each bucket with the settings below

-- Alternatively, use the SQL below (works on newer Supabase versions):

-- 1. Calendar uploads bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'calendar-uploads',
    'calendar-uploads',
    false,
    52428800, -- 50MB
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Poster exports bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'poster-exports',
    'poster-exports',
    false,
    104857600, -- 100MB
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Puzzle uploads bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'puzzle-uploads',
    'puzzle-uploads',
    false,
    52428800, -- 50MB
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 4. Guest book exports bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'guestbook-exports',
    'guestbook-exports',
    false,
    104857600, -- 100MB
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 5. Order exports bucket (final print-ready files)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'order-exports',
    'order-exports',
    false,
    104857600, -- 100MB
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STORAGE RLS POLICIES
-- =====================================================

-- Calendar uploads
CREATE POLICY "Authenticated users can upload calendar images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'calendar-uploads');

CREATE POLICY "Authenticated users can read calendar uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'calendar-uploads');

CREATE POLICY "Authenticated users can delete calendar uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'calendar-uploads');

-- Poster exports
CREATE POLICY "Authenticated users can insert poster exports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'poster-exports');

CREATE POLICY "Authenticated users can read poster exports"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'poster-exports');

CREATE POLICY "Authenticated users can delete poster exports"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'poster-exports');

-- Puzzle uploads
CREATE POLICY "Authenticated users can upload puzzle images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'puzzle-uploads');

CREATE POLICY "Authenticated users can read puzzle uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'puzzle-uploads');

CREATE POLICY "Authenticated users can delete puzzle uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'puzzle-uploads');

-- Guest book exports
CREATE POLICY "Authenticated users can insert guestbook exports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'guestbook-exports');

CREATE POLICY "Authenticated users can read guestbook exports"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'guestbook-exports');

CREATE POLICY "Authenticated users can delete guestbook exports"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'guestbook-exports');

-- Order exports
CREATE POLICY "Authenticated users can insert order exports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'order-exports');

CREATE POLICY "Authenticated users can read order exports"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'order-exports');

CREATE POLICY "Authenticated users can delete order exports"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'order-exports');

-- =====================================================
-- ORDER FILES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS order_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('upload', 'export')),
    file_category TEXT,
    bucket_name TEXT NOT NULL,
    page_number INT,
    file_size BIGINT,
    mime_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_files_order_id ON order_files(order_id);
CREATE INDEX IF NOT EXISTS idx_order_files_type ON order_files(file_type, file_category);

-- RLS
ALTER TABLE order_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all order files"
ON order_files FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert order files"
ON order_files FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can update order files"
ON order_files FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Admins can delete order files"
ON order_files FOR DELETE
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_order_files_updated_at
BEFORE UPDATE ON order_files
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if buckets were created
-- SELECT * FROM storage.buckets WHERE name IN ('calendar-uploads', 'poster-exports', 'puzzle-uploads', 'guestbook-exports', 'order-exports');

-- Check order_files table
-- SELECT COUNT(*) FROM order_files;

-- Test file upload (replace with actual order ID)
-- Example: INSERT INTO order_files (order_id, file_path, file_name, file_type, bucket_name)
-- VALUES ('your-order-uuid', 'test-order-id/test.jpg', 'test.jpg', 'upload', 'puzzle-uploads');
