-- =====================================================
-- UPDATE SITE_CONTENT WITH TOUCH MEMORIES BRANDING
-- Run this in Supabase Dashboard SQL Editor
-- =====================================================

-- Update hero section content
UPDATE site_content SET value = 'Доторкніться до спогадів' WHERE key = 'hero_title';
UPDATE site_content SET value = 'Створено з любов''ю' WHERE key = 'hero_subtitle';

-- Update footer contact information
UPDATE site_content SET value = 'Тернопіль, вул. Київська 2' WHERE key = 'footer_address';
UPDATE site_content SET value = 'touch.memories3@gmail.com' WHERE key = 'footer_email';

-- Insert if not exists (in case keys don't exist yet)
INSERT INTO site_content (key, value) VALUES
('hero_title', 'Доторкніться до спогадів'),
('hero_subtitle', 'Створено з любов''ю'),
('footer_address', 'Тернопіль, вул. Київська 2'),
('footer_email', 'touch.memories3@gmail.com')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();

-- Verify the updates
SELECT key, value FROM site_content WHERE key IN ('hero_title', 'hero_subtitle', 'footer_address', 'footer_email');
