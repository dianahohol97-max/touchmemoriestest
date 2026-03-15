-- Enable UUID extension if not fully loaded
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. theme_settings
-- ==========================================
CREATE TABLE IF NOT EXISTS public.theme_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    color_primary TEXT DEFAULT '#263A99',
    color_secondary TEXT DEFAULT '#f1f5f9',
    color_accent TEXT DEFAULT '#263A99',
    color_background TEXT DEFAULT '#ffffff',
    color_text TEXT DEFAULT '#263A99',
    font_family_heading TEXT DEFAULT 'Inter',
    font_family_body TEXT DEFAULT 'Inter',
    font_size_h1 INTEGER DEFAULT 48,
    font_size_h2 INTEGER DEFAULT 32,
    font_size_body INTEGER DEFAULT 16,
    border_radius INTEGER DEFAULT 8,
    spacing_unit INTEGER DEFAULT 8,
    button_border_radius INTEGER DEFAULT 8,
    button_text_primary TEXT DEFAULT '#ffffff',
    button_text_secondary TEXT DEFAULT '#263A99',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Note: We only expect 1 row in this table.
INSERT INTO public.theme_settings (
    color_primary, color_secondary, color_accent, color_background, color_text
) VALUES (
    '#263A99', '#f1f5f9', '#263A99', '#ffffff', '#263A99'
) ON CONFLICT DO NOTHING; -- Assuming we didn't add a strict constraint for a single row yet, we just initialize one.


-- ==========================================
-- 2. theme_presets
-- ==========================================
CREATE TABLE IF NOT EXISTS public.theme_presets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    settings JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert requested presets
INSERT INTO public.theme_presets (name, settings)
VALUES
  ('minimal', '{"color_primary": "#000000", "color_secondary": "#f4f4f5", "color_accent": "#71717a", "color_background": "#ffffff", "color_text": "#27272a", "font_family_heading": "Inter", "font_family_body": "Inter", "border_radius": 0, "button_border_radius": 0, "button_text_primary": "#ffffff", "button_text_secondary": "#000000"}'),
  ('elegant', '{"color_primary": "#333333", "color_secondary": "#fdfbf7", "color_accent": "#c6a87c", "color_background": "#ffffff", "color_text": "#4a4a4a", "font_family_heading": "Playfair Display", "font_family_body": "Lato", "border_radius": 4, "button_border_radius": 24, "button_text_primary": "#ffffff", "button_text_secondary": "#333333"}'),
  ('bold', '{"color_primary": "#e11d48", "color_secondary": "#ffe4e6", "color_accent": "#f43f5e", "color_background": "#263A99", "color_text": "#f8fafc", "font_family_heading": "Montserrat", "font_family_body": "Roboto", "border_radius": 12, "button_border_radius": 8, "button_text_primary": "#ffffff", "button_text_secondary": "#e11d48"}'),
  ('warm', '{"color_primary": "#b45309", "color_secondary": "#fef3c7", "color_accent": "#d97706", "color_background": "#fffbeb", "color_text": "#78350f", "font_family_heading": "Lora", "font_family_body": "Inter", "border_radius": 8, "button_border_radius": 16, "button_text_primary": "#ffffff", "button_text_secondary": "#b45309"}'),
  ('corporate', '{"color_primary": "#263A99", "color_secondary": "#e0f2fe", "color_accent": "#0ea5e9", "color_background": "#ffffff", "color_text": "#263A99", "font_family_heading": "Roboto", "font_family_body": "Roboto", "border_radius": 4, "button_border_radius": 4, "button_text_primary": "#ffffff", "button_text_secondary": "#263A99"}')
ON CONFLICT (name) DO NOTHING;


-- ==========================================
-- 3. site_blocks
-- ==========================================
CREATE TABLE IF NOT EXISTS public.site_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_name TEXT UNIQUE NOT NULL,
    is_visible BOOLEAN DEFAULT true,
    position_order INTEGER NOT NULL,
    image_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed defaults to match standard homepage layout
INSERT INTO public.site_blocks (block_name, position_order)
VALUES 
  ('hero', 10),
  ('categories', 20),
  ('featured_products', 30),
  ('how_it_works', 40),
  ('reviews', 50),
  ('blog_latest', 60),
  ('newsletter', 70)
ON CONFLICT (block_name) DO NOTHING;


-- ==========================================
-- 4. site_content
-- ==========================================
CREATE TABLE IF NOT EXISTS public.site_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed standard structural bindings
INSERT INTO public.site_content (key, value)
VALUES
    ('hero_title', 'Зберігайте найцінніші моменти у преміальних фотокнигах'),
    ('hero_subtitle', 'Створіть свою унікальну фотокнигу всього за кілька кліків.'),
    ('hero_button_text', 'Створити фотокнигу'),
    ('hero_button_url', '/catalog')
ON CONFLICT (key) DO NOTHING;


-- ==========================================
-- 5. role_pricing
-- ==========================================
CREATE TABLE IF NOT EXISTS public.role_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('default', 'photographer', 'corporate')),
    price NUMERIC(10,2),
    discount_percent INTEGER CHECK (discount_percent >= 0 AND discount_percent <= 100),
    is_visible BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(product_id, role) -- a product can only have one configuration per role
);

-- Note: We do not seed this manually, it is managed dynamically by Admins.


-- ==========================================
-- Row Level Security (RLS) & Triggers
-- ==========================================
ALTER TABLE public.theme_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_pricing ENABLE ROW LEVEL SECURITY;

-- 1. Read Policies (Open to public layout fetching)
CREATE POLICY "Enable read access for all users on theme_settings" ON public.theme_settings FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users on theme_presets" ON public.theme_presets FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users on site_blocks" ON public.site_blocks FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users on site_content" ON public.site_content FOR SELECT USING (true);

-- 2. role_pricing complex read rules
CREATE POLICY "Enable read access to default pricing" ON public.role_pricing FOR SELECT USING (role = 'default');
-- Note: Further RLS bound to auth().uid() mapped over profiles table can be written to expose 'photographer' and 'corporate' blocks securely to only those matching users.

-- 3. Write Policies (Admins only, simplified: requires service role key for MCP or logged auth role check)
-- Assuming the MCP server utilizes the SUPABASE_SERVICE_ROLE_KEY, it entirely circumvents RLS natively, meaning it can UPDATE/INSERT/DELETE freely.
-- Application Admins are generally verified in NextJS middleware, but if mutating from client, RLS can be bound to auth profiles.
-- For safety we will allow ALL operations to authenticated 'admin' users if they exist, but normally MCP handles edits.
CREATE POLICY "Enable full access for authenticated users (restrict in app logic)" ON public.theme_settings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable full access for authenticated users (restrict in app logic)" ON public.theme_presets FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable full access for authenticated users (restrict in app logic)" ON public.site_blocks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable full access for authenticated users (restrict in app logic)" ON public.site_content FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable full access for authenticated users (restrict in app logic)" ON public.role_pricing FOR ALL USING (auth.role() = 'authenticated');

-- ==========================================
-- Triggers function for 'updated_at' 
-- ==========================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_theme_settings_updated_at BEFORE UPDATE ON public.theme_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trigger_site_blocks_updated_at BEFORE UPDATE ON public.site_blocks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trigger_site_content_updated_at BEFORE UPDATE ON public.site_content FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trigger_role_pricing_updated_at BEFORE UPDATE ON public.role_pricing FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable Realtime for the dynamic frontend
alter publication supabase_realtime add table public.theme_settings;
alter publication supabase_realtime add table public.site_blocks;
alter publication supabase_realtime add table public.site_content;
