-- =============================================
-- Seed Homepage Content (Fix Empty Data Issues)
-- =============================================

-- =============================================
-- 1. HERO BUTTONS
-- =============================================

INSERT INTO hero_buttons (text, url, variant, sort_order, is_active) VALUES
('Фотокниги та журнали', '/order/book?product=photobook-velour', 'primary', 1, true),
('Персоналізовані постери', '/catalog?category=posters', 'secondary', 2, true)
ON CONFLICT DO NOTHING;

-- =============================================
-- 2. SITE CONTENT (Hero Text)
-- =============================================

INSERT INTO site_content (key, value) VALUES
('hero_title', 'Твої спогади варті більшого'),
('hero_subtitle', 'Створюй персоналізовані фотокниги, постери та подарунки, які залишаються назавжди'),
('hero_cta_primary', 'Почати створювати'),
('hero_cta_secondary', 'Переглянути каталог')
ON CONFLICT (key) DO UPDATE SET
value = EXCLUDED.value;

-- =============================================
-- 3. SECTION CONTENT (Popular Products & Constructor Selection)
-- =============================================

-- Popular Products Section
INSERT INTO section_content (section_name, heading, subheading, cta_text, cta_url, is_active, metadata) VALUES
('popular_products', 'Популярні продукти', 'Найкращі рішення для збереження спогадів', 'Переглянути всі', '/catalog', true,
'{}'::jsonb)
ON CONFLICT (section_name) DO UPDATE SET
heading = EXCLUDED.heading,
subheading = EXCLUDED.subheading,
cta_text = EXCLUDED.cta_text,
cta_url = EXCLUDED.cta_url,
is_active = EXCLUDED.is_active;

-- Constructor Selection Section
INSERT INTO section_content (section_name, heading, subheading, is_active, metadata) VALUES
('constructor_selection', 'Оберіть свій формат', 'Фотокниги та журнали для кожної події', true,
'{
  "photobooks": {
    "heading": "Фотокниги",
    "description": "Зберіть найкращі моменти у красиву фотокнигу — подарунок, який залишиться на все життя. Обирайте формат, обкладинку та кількість сторінок під свій стиль. Ідеально для весіль, подорожей, сімейних архівів та особливих дат.",
    "constructor_url": "/order/book?product=photobook-velour",
    "constructor_button_text": "Відкрити конструктор",
    "designer_button_text": "Оформити з дизайнером"
  },
  "magazines": {
    "heading": "Глянцеві журнали",
    "description": "Створіть глянцевий журнал зі своїми фото — стильний і сучасний формат для збереження спогадів. Ідеально для модних зйомок, тематичних подій, подорожей та корпоративних проєктів.",
    "constructor_url": "/order/book?product=magazine",
    "constructor_button_text": "Відкрити конструктор",
    "designer_button_text": "Оформити з дизайнером"
  }
}'::jsonb)
ON CONFLICT (section_name) DO UPDATE SET
heading = EXCLUDED.heading,
subheading = EXCLUDED.subheading,
metadata = EXCLUDED.metadata,
is_active = EXCLUDED.is_active;

-- =============================================
-- 4. MARK EXISTING PRODUCTS AS POPULAR
-- =============================================

-- Update existing products to be popular if they match these slugs
UPDATE products
SET is_popular = true, popular_order =
CASE slug
    WHEN 'photobook-velour' THEN 1
    WHEN 'magazine' THEN 2
    WHEN 'travelbook' THEN 3
    WHEN 'photo-prints' THEN 4
    WHEN 'photo-magnets' THEN 5
    WHEN 'star-map-poster' THEN 6
    WHEN 'city-map-poster' THEN 7
    WHEN 'calendar-wall' THEN 8
    ELSE 99
END
WHERE slug IN ('photobook-velour', 'magazine', 'travelbook', 'photo-prints', 'photo-magnets', 'star-map-poster', 'city-map-poster', 'calendar-wall');

-- =============================================
-- 5. FEATURED ARTICLES (Travel Section)
-- =============================================

-- Create featured_articles table if it doesn't exist
CREATE TABLE IF NOT EXISTS featured_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    link_url TEXT,
    category_label TEXT,
    position INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on section and position
CREATE INDEX IF NOT EXISTS idx_featured_articles_section_position
ON featured_articles(section, position) WHERE is_active = true;

-- Insert featured travel articles
INSERT INTO featured_articles (section, title, description, image_url, link_url, category_label, position, is_active) VALUES
('travel', 'Як створити ідеальний Travel Book',
 'Поради від професіоналів: як зібрати найкращі моменти подорожі в один альбом',
 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
 '/blog/how-to-create-perfect-travel-book',
 'Поради', 1, true),

('travel', '10 ідей для оформлення Travel Book',
 'Натхнення та практичні поради для створення унікального дизайну вашого альбому',
 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80',
 '/blog/travel-book-design-ideas',
 'Натхнення', 2, true)
ON CONFLICT DO NOTHING;

-- =============================================
-- Comments
-- =============================================

COMMENT ON TABLE hero_buttons IS 'Hero section CTA buttons with text, URLs, and variants';
COMMENT ON TABLE site_content IS 'Key-value store for site-wide content like hero text';
COMMENT ON TABLE section_content IS 'Content for homepage sections with structured metadata';
COMMENT ON TABLE featured_articles IS 'Featured articles/posts for specific homepage sections';
