-- Reviews Table for Instagram Stories Format
-- Stores client reviews/testimonials with 9:16 aspect ratio images

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url TEXT NOT NULL,
    video_url TEXT,
    caption TEXT,
    author TEXT,
    category TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_active ON reviews(is_active);
CREATE INDEX IF NOT EXISTS idx_reviews_sort_order ON reviews(sort_order);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);

-- RLS Policies
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Allow public read access for active reviews (for homepage display)
DROP POLICY IF EXISTS "Public can view active reviews" ON reviews;
CREATE POLICY "Public can view active reviews" ON reviews
    FOR SELECT USING (is_active = true);

-- Allow authenticated users to read all reviews (for admin panel)
DROP POLICY IF EXISTS "Authenticated users can view all reviews" ON reviews;
CREATE POLICY "Authenticated users can view all reviews" ON reviews
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert reviews
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON reviews;
CREATE POLICY "Authenticated users can insert reviews" ON reviews
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update reviews
DROP POLICY IF EXISTS "Authenticated users can update reviews" ON reviews;
CREATE POLICY "Authenticated users can update reviews" ON reviews
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete reviews
DROP POLICY IF EXISTS "Authenticated users can delete reviews" ON reviews;
CREATE POLICY "Authenticated users can delete reviews" ON reviews
    FOR DELETE USING (auth.role() = 'authenticated');

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reviews_updated_at ON reviews;
CREATE TRIGGER reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_reviews_updated_at();

-- Create storage bucket for review images if it doesn't exist
-- Note: This needs to be run via Supabase dashboard or API, not SQL
-- INSERT INTO storage.buckets (id, name, public) VALUES ('public', 'public', true) ON CONFLICT DO NOTHING;
