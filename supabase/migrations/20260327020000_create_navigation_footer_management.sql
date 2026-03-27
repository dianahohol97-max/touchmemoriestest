-- =============================================
-- PHASE 5: Navigation & Footer Content Management
-- =============================================

-- Create navigation_links table
CREATE TABLE IF NOT EXISTS navigation_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_text TEXT NOT NULL,
    link_url TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    parent_id UUID REFERENCES navigation_links(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create footer_sections table
CREATE TABLE IF NOT EXISTS footer_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_name TEXT UNIQUE NOT NULL,
    section_title TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create footer_links table
CREATE TABLE IF NOT EXISTS footer_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID REFERENCES footer_sections(id) ON DELETE CASCADE,
    link_text TEXT NOT NULL,
    link_url TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create social_media_links table
CREATE TABLE IF NOT EXISTS social_media_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_name TEXT NOT NULL,
    platform_url TEXT NOT NULL,
    icon_name TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- RLS POLICIES
-- =============================================

-- Public can read active navigation links
CREATE POLICY "Public can view active navigation links" ON navigation_links
    FOR SELECT USING (is_active = true);

-- Authenticated can manage navigation links
CREATE POLICY "Authenticated can manage navigation links" ON navigation_links
    FOR ALL USING (auth.role() = 'authenticated');

-- Public can read active footer sections
CREATE POLICY "Public can view active footer sections" ON footer_sections
    FOR SELECT USING (is_active = true);

-- Authenticated can manage footer sections
CREATE POLICY "Authenticated can manage footer sections" ON footer_sections
    FOR ALL USING (auth.role() = 'authenticated');

-- Public can read active footer links
CREATE POLICY "Public can view active footer links" ON footer_links
    FOR SELECT USING (is_active = true);

-- Authenticated can manage footer links
CREATE POLICY "Authenticated can manage footer links" ON footer_links
    FOR ALL USING (auth.role() = 'authenticated');

-- Public can read active social media links
CREATE POLICY "Public can view active social links" ON social_media_links
    FOR SELECT USING (is_active = true);

-- Authenticated can manage social media links
CREATE POLICY "Authenticated can manage social links" ON social_media_links
    FOR ALL USING (auth.role() = 'authenticated');

-- Enable RLS
ALTER TABLE navigation_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE footer_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE footer_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_media_links ENABLE ROW LEVEL SECURITY;

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_navigation_links_active ON navigation_links(is_active, display_order);
CREATE INDEX idx_navigation_links_parent ON navigation_links(parent_id);
CREATE INDEX idx_footer_sections_active ON footer_sections(is_active, display_order);
CREATE INDEX idx_footer_links_section ON footer_links(section_id, display_order);
CREATE INDEX idx_social_links_active ON social_media_links(is_active, display_order);

-- =============================================
-- TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_navigation_links_updated_at BEFORE UPDATE ON navigation_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_footer_sections_updated_at BEFORE UPDATE ON footer_sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_footer_links_updated_at BEFORE UPDATE ON footer_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_links_updated_at BEFORE UPDATE ON social_media_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- DEFAULT DATA - Navigation Links
-- =============================================

INSERT INTO navigation_links (link_text, link_url, display_order, is_active) VALUES
('Фотокниги', '/catalog?category=photobooks', 1, true),
('Глянцеві журнали', '/catalog?category=hlyantsevi-zhurnaly', 2, true),
('Travelbook', '/catalog?category=travelbooks', 3, true),
('Фотодрук', '/catalog?category=prints', 4, true),
('Сертифікати', '/catalog?category=certificates', 5, true);

-- =============================================
-- DEFAULT DATA - Footer Sections
-- =============================================

INSERT INTO footer_sections (section_name, section_title, display_order, is_active) VALUES
('products', 'Продукти', 1, true),
('help', 'Допомога', 2, true),
('contacts', 'Контакти', 3, true);

-- =============================================
-- DEFAULT DATA - Footer Links
-- =============================================

-- Products section links
INSERT INTO footer_links (section_id, link_text, link_url, display_order, is_active)
SELECT id, 'Фотокниги', '/catalog?category=photobooks', 1, true FROM footer_sections WHERE section_name = 'products'
UNION ALL
SELECT id, 'Глянцеві журнали', '/catalog?category=hlyantsevi-zhurnaly', 2, true FROM footer_sections WHERE section_name = 'products'
UNION ALL
SELECT id, 'Фотодрук', '/catalog?category=prints', 3, true FROM footer_sections WHERE section_name = 'products';

-- Help section links
INSERT INTO footer_links (section_id, link_text, link_url, display_order, is_active)
SELECT id, 'Доставка та оплата', '/shipping-returns', 1, true FROM footer_sections WHERE section_name = 'help'
UNION ALL
SELECT id, 'Питання та відповіді', '/faq', 2, true FROM footer_sections WHERE section_name = 'help'
UNION ALL
SELECT id, 'Конструктор', '/constructor/photobook', 3, true FROM footer_sections WHERE section_name = 'help';

-- Contacts section links
INSERT INTO footer_links (section_id, link_text, link_url, display_order, is_active)
SELECT id, 'touch.memories3@gmail.com', 'mailto:touch.memories3@gmail.com', 1, true FROM footer_sections WHERE section_name = 'contacts'
UNION ALL
SELECT id, 'Тернопіль, вул. Київська 2', 'https://maps.google.com/?q=Тернопіль,+вул.+Київська+2', 2, true FROM footer_sections WHERE section_name = 'contacts'
UNION ALL
SELECT id, 'Telegram: @touchmemories', 'https://t.me/touchmemories', 3, true FROM footer_sections WHERE section_name = 'contacts'
UNION ALL
SELECT id, 'Instagram: @touch.memories', 'https://instagram.com/touch.memories', 4, true FROM footer_sections WHERE section_name = 'contacts'
UNION ALL
SELECT id, 'TikTok: @touch.memories', 'https://tiktok.com/@touch.memories', 5, true FROM footer_sections WHERE section_name = 'contacts';

-- =============================================
-- DEFAULT DATA - Social Media Links
-- =============================================

INSERT INTO social_media_links (platform_name, platform_url, icon_name, display_order, is_active) VALUES
('Telegram', 'https://t.me/touchmemories', 'FaTelegram', 1, true),
('Instagram', 'https://instagram.com/touch.memories', 'FaInstagram', 2, true),
('TikTok', 'https://tiktok.com/@touch.memories', 'FaTiktok', 3, true);

-- =============================================
-- Add footer brand content to section_content
-- =============================================

INSERT INTO section_content (section_name, heading, subheading, body_text, is_active, metadata)
VALUES (
    'footer_brand',
    'Touch.Memories',
    'Зберігаємо ваші найцінніші спогади у преміальних фотокнигах та продуктах з 2018 року.',
    NULL,
    true,
    '{"contact_info": {"address": "Тернопіль, вул. Київська 2", "email": "touch.memories3@gmail.com"}}'::jsonb
)
ON CONFLICT (section_name)
DO UPDATE SET
    heading = EXCLUDED.heading,
    subheading = EXCLUDED.subheading,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();
