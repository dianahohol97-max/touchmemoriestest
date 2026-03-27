-- Create media_library table for centralized image management
CREATE TABLE IF NOT EXISTS media_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL, -- in bytes
    file_type TEXT NOT NULL, -- image/jpeg, image/png, etc.
    alt_text TEXT,
    caption TEXT,
    width INTEGER,
    height INTEGER,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    folder TEXT DEFAULT 'uncategorized', -- for organizing into folders
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_library_folder ON media_library(folder);
CREATE INDEX IF NOT EXISTS idx_media_library_tags ON media_library USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_media_library_created_at ON media_library(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_library_is_active ON media_library(is_active);

-- RLS Policies
ALTER TABLE media_library ENABLE ROW LEVEL SECURITY;

-- Public can read active media
CREATE POLICY "Public can read active media" ON media_library
    FOR SELECT
    USING (is_active = true);

-- Authenticated users can do everything (admins)
CREATE POLICY "Authenticated users have full access" ON media_library
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_media_library_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER media_library_updated_at
    BEFORE UPDATE ON media_library
    FOR EACH ROW
    EXECUTE FUNCTION update_media_library_updated_at();

-- Insert some sample folders (optional)
COMMENT ON TABLE media_library IS 'Centralized media library for all uploaded images across the site';
