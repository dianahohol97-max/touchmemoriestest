-- =============================================
-- Travel Book City Covers Management
-- =============================================

-- Create table for travel book city cover illustrations
CREATE TABLE IF NOT EXISTS travel_book_covers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- City identification
    city_name TEXT NOT NULL,           -- Ukrainian name (e.g., "Київ")
    city_name_en TEXT NOT NULL,        -- English name (e.g., "Kyiv")
    country TEXT NOT NULL,             -- Country name (e.g., "Ukraine")

    -- Image storage
    image_url TEXT NOT NULL,           -- Supabase Storage path
    thumbnail_url TEXT,                -- Optional smaller preview

    -- Categorization
    group_type TEXT NOT NULL CHECK (group_type IN ('ukrainian', 'international')),
    sort_order INTEGER NOT NULL,      -- Display order (1-14 Ukrainian, 15+ international)

    -- Design metadata
    landmark TEXT NOT NULL,            -- What landmark is featured (e.g., "Софійський собор")
    background_color TEXT NOT NULL,    -- Hex color code (e.g., "#FFD700")
    color_palette TEXT[],              -- Array of colors used

    -- Generation tracking
    generation_status TEXT DEFAULT 'pending' CHECK (generation_status IN ('pending', 'generated', 'approved', 'flagged', 'failed')),
    generation_attempts INTEGER DEFAULT 0,
    flagged_reason TEXT,               -- Why was it flagged (gradients, illegible, wrong landmark)
    nano_banana_prompt TEXT,           -- Actual prompt used for generation

    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_travel_book_covers_group ON travel_book_covers(group_type);
CREATE INDEX IF NOT EXISTS idx_travel_book_covers_sort ON travel_book_covers(sort_order);
CREATE INDEX IF NOT EXISTS idx_travel_book_covers_status ON travel_book_covers(generation_status);
CREATE INDEX IF NOT EXISTS idx_travel_book_covers_active ON travel_book_covers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_travel_book_covers_city_name ON travel_book_covers(city_name);
CREATE INDEX IF NOT EXISTS idx_travel_book_covers_city_name_en ON travel_book_covers(city_name_en);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_travel_book_covers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER travel_book_covers_updated_at
    BEFORE UPDATE ON travel_book_covers
    FOR EACH ROW
    EXECUTE FUNCTION update_travel_book_covers_updated_at();

-- RLS Policies
ALTER TABLE travel_book_covers ENABLE ROW LEVEL SECURITY;

-- Public can view active approved covers
CREATE POLICY "Public can view active approved covers"
    ON travel_book_covers
    FOR SELECT
    USING (is_active = true AND generation_status = 'approved');

-- Authenticated users (admins) can manage all covers
CREATE POLICY "Admins can manage all covers"
    ON travel_book_covers
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- =============================================
-- Seed Data - All 55 Cities (pending generation)
-- =============================================

INSERT INTO travel_book_covers (
    city_name, city_name_en, country, landmark, background_color,
    group_type, sort_order, image_url, generation_status, nano_banana_prompt
) VALUES
-- UKRAINIAN CITIES (1-14)
('Київ', 'Kyiv', 'Ukraine', 'Софійський собор', '#FFD700', 'ukrainian', 1, 'travel-covers/pending/kyiv.png', 'pending',
'Flat vector illustration of Kyiv, Ukraine featuring Софійський собор (Saint Sophia Cathedral).
Clean geometric shapes, bold saturated colors, minimal detail.
City name "КИЇВ" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #FFD700 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Львів', 'Lviv', 'Ukraine', 'Ратуша', '#F5E6D3', 'ukrainian', 2, 'travel-covers/pending/lviv.png', 'pending',
'Flat vector illustration of Lviv, Ukraine featuring City Hall (Ратуша).
Clean geometric shapes, bold saturated colors, minimal detail.
City name "ЛЬВІВ" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #F5E6D3 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Одеса', 'Odesa', 'Ukraine', 'Потьомкінські сходи', '#4A90E2', 'ukrainian', 3, 'travel-covers/pending/odesa.png', 'pending',
'Flat vector illustration of Odesa, Ukraine featuring Potemkin Stairs.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "ОДЕСА" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #4A90E2 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Чернівці', 'Chernivtsi', 'Ukraine', 'Резиденція Буковинських митрополитів', '#D2691E', 'ukrainian', 4, 'travel-covers/pending/chernivtsi.png', 'pending',
'Flat vector illustration of Chernivtsi, Ukraine featuring Chernivtsi University (Residence of Bukovinian Metropolitans).
Clean geometric shapes, bold saturated colors, minimal detail.
City name "ЧЕРНІВЦІ" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #D2691E color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Ужгород', 'Uzhhorod', 'Ukraine', 'Замок Ужгород', '#90C695', 'ukrainian', 5, 'travel-covers/pending/uzhhorod.png', 'pending',
'Flat vector illustration of Uzhhorod, Ukraine featuring Uzhhorod Castle.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "УЖГОРОД" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #90C695 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Харків', 'Kharkiv', 'Ukraine', 'Дзеркальний струмінь', '#5DADE2', 'ukrainian', 6, 'travel-covers/pending/kharkiv.png', 'pending',
'Flat vector illustration of Kharkiv, Ukraine featuring Mirror Stream fountain.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "ХАРКІВ" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #5DADE2 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Дніпро', 'Dnipro', 'Ukraine', 'Міст через Дніпро', '#17A589', 'ukrainian', 7, 'travel-covers/pending/dnipro.png', 'pending',
'Flat vector illustration of Dnipro, Ukraine featuring Dnipro River bridge.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "ДНІПРО" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #17A589 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Запоріжжя', 'Zaporizhzhia', 'Ukraine', 'Козак на коні', '#DAA520', 'ukrainian', 8, 'travel-covers/pending/zaporizhzhia.png', 'pending',
'Flat vector illustration of Zaporizhzhia, Ukraine featuring Cossack on horse silhouette.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "ЗАПОРІЖЖЯ" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #DAA520 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Полтава', 'Poltava', 'Ukraine', 'Колона Слави', '#A8D5A3', 'ukrainian', 9, 'travel-covers/pending/poltava.png', 'pending',
'Flat vector illustration of Poltava, Ukraine featuring Column of Glory monument.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "ПОЛТАВА" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #A8D5A3 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Івано-Франківськ', 'Ivano-Frankivsk', 'Ukraine', 'Ратуша', '#E8DCC4', 'ukrainian', 10, 'travel-covers/pending/ivano-frankivsk.png', 'pending',
'Flat vector illustration of Ivano-Frankivsk, Ukraine featuring City Hall tower.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "ІВАНО-ФРАНКІВСЬК" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #E8DCC4 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Кам''янець-Подільський', 'Kamianets-Podilskyi', 'Ukraine', 'Стара фортеця', '#F4A460', 'ukrainian', 11, 'travel-covers/pending/kamianets-podilskyi.png', 'pending',
'Flat vector illustration of Kamianets-Podilskyi, Ukraine featuring medieval fortress.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "КАМ''ЯНЕЦЬ-ПОДІЛЬСЬКИЙ" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #F4A460 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Хортиця', 'Khortytsia', 'Ukraine', 'Запорізький дуб', '#C9A961', 'ukrainian', 12, 'travel-covers/pending/khortytsia.png', 'pending',
'Flat vector illustration of Khortytsia Island, Ukraine featuring Zaporizhian Oak tree silhouette.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "ХОРТИЦЯ" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #C9A961 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Трускавець', 'Truskavets', 'Ukraine', 'Бювет Нафтусі', '#A8E6CF', 'ukrainian', 13, 'travel-covers/pending/truskavets.png', 'pending',
'Flat vector illustration of Truskavets, Ukraine featuring Naftusia mineral water pump room.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "ТРУСКАВЕЦЬ" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #A8E6CF color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Буковель', 'Bukovel', 'Ukraine', 'Гірськолижний підйомник', '#B3D9FF', 'ukrainian', 14, 'travel-covers/pending/bukovel.png', 'pending',
'Flat vector illustration of Bukovel, Ukraine featuring ski lift and mountain silhouette.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "БУКОВЕЛЬ" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #B3D9FF color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

-- INTERNATIONAL CITIES (15-55)
('Амстердам', 'Amsterdam', 'Netherlands', 'Canal houses', '#4A7C9D', 'international', 15, 'travel-covers/pending/amsterdam.png', 'pending',
'Flat vector illustration of Amsterdam, Netherlands featuring canal houses.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "AMSTERDAM" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #4A7C9D color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Балі', 'Bali', 'Indonesia', 'Frangipani flower', '#FFB6A3', 'international', 16, 'travel-covers/pending/bali.png', 'pending',
'Flat vector illustration of Bali, Indonesia featuring Frangipani flower.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "BALI" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #FFB6A3 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Барселона', 'Barcelona', 'Spain', 'Sagrada Familia', '#F4D03F', 'international', 17, 'travel-covers/pending/barcelona.png', 'pending',
'Flat vector illustration of Barcelona, Spain featuring Sagrada Familia.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "BARCELONA" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #F4D03F color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Берлін', 'Berlin', 'Germany', 'Brandenburg Gate', '#E8DCC4', 'international', 18, 'travel-covers/pending/berlin.png', 'pending',
'Flat vector illustration of Berlin, Germany featuring Brandenburg Gate.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "BERLIN" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #E8DCC4 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Дубай', 'Dubai', 'UAE', 'Burj Al Arab', '#17A589', 'international', 19, 'travel-covers/pending/dubai.png', 'pending',
'Flat vector illustration of Dubai, UAE featuring Burj Al Arab hotel silhouette.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "DUBAI" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #17A589 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Єгипет', 'Egypt', 'Egypt', 'Pyramids and Camel', '#F5CBA7', 'international', 20, 'travel-covers/pending/egypt.png', 'pending',
'Flat vector illustration of Egypt featuring Pyramids and Camel silhouette.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "EGYPT" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #F5CBA7 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Греція', 'Greece', 'Greece', 'Santorini white church dome', '#48C9B0', 'international', 21, 'travel-covers/pending/greece.png', 'pending',
'Flat vector illustration of Santorini, Greece featuring white church dome with blue roof.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "GREECE" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #48C9B0 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Гаваї', 'Hawaii', 'USA', 'Hibiscus flower', '#FF6B6B', 'international', 22, 'travel-covers/pending/hawaii.png', 'pending',
'Flat vector illustration of Hawaii, USA featuring Hibiscus flower.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "HAWAII" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #FF6B6B color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Ісландія', 'Iceland', 'Iceland', 'Northern lights silhouette', '#2C3E50', 'international', 23, 'travel-covers/pending/iceland.png', 'pending',
'Flat vector illustration of Iceland featuring Northern Lights silhouette.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "ICELAND" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #2C3E50 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Стамбул', 'Istanbul', 'Turkey', 'Blue Mosque', '#D68910', 'international', 24, 'travel-covers/pending/istanbul.png', 'pending',
'Flat vector illustration of Istanbul, Turkey featuring Blue Mosque silhouette.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "ISTANBUL" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #D68910 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Японія', 'Japan', 'Japan', 'Bullet train', '#FFFFFF', 'international', 25, 'travel-covers/pending/japan.png', 'pending',
'Flat vector illustration of Japan featuring Bullet train (Shinkansen).
Clean geometric shapes, bold saturated colors, minimal detail.
City name "JAPAN" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #FFFFFF color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Лондон', 'London', 'UK', 'Red telephone box', '#F5F5F5', 'international', 26, 'travel-covers/pending/london.png', 'pending',
'Flat vector illustration of London, UK featuring red telephone box.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "LONDON" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #F5F5F5 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Мальдіви', 'Maldives', 'Maldives', 'Overwater bungalow', '#45B7D1', 'international', 27, 'travel-covers/pending/maldives.png', 'pending',
'Flat vector illustration of Maldives featuring overwater bungalow.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "MALDIVES" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #45B7D1 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Майамі', 'Miami', 'USA', 'Palm tree art deco', '#FF6F91', 'international', 28, 'travel-covers/pending/miami.png', 'pending',
'Flat vector illustration of Miami, USA featuring Palm tree and art deco architecture.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "MIAMI" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #FF6F91 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Марокко', 'Morocco', 'Morocco', 'Archway door', '#FF7F50', 'international', 29, 'travel-covers/pending/morocco.png', 'pending',
'Flat vector illustration of Morocco featuring traditional archway door.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "MOROCCO" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #FF7F50 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Нью-Йорк', 'New York', 'USA', 'Statue of Liberty', '#1C2833', 'international', 30, 'travel-covers/pending/new-york.png', 'pending',
'Flat vector illustration of New York, USA featuring Statue of Liberty silhouette.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "NEW YORK" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #1C2833 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Норвегія', 'Norway', 'Norway', 'Fjord silhouette', '#154360', 'international', 31, 'travel-covers/pending/norway.png', 'pending',
'Flat vector illustration of Norway featuring Fjord mountain silhouette.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "NORWAY" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #154360 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Париж', 'Paris', 'France', 'Eiffel Tower', '#FFD1DC', 'international', 32, 'travel-covers/pending/paris.png', 'pending',
'Flat vector illustration of Paris, France featuring Eiffel Tower silhouette.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "PARIS" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #FFD1DC color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Прага', 'Prague', 'Czech Republic', 'Charles Bridge', '#F0EAD6', 'international', 33, 'travel-covers/pending/prague.png', 'pending',
'Flat vector illustration of Prague, Czech Republic featuring Charles Bridge.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "PRAGUE" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #F0EAD6 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Рим', 'Rome', 'Italy', 'Colosseum', '#F7DC6F', 'international', 34, 'travel-covers/pending/rome.png', 'pending',
'Flat vector illustration of Rome, Italy featuring Colosseum.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "ROME" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #F7DC6F color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Сінгапур', 'Singapore', 'Singapore', 'Marina Bay Sands', '#17A589', 'international', 35, 'travel-covers/pending/singapore.png', 'pending',
'Flat vector illustration of Singapore featuring Marina Bay Sands.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "SINGAPORE" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #17A589 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Швейцарія', 'Switzerland', 'Switzerland', 'Mountain chalet', '#AED6F1', 'international', 36, 'travel-covers/pending/switzerland.png', 'pending',
'Flat vector illustration of Switzerland featuring mountain and chalet.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "SWITZERLAND" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #AED6F1 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Таїланд', 'Thailand', 'Thailand', 'Buddhist temple', '#F39C12', 'international', 37, 'travel-covers/pending/thailand.png', 'pending',
'Flat vector illustration of Thailand featuring Buddhist temple.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "THAILAND" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #F39C12 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Каппадокія', 'Cappadocia', 'Turkey', 'Hot air balloon', '#FFB347', 'international', 38, 'travel-covers/pending/cappadocia.png', 'pending',
'Flat vector illustration of Cappadocia, Turkey featuring hot air balloon.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "CAPPADOCIA" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #FFB347 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('В''єтнам', 'Vietnam', 'Vietnam', 'Traditional lanterns', '#FF6B6B', 'international', 39, 'travel-covers/pending/vietnam.png', 'pending',
'Flat vector illustration of Vietnam featuring traditional lanterns.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "VIETNAM" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #FF6B6B color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Занзібар', 'Zanzibar', 'Tanzania', 'Dhow boat', '#48D1CC', 'international', 40, 'travel-covers/pending/zanzibar.png', 'pending',
'Flat vector illustration of Zanzibar, Tanzania featuring traditional Dhow boat.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "ZANZIBAR" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #48D1CC color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Сідней', 'Sydney', 'Australia', 'Opera House', '#FFFFFF', 'international', 41, 'travel-covers/pending/sydney.png', 'pending',
'Flat vector illustration of Sydney, Australia featuring Opera House.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "SYDNEY" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #FFFFFF color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Ріо-де-Жанейро', 'Rio de Janeiro', 'Brazil', 'Christ the Redeemer', '#7CB342', 'international', 42, 'travel-covers/pending/rio.png', 'pending',
'Flat vector illustration of Rio de Janeiro, Brazil featuring Christ the Redeemer statue.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "RIO DE JANEIRO" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #7CB342 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Канада', 'Canada', 'Canada', 'Maple leaf', '#D32F2F', 'international', 43, 'travel-covers/pending/canada.png', 'pending',
'Flat vector illustration of Canada featuring maple leaf.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "CANADA" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #D32F2F color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Патагонія', 'Patagonia', 'Chile', 'Mountain peaks', '#5DADE2', 'international', 44, 'travel-covers/pending/patagonia.png', 'pending',
'Flat vector illustration of Patagonia, Chile featuring mountain peaks.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "PATAGONIA" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #5DADE2 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Колумбія', 'Colombia', 'Colombia', 'Coffee plant', '#8D6E63', 'international', 45, 'travel-covers/pending/colombia.png', 'pending',
'Flat vector illustration of Colombia featuring coffee plant.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "COLOMBIA" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #8D6E63 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Дубровник', 'Dubrovnik', 'Croatia', 'City walls', '#CD853F', 'international', 46, 'travel-covers/pending/dubrovnik.png', 'pending',
'Flat vector illustration of Dubrovnik, Croatia featuring medieval city walls.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "DUBROVNIK" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #CD853F color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Гавана', 'Havana', 'Cuba', 'Vintage car', '#FF6F61', 'international', 47, 'travel-covers/pending/havana.png', 'pending',
'Flat vector illustration of Havana, Cuba featuring vintage American car.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "HAVANA" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #FF6F61 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Індія', 'India', 'India', 'Taj Mahal', '#FFE4C4', 'international', 48, 'travel-covers/pending/india.png', 'pending',
'Flat vector illustration of India featuring Taj Mahal.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "INDIA" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #FFE4C4 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Ямайка', 'Jamaica', 'Jamaica', 'Reggae guitar', '#FFD700', 'international', 49, 'travel-covers/pending/jamaica.png', 'pending',
'Flat vector illustration of Jamaica featuring reggae guitar.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "JAMAICA" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #FFD700 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Кенія', 'Kenya', 'Kenya', 'Acacia tree silhouette', '#D2691E', 'international', 50, 'travel-covers/pending/kenya.png', 'pending',
'Flat vector illustration of Kenya featuring Acacia tree silhouette.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "KENYA" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #D2691E color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Мексика', 'Mexico', 'Mexico', 'Cactus', '#7FB069', 'international', 51, 'travel-covers/pending/mexico.png', 'pending',
'Flat vector illustration of Mexico featuring cactus.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "MEXICO" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #7FB069 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Перу', 'Peru', 'Peru', 'Machu Picchu', '#8B7355', 'international', 52, 'travel-covers/pending/peru.png', 'pending',
'Flat vector illustration of Peru featuring Machu Picchu.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "PERU" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #8B7355 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Лісабон', 'Lisbon', 'Portugal', 'Yellow tram', '#F4D03F', 'international', 53, 'travel-covers/pending/lisbon.png', 'pending',
'Flat vector illustration of Lisbon, Portugal featuring yellow tram.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "LISBON" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #F4D03F color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Шотландія', 'Scotland', 'UK', 'Castle silhouette', '#7D8A8C', 'international', 54, 'travel-covers/pending/scotland.png', 'pending',
'Flat vector illustration of Scotland featuring castle silhouette.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "SCOTLAND" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #7D8A8C color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.'),

('Сеул', 'Seoul', 'South Korea', 'Gyeongbokgung gate', '#4A90E2', 'international', 55, 'travel-covers/pending/seoul.png', 'pending',
'Flat vector illustration of Seoul, South Korea featuring Gyeongbokgung palace gate.
Clean geometric shapes, bold saturated colors, minimal detail.
City name "SEOUL" integrated into the composition in bold clean compressed sans-serif font, ALL CAPS, centered in upper 30% of cover.
Illustration centered in lower 60%, single focal object, 1-3 colors, simplified silhouette.
Background: solid flat #4A90E2 color, no textures, no gradients.
Style: modern travel poster, Scandinavian flat design.
No outlines, no borders, no patterns, no photorealism, no 3D effects, no drop shadows.
Generous negative space (25%+ of cover area).
Cover dimensions: portrait orientation 20×30 cm.');

-- =============================================
-- Comments
-- =============================================

COMMENT ON TABLE travel_book_covers IS 'Travel Book city cover illustrations with AI generation tracking';
COMMENT ON COLUMN travel_book_covers.generation_status IS 'Lifecycle: pending → generated → approved/flagged';
COMMENT ON COLUMN travel_book_covers.nano_banana_prompt IS 'Exact prompt sent to Nano Banana API for reproducibility';
