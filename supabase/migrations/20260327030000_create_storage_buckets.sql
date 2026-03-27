-- =====================================================
-- STORAGE BUCKETS FOR ORDER FILES
-- Creates storage buckets for all product types
-- =====================================================

-- 1. Create calendar-uploads bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'calendar-uploads',
    'calendar-uploads',
    false,
    52428800, -- 50MB
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create poster-exports bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'poster-exports',
    'poster-exports',
    false,
    104857600, -- 100MB
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Create puzzle-uploads bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'puzzle-uploads',
    'puzzle-uploads',
    false,
    52428800, -- 50MB
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 4. Create guestbook-exports bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'guestbook-exports',
    'guestbook-exports',
    false,
    104857600, -- 100MB
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 5. Create order-exports bucket (for final print-ready files)
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
-- STORAGE POLICIES
-- =====================================================

-- Calendar uploads - authenticated users can upload, admins can read
CREATE POLICY "Authenticated users can upload calendar images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'calendar-uploads');

CREATE POLICY "Admins can read calendar uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'calendar-uploads');

-- Poster exports - admins only
CREATE POLICY "Admins can insert poster exports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'poster-exports');

CREATE POLICY "Admins can read poster exports"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'poster-exports');

-- Puzzle uploads - authenticated users can upload, admins can read
CREATE POLICY "Authenticated users can upload puzzle images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'puzzle-uploads');

CREATE POLICY "Admins can read puzzle uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'puzzle-uploads');

-- Guestbook exports - admins only
CREATE POLICY "Admins can insert guestbook exports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'guestbook-exports');

CREATE POLICY "Admins can read guestbook exports"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'guestbook-exports');

-- Order exports - admins only
CREATE POLICY "Admins can insert order exports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'order-exports');

CREATE POLICY "Admins can read order exports"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'order-exports');

-- =====================================================
-- ORDER FILES TABLE
-- Links uploaded/exported files to orders
-- =====================================================

CREATE TABLE IF NOT EXISTS order_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL, -- Full path in storage: bucket/order_id/filename.jpg
    file_name TEXT NOT NULL, -- Original filename
    file_type TEXT NOT NULL, -- 'upload' | 'export'
    file_category TEXT, -- 'photo' | 'cover' | 'calendar-page' | 'poster' | 'puzzle' | 'final-export'
    bucket_name TEXT NOT NULL, -- e.g., 'calendar-uploads', 'order-exports'
    page_number INT, -- For calendar/book pages
    file_size BIGINT, -- File size in bytes
    mime_type TEXT, -- e.g., 'image/jpeg', 'application/pdf'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast order file lookups
CREATE INDEX IF NOT EXISTS idx_order_files_order_id ON order_files(order_id);
CREATE INDEX IF NOT EXISTS idx_order_files_type ON order_files(file_type, file_category);

-- RLS policies
ALTER TABLE order_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all order files"
ON order_files FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert order files"
ON order_files FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins can update order files"
ON order_files FOR UPDATE
TO authenticated
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can delete order files"
ON order_files FOR DELETE
TO authenticated
USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_order_files_updated_at BEFORE UPDATE ON order_files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE order_files IS 'Tracks all uploaded and exported files for orders';
COMMENT ON COLUMN order_files.file_type IS 'upload = customer uploaded, export = generated by system';
COMMENT ON COLUMN order_files.file_category IS 'Categorizes file purpose: photo, cover, calendar-page, poster, puzzle, final-export';
COMMENT ON COLUMN order_files.page_number IS 'For multi-page products (calendars, books), tracks page number';
