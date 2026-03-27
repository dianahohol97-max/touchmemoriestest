-- =============================================
-- Add Navigation Links for 5 New Poster Constructors
-- =============================================

-- Create parent "Постери" navigation item if it doesn't exist
INSERT INTO navigation_links (link_text, link_url, display_order, is_active, parent_id)
SELECT 'Постери', '/catalog?category=posters', 6, true, NULL
WHERE NOT EXISTS (
    SELECT 1 FROM navigation_links WHERE link_text = 'Постери' AND parent_id IS NULL
);

-- Get the parent ID for "Постери"
DO $$
DECLARE
    poster_parent_id UUID;
BEGIN
    SELECT id INTO poster_parent_id
    FROM navigation_links
    WHERE link_text = 'Постери' AND parent_id IS NULL
    LIMIT 1;

    -- Add child navigation links for new poster constructors
    INSERT INTO navigation_links (link_text, link_url, display_order, is_active, parent_id) VALUES
    ('Зоряна карта', '/order/starmap', 1, true, poster_parent_id),
    ('Карта міста', '/order/citymap', 2, true, poster_parent_id),
    ('Карта кохання', '/order/lovemap', 3, true, poster_parent_id),
    ('Метрика народження', '/order/birthstats', 4, true, poster_parent_id),
    ('Постер з ініціалом', '/order/monogram', 5, true, poster_parent_id),
    ('Знак зодіаку', '/order/zodiac', 6, true, poster_parent_id),
    ('Портрет у стилі мультфільму', '/order/cartoon-portrait', 7, true, poster_parent_id)
    ON CONFLICT DO NOTHING;

END $$;

-- =============================================
-- Add Product Categories for Posters
-- =============================================

-- Create posters category if it doesn't exist
INSERT INTO categories (name, slug, description, is_active)
VALUES (
    'Постери',
    'posters',
    'Персоналізовані постери: зоряні карти, карти міст, метрики народження та інше',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- =============================================
-- Comments
-- =============================================

COMMENT ON TABLE navigation_links IS 'Navigation menu structure with parent-child relationships for dropdowns';
