-- =====================================================
-- FEATURED ARTICLES TABLE
-- For homepage featured content (Travel Book, Blog sections)
-- =====================================================

CREATE TABLE IF NOT EXISTS featured_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section VARCHAR NOT NULL,  -- 'travel', 'blog', 'photobooks', etc.
    position INT NOT NULL,     -- Display order within section
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    image_url TEXT,
    link_url TEXT,
    category_label VARCHAR,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_featured_articles_section ON featured_articles(section, position);
CREATE INDEX IF NOT EXISTS idx_featured_articles_active ON featured_articles(is_active);

-- RLS Policies
ALTER TABLE featured_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active featured articles"
ON featured_articles FOR SELECT
TO anon, authenticated
USING (is_active = true);

CREATE POLICY "Admins can manage featured articles"
ON featured_articles FOR ALL
TO authenticated
USING (true);

-- Auto-update timestamp trigger
CREATE TRIGGER update_featured_articles_updated_at
BEFORE UPDATE ON featured_articles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DATA: Travel Book Section
-- =====================================================

INSERT INTO featured_articles (section, position, title, subtitle, description, image_url, link_url, category_label) VALUES
('travel', 1, 'Топ-10 локацій України для вашого Travel Book', 'Натхнення', 'Карпати, Буковель, Львів, Одеса, Київ — створіть журнал своїх подорожей з найкрасивішими локаціями України.', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80', '/blog/top-locations-ukraine', 'Натхнення'),
('travel', 2, 'Тревел-бук vs фотоальбом: що обрати?', 'Travel', 'Розбираємо відмінності між класичним фотоальбомом і сучасним тревел-буком у форматі глянцевого журналу.', 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80', '/blog/travelbook-vs-photoalbum', 'Travel')
ON CONFLICT DO NOTHING;

-- =====================================================
-- ADD is_featured COLUMN TO blog_posts
-- =====================================================

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_blog_posts_featured ON blog_posts(is_featured) WHERE is_featured = true;

-- Mark initial featured blog posts
UPDATE blog_posts SET is_featured = true
WHERE slug IN ('iak-stvoryty-fotoknyhu', 'travelbook-vs-photoalbum', 'vesil-ni-podarunky');

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE featured_articles IS 'Featured content cards for homepage sections (Travel Book, etc.)';
COMMENT ON COLUMN featured_articles.section IS 'Section identifier: travel, blog, photobooks, etc.';
COMMENT ON COLUMN featured_articles.position IS 'Display order within section (1, 2, 3...)';
COMMENT ON COLUMN featured_articles.category_label IS 'Small label shown on card (e.g., "Натхнення", "Travel")';
