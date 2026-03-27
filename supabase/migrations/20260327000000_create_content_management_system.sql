-- =====================================================
-- CONTENT MANAGEMENT SYSTEM
-- Creates tables for managing all site content from admin panel
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
('Збережіть найкращі моменти', 'Зберігайте найкращі', 'моменти назавжди', 'Фотокниги, тревел-буки, журнали та інша поліграфія ручної роботи з Тернополя');

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
('Журнал з твердою обкладинкою', '/catalog?category=magazines', 3, 2),
('Тревелбук', '/catalog?category=travelbooks', 4, 2),
('Фотодрук', '/catalog?category=prints', 5, 3),
('Фотомагніти', '/catalog?category=photomagnets', 6, 3);

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
('Понад 20 000 задоволених клієнтів', 'Нам довіряють свої найдорожчі спогади', 4);

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
    display_location TEXT DEFAULT 'homepage', -- homepage, catalog, checkout
    display_order INT DEFAULT 0,
    background_color TEXT DEFAULT '#f3f4f6',
    text_color TEXT DEFAULT '#1f2937',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Section Content (for any text-based sections)
CREATE TABLE IF NOT EXISTS section_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_name TEXT UNIQUE NOT NULL, -- e.g., 'travel_book_promo', 'gift_ideas_heading'
    heading TEXT,
    subheading TEXT,
    body_text TEXT,
    cta_text TEXT,
    cta_url TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB, -- For any additional section-specific data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default section content
INSERT INTO section_content (section_name, heading, subheading, body_text, cta_text, cta_url) VALUES
('gift_ideas', 'Ідеї подарунків', 'Знайдіть ідеальний подарунок для ваших близьких', NULL, 'Переглянути всі', '/catalog'),
('custom_book_promo', 'Створіть унікальну книгу', 'Індивідуальний дизайн від наших фахівців', 'Замовте фотокнигу з персональним макетом', 'Замовити з дизайнером', '/order'),
('photo_print_promo', 'Друк фотографій', 'Професійний фотодрук високої якості', 'Роздрукуйте ваші спогади на преміум фотопапері', 'Замовити друк', '/catalog?category=prints');

-- 6. Homepage Section Order (already exists via site_blocks, but adding reference)
COMMENT ON TABLE site_blocks IS 'Manages homepage section visibility and order';

-- 7. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_hero_buttons_active_order ON hero_buttons(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_why_choose_us_active_order ON why_choose_us_cards(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_promo_banners_active_dates ON promotional_banners(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_section_content_name ON section_content(section_name);

-- 8. Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hero_content_updated_at BEFORE UPDATE ON hero_content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hero_buttons_updated_at BEFORE UPDATE ON hero_buttons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_why_choose_us_cards_updated_at BEFORE UPDATE ON why_choose_us_cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promotional_banners_updated_at BEFORE UPDATE ON promotional_banners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_section_content_updated_at BEFORE UPDATE ON section_content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. RLS Policies (read-only for public, full access for authenticated admins)
ALTER TABLE hero_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_buttons ENABLE ROW LEVEL SECURITY;
ALTER TABLE why_choose_us_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotional_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_content ENABLE ROW LEVEL SECURITY;

-- Public can read active content
CREATE POLICY "Public can view active hero content" ON hero_content FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view active hero buttons" ON hero_buttons FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view active feature cards" ON why_choose_us_cards FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view active banners" ON promotional_banners FOR SELECT
    USING (
        is_active = true
        AND (start_date IS NULL OR start_date <= NOW())
        AND (end_date IS NULL OR end_date >= NOW())
    );
CREATE POLICY "Public can view active section content" ON section_content FOR SELECT USING (is_active = true);

-- Authenticated users (admins) can do everything
CREATE POLICY "Authenticated can manage hero content" ON hero_content FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can manage hero buttons" ON hero_buttons FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can manage feature cards" ON why_choose_us_cards FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can manage banners" ON promotional_banners FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can manage section content" ON section_content FOR ALL USING (auth.role() = 'authenticated');

-- 10. Comments for documentation
COMMENT ON TABLE hero_content IS 'Stores hero section text content editable from admin panel';
COMMENT ON TABLE hero_buttons IS 'Category/product buttons displayed in hero section';
COMMENT ON TABLE why_choose_us_cards IS 'Feature cards for "Why Choose Us" section';
COMMENT ON TABLE promotional_banners IS 'Time-based promotional banners for various site locations';
COMMENT ON TABLE section_content IS 'Generic content for any text-based sections across the site';
