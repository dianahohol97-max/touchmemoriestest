-- =====================================================
-- PART 1: CREATE NEW CATEGORIES
-- =====================================================

INSERT INTO categories (name, slug, description, is_active, sort_order) VALUES
('Книга побажань', 'guestbooks', 'Книги побажань для весіль та святкувань', true, 10),
('Фотокалендарі', 'calendars', 'Настінні та настільні календарі з вашими фото', true, 11),
('Альбоми для вклейки фото', 'scrapbook-albums', 'Альбоми для вклеювання фотографій', true, 12),
('Альбоми Instax', 'instax-albums', 'Альбоми для фотографій Instax', true, 13),
('Дитячі товари', 'kids', 'Перший альбом малюка, дитячі альбоми', true, 14),
('Аксесуари', 'accessories', 'Фотокамери, рамки, аксесуари для фото', true, 15),
('Електроніка', 'electronics', 'Картриджі та електронні товари для фото', true, 16)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- PART 2: UPDATE NAVIGATION LINKS (ADD DROPDOWNS)
-- =====================================================

-- First, delete existing navigation links to rebuild with dropdowns
DELETE FROM navigation_links;

-- Main navigation items with parent_id = NULL
INSERT INTO navigation_links (link_text, link_url, display_order, is_active, parent_id) VALUES
('Фотокниги', '/catalog?category=photobooks', 1, true, NULL),
('Журнали', '/catalog?category=hlyantsevi-zhurnaly', 2, true, NULL),
('Travel Book', '/order/book?product=travelbook', 3, true, NULL),
('Фотодрук', '#', 4, true, NULL),
('Постери', '#', 5, true, NULL),
('Календарі', '#', 6, true, NULL),
('Книга побажань', '/catalog?category=guestbooks', 7, true, NULL),
('Пазли', '/order/puzzle', 8, true, NULL);

-- Get parent IDs for dropdowns
DO $$
DECLARE
    photobooks_id UUID;
    magazines_id UUID;
    photoprint_id UUID;
    posters_id UUID;
    calendars_id UUID;
BEGIN
    -- Get parent link IDs
    SELECT id INTO photobooks_id FROM navigation_links WHERE link_text = 'Фотокниги';
    SELECT id INTO magazines_id FROM navigation_links WHERE link_text = 'Журнали';
    SELECT id INTO photoprint_id FROM navigation_links WHERE link_text = 'Фотодрук';
    SELECT id INTO posters_id FROM navigation_links WHERE link_text = 'Постери';
    SELECT id INTO calendars_id FROM navigation_links WHERE link_text = 'Календарі';

    -- Photobooks dropdown
    INSERT INTO navigation_links (link_text, link_url, display_order, is_active, parent_id) VALUES
    ('Шкірзамінник', '/order/book?product=photobook-leather', 1, true, photobooks_id),
    ('Тканина', '/order/book?product=photobook-fabric', 2, true, photobooks_id),
    ('Велюр', '/order/book?product=photobook-velour', 3, true, photobooks_id),
    ('Друкована обкладинка', '/order/book?product=photobook-printed', 4, true, photobooks_id);

    -- Magazines dropdown
    INSERT INTO navigation_links (link_text, link_url, display_order, is_active, parent_id) VALUES
    ('Глянцевий журнал', '/order/book?product=magazine-soft', 1, true, magazines_id),
    ('Журнал тверда обкладинка', '/order/book?product=magazine-hard', 2, true, magazines_id);

    -- Photoprint dropdown
    INSERT INTO navigation_links (link_text, link_url, display_order, is_active, parent_id) VALUES
    ('Стандартний друк', '/order/photoprint', 1, true, photoprint_id),
    ('Полароїд', '/order/photoprint?type=polaroid', 2, true, photoprint_id),
    ('Фотомагніти', '/order/photomagnets', 3, true, photoprint_id);

    -- Posters dropdown
    INSERT INTO navigation_links (link_text, link_url, display_order, is_active, parent_id) VALUES
    ('Зоряне небо', '/order/starmap', 1, true, posters_id),
    ('Карта міста', '/order/citymap', 2, true, posters_id);

    -- Calendars dropdown
    INSERT INTO navigation_links (link_text, link_url, display_order, is_active, parent_id) VALUES
    ('Настінний', '/order/calendar/wall', 1, true, calendars_id),
    ('Настільний', '/order/calendar/desk', 2, true, calendars_id);
END $$;

-- =====================================================
-- PART 3: IMPORT PRODUCTS AND VARIANTS
-- =====================================================

-- Note: You need to run product imports AFTER getting category IDs
-- Here are the queries to get category IDs:

SELECT id, name, slug FROM categories ORDER BY sort_order;

-- Then use the category IDs in the INSERT statements below
-- Replace <category_id> with actual UUID from the query above

-- =====================================================
-- EXAMPLE: Import Фотомагніти variants
-- =====================================================

DO $$
DECLARE
    magnets_product_id UUID;
    magnets_category_id UUID;
BEGIN
    -- Get category ID
    SELECT id INTO magnets_category_id FROM categories WHERE slug = 'photomagnets';

    -- Get or create product
    SELECT id INTO magnets_product_id FROM products WHERE slug = 'photomagnets';

    IF magnets_product_id IS NULL THEN
        INSERT INTO products (name, slug, description, price, categories_id, is_active, is_popular)
        VALUES ('Фотомагніти', 'photomagnets', 'Комплект з 9 фотомагнітів', 215, magnets_category_id, true, true)
        RETURNING id INTO magnets_product_id;
    END IF;

    -- Insert variants
    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    (magnets_product_id, 'MAGNET-5x7.5', 215, 1000, '{"Розмір": "5×7.5 см", "Кількість": "9 шт"}', true),
    (magnets_product_id, 'MAGNET-6x9', 215, 1000, '{"Розмір": "6×9 см", "Кількість": "9 шт"}', true),
    (magnets_product_id, 'MAGNET-7.5x10', 215, 1000, '{"Розмір": "7.5×10 см", "Кількість": "9 шт"}', true),
    (magnets_product_id, 'MAGNET-9x9', 215, 1000, '{"Розмір": "9×9 см", "Кількість": "9 шт"}', true),
    (magnets_product_id, 'MAGNET-10x10', 215, 1000, '{"Розмір": "10×10 см", "Кількість": "9 шт"}', true),
    (magnets_product_id, 'MAGNET-POLAROID-1', 215, 1000, '{"Розмір": "Polaroid 7.6×10.1 см", "Кількість": "9 шт"}', true),
    (magnets_product_id, 'MAGNET-POLAROID-2', 215, 1000, '{"Розмір": "Polaroid 8.6×5.4 см", "Кількість": "9 шт"}', true)
    ON CONFLICT (sku) DO NOTHING;
END $$;

-- =====================================================
-- Import Фотодрук (стандартні розміри)
-- =====================================================

DO $$
DECLARE
    photoprint_product_id UUID;
    prints_category_id UUID;
BEGIN
    SELECT id INTO prints_category_id FROM categories WHERE slug = 'prints';

    SELECT id INTO photoprint_product_id FROM products WHERE slug = 'photoprint-standard';

    IF photoprint_product_id IS NULL THEN
        INSERT INTO products (name, slug, description, price, categories_id, is_active, is_popular)
        VALUES ('Фотодрук стандартні розміри', 'photoprint-standard', 'Професійний фотодрук на преміум папері', 8, prints_category_id, true, true)
        RETURNING id INTO photoprint_product_id;
    END IF;

    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    (photoprint_product_id, 'PRINT-10x15', 8, 10000, '{"Розмір": "10×15 см"}', true),
    (photoprint_product_id, 'PRINT-13x18', 14, 10000, '{"Розмір": "13×18 см"}', true),
    (photoprint_product_id, 'PRINT-15x20', 14, 10000, '{"Розмір": "15×20 см"}', true),
    (photoprint_product_id, 'PRINT-15x21', 14, 10000, '{"Розмір": "15×21 см"}', true),
    (photoprint_product_id, 'PRINT-20x25', 22, 10000, '{"Розмір": "20×25 см"}', true),
    (photoprint_product_id, 'PRINT-20x27', 25, 10000, '{"Розмір": "20×27 см"}', true),
    (photoprint_product_id, 'PRINT-20x30', 25, 10000, '{"Розмір": "20×30 см"}', true),
    (photoprint_product_id, 'PRINT-21x30', 25, 10000, '{"Розмір": "21×30 см"}', true),
    (photoprint_product_id, 'PRINT-25x38', 34, 10000, '{"Розмір": "25×38 см"}', true),
    (photoprint_product_id, 'PRINT-30x30', 34, 10000, '{"Розмір": "30×30 см"}', true),
    (photoprint_product_id, 'PRINT-30x40', 38, 10000, '{"Розмір": "30×40 см"}', true),
    (photoprint_product_id, 'PRINT-30x42', 38, 10000, '{"Розмір": "30×42 см"}', true),
    (photoprint_product_id, 'PRINT-30x45', 44, 10000, '{"Розмір": "30×45 см"}', true)
    ON CONFLICT (sku) DO NOTHING;
END $$;

-- =====================================================
-- Import Polaroid
-- =====================================================

DO $$
DECLARE
    polaroid_product_id UUID;
    prints_category_id UUID;
BEGIN
    SELECT id INTO prints_category_id FROM categories WHERE slug = 'prints';

    SELECT id INTO polaroid_product_id FROM products WHERE slug = 'polaroid-print';

    IF polaroid_product_id IS NULL THEN
        INSERT INTO products (name, slug, description, price, categories_id, is_active, is_popular)
        VALUES ('Полароїд', 'polaroid-print', 'Друк фото у стилі Polaroid', 7.5, prints_category_id, true, false)
        RETURNING id INTO polaroid_product_id;
    END IF;

    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    (polaroid_product_id, 'POLAROID-PRINT-1', 7.5, 10000, '{"Розмір": "7.5×10 см", "Тип": "Polaroid"}', true)
    ON CONFLICT (sku) DO NOTHING;
END $$;

-- =====================================================
-- Import Wall Calendar
-- =====================================================

DO $$
DECLARE
    wall_calendar_id UUID;
    calendars_category_id UUID;
BEGIN
    SELECT id INTO calendars_category_id FROM categories WHERE slug = 'calendars';

    SELECT id INTO wall_calendar_id FROM products WHERE slug = 'wall-calendar-2026';

    IF wall_calendar_id IS NULL THEN
        INSERT INTO products (name, slug, description, price, categories_id, is_active, is_popular)
        VALUES ('Настінний фотокалендар на 2026 рік', 'wall-calendar-2026', 'Персональний настінний календар з вашими фото', 590, calendars_category_id, true, false)
        RETURNING id INTO wall_calendar_id;
    END IF;

    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    (wall_calendar_id, 'WALL-CAL-2026-A3', 690, 100, '{"Розмір": "A3", "Рік": "2026"}', true),
    (wall_calendar_id, 'WALL-CAL-2026-A4', 590, 100, '{"Розмір": "A4", "Рік": "2026"}', true)
    ON CONFLICT (sku) DO NOTHING;
END $$;

-- =====================================================
-- Import Desk Calendar
-- =====================================================

DO $$
DECLARE
    desk_calendar_id UUID;
    calendars_category_id UUID;
BEGIN
    SELECT id INTO calendars_category_id FROM categories WHERE slug = 'calendars';

    SELECT id INTO desk_calendar_id FROM products WHERE slug = 'desk-calendar-2026';

    IF desk_calendar_id IS NULL THEN
        INSERT INTO products (name, slug, description, price, categories_id, is_active, is_popular)
        VALUES ('Фотокалендар на 2026 рік (настільний)', 'desk-calendar-2026', 'Настільний календар з вашими фото', 299, calendars_category_id, true, false)
        RETURNING id INTO desk_calendar_id;
    END IF;

    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    (desk_calendar_id, 'DESK-CAL-2026', 299, 100, '{"Тип": "Настільний", "Рік": "2026"}', true)
    ON CONFLICT (sku) DO NOTHING;
END $$;

-- =====================================================
-- Import Puzzles
-- =====================================================

DO $$
DECLARE
    puzzle_id UUID;
    gifts_category_id UUID;
BEGIN
    SELECT id INTO gifts_category_id FROM categories WHERE slug = 'gifts';

    SELECT id INTO puzzle_id FROM products WHERE slug = 'photo-puzzle';

    IF puzzle_id IS NULL THEN
        INSERT INTO products (name, slug, description, price, categories_id, is_active, is_popular)
        VALUES ('Фотопазли', 'photo-puzzle', 'Пазл з вашим фото', 249, gifts_category_id, true, false)
        RETURNING id INTO puzzle_id;
    END IF;

    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    (puzzle_id, 'PUZZLE-15x21', 349, 500, '{"Розмір": "15×21 см"}', true),
    (puzzle_id, 'PUZZLE-20x30', 249, 500, '{"Розмір": "20×30 см"}', true)
    ON CONFLICT (sku) DO NOTHING;
END $$;

-- =====================================================
-- Continue with all other products...
-- Due to length, this is a template. Full import script
-- would be generated programmatically or in separate file.
-- =====================================================

-- Verification
SELECT
    p.name,
    c.name as category,
    COUNT(pv.id) as variant_count
FROM products p
LEFT JOIN categories c ON p.categories_id = c.id
LEFT JOIN product_variants pv ON p.id = pv.product_id
WHERE p.is_active = true
GROUP BY p.id, p.name, c.name
ORDER BY c.name, p.name;
