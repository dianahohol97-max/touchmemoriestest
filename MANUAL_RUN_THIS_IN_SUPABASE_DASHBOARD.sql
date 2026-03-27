-- =====================================================
-- TOUCH MEMORIES - DATABASE FIX
-- Run this ENTIRE file in Supabase Dashboard → SQL Editor
-- =====================================================
-- This creates all missing tables and seeds initial data
-- for hero section, navigation, footer, and content management
-- =====================================================

-- =====================================================
-- PART 1: Content Management Tables
-- =====================================================

-- 1. Hero Section Content
CREATE TABLE IF NOT EXISTS hero_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    overline_text TEXT DEFAULT 'Збережіть найкращі моменти',
    title_line1 TEXT DEFAULT 'Зберігайте найкращі',
    title_line2 TEXT DEFAULT 'моменти назавжди',
    subtitle TEXT DEFAULT 'Фотокниги, тревел-буки, журнали та інша поліграфія ручної роботи з Тернополя',
    background_image_url TEXT DEFAULT 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=1200',
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default hero content
INSERT INTO hero_content (overline_text, title_line1, title_line2, subtitle) VALUES
('Доторкніться до спогадів', 'Зберігайте найкращі', 'моменти назавжди', 'Створено з любов''ю')
ON CONFLICT DO NOTHING;

-- 2. Hero Category Buttons
CREATE TABLE IF NOT EXISTS hero_buttons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    button_text TEXT NOT NULL,
    button_url TEXT NOT NULL,
    display_order INT NOT NULL,
    row_number INT DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default hero buttons
INSERT INTO hero_buttons (button_text, button_url, display_order, row_number) VALUES
('Фотокнига', '/catalog?category=photobooks', 1, 1),
('Глянцевий журнал', '/catalog?category=magazines', 2, 1),
('Журнал з твердою обкладинкою', '/catalog?category=photojournal', 3, 2),
('Тревелбук', '/catalog?category=travelbooks', 4, 2),
('Фотодрук', '/catalog?category=prints', 5, 3),
('Фотомагніти', '/catalog?category=photomagnets', 6, 3)
ON CONFLICT DO NOTHING;

-- 3. "Чому варто обрати нас" Feature Cards
CREATE TABLE IF NOT EXISTS why_choose_us_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon_name TEXT,
    display_order INT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default feature cards
INSERT INTO why_choose_us_cards (title, description, display_order) VALUES
('Преміум якість друку', 'Fujicolor Crystal Archive, термін зберігання 100+ років', 1),
('Персональний дизайн', 'Безкоштовний макет у подарунок, необмежені правки', 2),
('Доступні ціни', 'Якісний друк за чесною ціною', 3),
('Понад 20 000 задоволених клієнтів', 'Нам довіряють свої найдорожчі спогади', 4)
ON CONFLICT DO NOTHING;

-- 4. Promotional Banners
CREATE TABLE IF NOT EXISTS promotional_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    link_url TEXT,
    link_text TEXT DEFAULT 'Дізнатися більше',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    display_location TEXT DEFAULT 'homepage',
    display_order INT DEFAULT 0,
    background_color TEXT DEFAULT '#f3f4f6',
    text_color TEXT DEFAULT '#1f2937',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Section Content (for any text-based sections)
CREATE TABLE IF NOT EXISTS section_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_name TEXT UNIQUE NOT NULL,
    heading TEXT,
    subheading TEXT,
    body_text TEXT,
    cta_text TEXT,
    cta_url TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 2: Navigation & Footer Tables
-- =====================================================

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

-- =====================================================
-- PART 3: RLS Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE hero_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_buttons ENABLE ROW LEVEL SECURITY;
ALTER TABLE why_choose_us_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotional_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE navigation_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE footer_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE footer_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_media_links ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY IF NOT EXISTS "Public can view active hero content" ON hero_content FOR SELECT USING (is_active = true);
CREATE POLICY IF NOT EXISTS "Public can view active hero buttons" ON hero_buttons FOR SELECT USING (is_active = true);
CREATE POLICY IF NOT EXISTS "Public can view active feature cards" ON why_choose_us_cards FOR SELECT USING (is_active = true);
CREATE POLICY IF NOT EXISTS "Public can view active banners" ON promotional_banners FOR SELECT
    USING (is_active = true AND (start_date IS NULL OR start_date <= NOW()) AND (end_date IS NULL OR end_date >= NOW()));
CREATE POLICY IF NOT EXISTS "Public can view active section content" ON section_content FOR SELECT USING (is_active = true);
CREATE POLICY IF NOT EXISTS "Public can view active navigation links" ON navigation_links FOR SELECT USING (is_active = true);
CREATE POLICY IF NOT EXISTS "Public can view active footer sections" ON footer_sections FOR SELECT USING (is_active = true);
CREATE POLICY IF NOT EXISTS "Public can view active footer links" ON footer_links FOR SELECT USING (is_active = true);
CREATE POLICY IF NOT EXISTS "Public can view active social links" ON social_media_links FOR SELECT USING (is_active = true);

-- Admin write policies
CREATE POLICY IF NOT EXISTS "Authenticated can manage hero content" ON hero_content FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "Authenticated can manage hero buttons" ON hero_buttons FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "Authenticated can manage feature cards" ON why_choose_us_cards FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "Authenticated can manage banners" ON promotional_banners FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "Authenticated can manage section content" ON section_content FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "Authenticated can manage navigation links" ON navigation_links FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "Authenticated can manage footer sections" ON footer_sections FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "Authenticated can manage footer links" ON footer_links FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "Authenticated can manage social links" ON social_media_links FOR ALL USING (auth.role() = 'authenticated');

-- =====================================================
-- PART 4: Indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_hero_buttons_active_order ON hero_buttons(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_why_choose_us_active_order ON why_choose_us_cards(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_promo_banners_active_dates ON promotional_banners(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_section_content_name ON section_content(section_name);
CREATE INDEX IF NOT EXISTS idx_navigation_links_active ON navigation_links(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_navigation_links_parent ON navigation_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_footer_sections_active ON footer_sections(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_footer_links_section ON footer_links(section_id, display_order);
CREATE INDEX IF NOT EXISTS idx_social_links_active ON social_media_links(is_active, display_order);

-- =====================================================
-- PART 5: Triggers
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS update_hero_content_updated_at BEFORE UPDATE ON hero_content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER IF NOT EXISTS update_hero_buttons_updated_at BEFORE UPDATE ON hero_buttons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER IF NOT EXISTS update_why_choose_us_cards_updated_at BEFORE UPDATE ON why_choose_us_cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER IF NOT EXISTS update_promotional_banners_updated_at BEFORE UPDATE ON promotional_banners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER IF NOT EXISTS update_section_content_updated_at BEFORE UPDATE ON section_content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER IF NOT EXISTS update_navigation_links_updated_at BEFORE UPDATE ON navigation_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER IF NOT EXISTS update_footer_sections_updated_at BEFORE UPDATE ON footer_sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER IF NOT EXISTS update_footer_links_updated_at BEFORE UPDATE ON footer_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER IF NOT EXISTS update_social_links_updated_at BEFORE UPDATE ON social_media_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PART 6: Seed Section Content
-- =====================================================

INSERT INTO section_content (section_name, heading, subheading, body_text, cta_text, cta_url, metadata) VALUES
('gift_ideas_main',
 'Не знаєш що обрати на подарунок?',
 'Пройди швидкий тест і отримай персональні рекомендації',
 NULL,
 'Пройти тест',
 '/gift-quiz',
 '{"quiz_enabled": true}'::jsonb),

('photo_print_promo',
 'Швидкий друк фото',
 NULL,
 'Професійний фотодрук високої якості на преміум фотопапері',
 'Замовити друк фото',
 '/catalog?category=prints',
 '{"steps": [
   {"number": "1", "title": "Оберіть формат", "description": "Стандартний, нестандартний, Polaroid — вибери розмір, який підходить вам."},
   {"number": "2", "title": "Завантажте фото", "description": "Надішли нам фотографії у зручний спосіб — через Telegram, Instagram або на email."},
   {"number": "3", "title": "Оформіть замовлення", "description": "Ми підтвердимо деталі та надішлемо готові фото у зазначені терміни."}
 ]}'::jsonb),

('custom_book_promo',
 'Фотокниги, журнали та фотовироби з душею',
 'Touch.Memories — студія у Тернополі, яка перетворює ваші фотографії на красиві фізичні вироби',
 'Фотокниги, глянцеві журнали, тревел-буки, фотодрук та сувеніри — все з преміум якістю та турботою до деталей.',
 'В магазин',
 '/catalog',
 NULL),

('constructor_selection',
 'Створюй свою історію',
 'Обери формат і розпочни роботу',
 NULL,
 NULL,
 NULL,
 '{"categories": [
   {"label": "Фотокниги", "description": "Збережіть найкращі моменти у преміум фотокнизі", "cta_text": "Відкрити конструктор", "cta_url": "/editor/new?product=photobook"},
   {"label": "Глянцеві журнали", "description": "Елегантний формат для ваших спогадів", "cta_text": "Відкрити конструктор", "cta_url": "/editor/new?product=magazine"},
   {"label": "Travel Book", "description": "Подорожній щоденник у форматі А4", "cta_text": "Створити TravelBook", "cta_url": "/order/book?productSlug=travelbook"}
 ]}'::jsonb),

('photobooth_promo',
 'Фотобудка на ваше свято',
 'Оренда професійної фотобудки з миттєвим друком',
 'Створюйте незабутні спогади разом з вашими гостями. Миттєвий друк фотографій, стильний дизайн, необмежена кількість знімків.',
 'Дізнатися більше',
 '/services/photobooth',
 '{"features": ["Миттєвий друк", "Необмежена кількість фото", "Стильний дизайн", "Доставка та встановлення"]}'::jsonb),

('popular_products',
 'Найпопулярніші товари',
 'Обирайте серед найкращих наших продуктів',
 NULL,
 'Переглянути всі',
 '/catalog',
 NULL),

('footer_brand',
    'Touch.Memories',
    'Зберігаємо ваші найцінніші спогади у преміальних фотокнигах та продуктах з 2018 року.',
    NULL,
    true,
    '{"contact_info": {"address": "Тернопіль, вул. Київська 2", "email": "touch.memories3@gmail.com"}}'::jsonb)

ON CONFLICT (section_name) DO UPDATE SET
    heading = EXCLUDED.heading,
    subheading = EXCLUDED.subheading,
    body_text = EXCLUDED.body_text,
    cta_text = EXCLUDED.cta_text,
    cta_url = EXCLUDED.cta_url,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- =====================================================
-- PART 7: Seed Navigation Links
-- =====================================================

INSERT INTO navigation_links (link_text, link_url, display_order, is_active) VALUES
('Фотокниги', '/catalog?category=photobooks', 1, true),
('Глянцеві журнали', '/catalog?category=hlyantsevi-zhurnaly', 2, true),
('Travelbook', '/catalog?category=travelbooks', 3, true),
('Фотодрук', '/catalog?category=prints', 4, true),
('Сертифікати', '/catalog?category=certificates', 5, true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- PART 8: Seed Footer Data
-- =====================================================

INSERT INTO footer_sections (section_name, section_title, display_order, is_active) VALUES
('products', 'Продукти', 1, true),
('help', 'Допомога', 2, true),
('contacts', 'Контакти', 3, true)
ON CONFLICT (section_name) DO NOTHING;

-- Products section links
INSERT INTO footer_links (section_id, link_text, link_url, display_order, is_active)
SELECT id, 'Фотокниги', '/catalog?category=photobooks', 1, true FROM footer_sections WHERE section_name = 'products'
UNION ALL
SELECT id, 'Глянцеві журнали', '/catalog?category=hlyantsevi-zhurnaly', 2, true FROM footer_sections WHERE section_name = 'products'
UNION ALL
SELECT id, 'Фотодрук', '/catalog?category=prints', 3, true FROM footer_sections WHERE section_name = 'products'
ON CONFLICT DO NOTHING;

-- Help section links
INSERT INTO footer_links (section_id, link_text, link_url, display_order, is_active)
SELECT id, 'Доставка та оплата', '/shipping-returns', 1, true FROM footer_sections WHERE section_name = 'help'
UNION ALL
SELECT id, 'Питання та відповіді', '/faq', 2, true FROM footer_sections WHERE section_name = 'help'
UNION ALL
SELECT id, 'Конструктор', '/constructor/photobook', 3, true FROM footer_sections WHERE section_name = 'help'
ON CONFLICT DO NOTHING;

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
SELECT id, 'TikTok: @touch.memories', 'https://tiktok.com/@touch.memories', 5, true FROM footer_sections WHERE section_name = 'contacts'
ON CONFLICT DO NOTHING;

-- =====================================================
-- PART 9: Seed Social Media Links
-- =====================================================

INSERT INTO social_media_links (platform_name, platform_url, icon_name, display_order, is_active) VALUES
('Telegram', 'https://t.me/touchmemories', 'FaTelegram', 1, true),
('Instagram', 'https://instagram.com/touch.memories', 'FaInstagram', 2, true),
('TikTok', 'https://tiktok.com/@touch.memories', 'FaTiktok', 3, true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- ✅ DONE! All tables created and seeded with data.
-- =====================================================
