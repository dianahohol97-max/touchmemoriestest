-- =====================================================
-- IMPORT ALL 98 PRODUCTS FROM OLD SITE
-- Run this AFTER running import-products-and-navigation.sql
-- =====================================================
-- This file creates products and variants for all items
-- from the old Touch Memories site (93 additional products)
-- =====================================================

-- Get category IDs (for reference)
-- SELECT id, name, slug FROM categories ORDER BY name;

-- =====================================================
-- PART 1: GUEST BOOKS (Книга побажань на весілля)
-- =====================================================

DO $$
DECLARE
    guestbook_id UUID;
    guestbooks_category_id UUID;
BEGIN
    SELECT id INTO guestbooks_category_id FROM categories WHERE slug = 'guestbooks';

    -- Create product
    INSERT INTO products (name, slug, description, price, categories_id, is_active, is_popular)
    VALUES (
        'Книга побажань на весілля',
        'wedding-guestbook',
        'Елегантна книга для побажань гостей на весіллі',
        559,
        guestbooks_category_id,
        true,
        true
    )
    ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        price = EXCLUDED.price
    RETURNING id INTO guestbook_id;

    IF guestbook_id IS NULL THEN
        SELECT id INTO guestbook_id FROM products WHERE slug = 'wedding-guestbook';
    END IF;

    -- 27 variants: 3 sizes × 3 covers × 3 page colors
    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    -- 23×23, Друкована тверда, different page colors
    (guestbook_id, 'GB-23x23-PRINT-WHITE', 559, 50, '{"Розмір": "23×23 см", "Обкладинка": "Друкована тверда", "Сторінки": "Білі"}', true),
    (guestbook_id, 'GB-23x23-PRINT-BLACK', 859, 50, '{"Розмір": "23×23 см", "Обкладинка": "Друкована тверда", "Сторінки": "Чорні"}', true),
    (guestbook_id, 'GB-23x23-PRINT-CREAM', 859, 50, '{"Розмір": "23×23 см", "Обкладинка": "Друкована тверда", "Сторінки": "Кремові"}', true),

    -- 23×23, Із тканини
    (guestbook_id, 'GB-23x23-FABRIC-WHITE', 999, 50, '{"Розмір": "23×23 см", "Обкладинка": "Із тканини", "Сторінки": "Білі"}', true),
    (guestbook_id, 'GB-23x23-FABRIC-BLACK', 1299, 50, '{"Розмір": "23×23 см", "Обкладинка": "Із тканини", "Сторінки": "Чорні"}', true),
    (guestbook_id, 'GB-23x23-FABRIC-CREAM', 1299, 50, '{"Розмір": "23×23 см", "Обкладинка": "Із тканини", "Сторінки": "Кремові"}', true),

    -- 23×23, Велюрова
    (guestbook_id, 'GB-23x23-VELOUR-WHITE', 999, 50, '{"Розмір": "23×23 см", "Обкладинка": "Велюрова", "Сторінки": "Білі"}', true),
    (guestbook_id, 'GB-23x23-VELOUR-BLACK', 1299, 50, '{"Розмір": "23×23 см", "Обкладинка": "Велюрова", "Сторінки": "Чорні"}', true),
    (guestbook_id, 'GB-23x23-VELOUR-CREAM', 1299, 50, '{"Розмір": "23×23 см", "Обкладинка": "Велюрова", "Сторінки": "Кремові"}', true),

    -- 30×20, all combinations
    (guestbook_id, 'GB-30x20-PRINT-WHITE', 599, 50, '{"Розмір": "30×20 см", "Обкладинка": "Друкована тверда", "Сторінки": "Білі"}', true),
    (guestbook_id, 'GB-30x20-PRINT-BLACK', 899, 50, '{"Розмір": "30×20 см", "Обкладинка": "Друкована тверда", "Сторінки": "Чорні"}', true),
    (guestbook_id, 'GB-30x20-PRINT-CREAM', 899, 50, '{"Розмір": "30×20 см", "Обкладинка": "Друкована тверда", "Сторінки": "Кремові"}', true),
    (guestbook_id, 'GB-30x20-FABRIC-WHITE', 1059, 50, '{"Розмір": "30×20 см", "Обкладинка": "Із тканини", "Сторінки": "Білі"}', true),
    (guestbook_id, 'GB-30x20-FABRIC-BLACK', 1359, 50, '{"Розмір": "30×20 см", "Обкладинка": "Із тканини", "Сторінки": "Чорні"}', true),
    (guestbook_id, 'GB-30x20-FABRIC-CREAM', 1359, 50, '{"Розмір": "30×20 см", "Обкладинка": "Із тканини", "Сторінки": "Кремові"}', true),
    (guestbook_id, 'GB-30x20-VELOUR-WHITE', 1059, 50, '{"Розмір": "30×20 см", "Обкладинка": "Велюрова", "Сторінки": "Білі"}', true),
    (guestbook_id, 'GB-30x20-VELOUR-BLACK', 1359, 50, '{"Розмір": "30×20 см", "Обкладинка": "Велюрова", "Сторінки": "Чорні"}', true),
    (guestbook_id, 'GB-30x20-VELOUR-CREAM', 1359, 50, '{"Розмір": "30×20 см", "Обкладинка": "Велюрова", "Сторінки": "Кремові"}', true),

    -- 20×30, all combinations
    (guestbook_id, 'GB-20x30-PRINT-WHITE', 559, 50, '{"Розмір": "20×30 см", "Обкладинка": "Друкована тверда", "Сторінки": "Білі"}', true),
    (guestbook_id, 'GB-20x30-PRINT-BLACK', 859, 50, '{"Розмір": "20×30 см", "Обкладинка": "Друкована тверда", "Сторінки": "Чорні"}', true),
    (guestbook_id, 'GB-20x30-PRINT-CREAM', 859, 50, '{"Розмір": "20×30 см", "Обкладинка": "Друкована тверда", "Сторінки": "Кремові"}', true),
    (guestbook_id, 'GB-20x30-FABRIC-WHITE', 1059, 50, '{"Розмір": "20×30 см", "Обкладинка": "Із тканини", "Сторінки": "Білі"}', true),
    (guestbook_id, 'GB-20x30-FABRIC-BLACK', 1359, 50, '{"Розмір": "20×30 см", "Обкладинка": "Із тканини", "Сторінки": "Чорні"}', true),
    (guestbook_id, 'GB-20x30-FABRIC-CREAM', 1359, 50, '{"Розмір": "20×30 см", "Обкладинка": "Із тканини", "Сторінки": "Кремові"}', true),
    (guestbook_id, 'GB-20x30-VELOUR-WHITE', 1059, 50, '{"Розмір": "20×30 см", "Обкладинка": "Велюрова", "Сторінки": "Білі"}', true),
    (guestbook_id, 'GB-20x30-VELOUR-BLACK', 1359, 50, '{"Розмір": "20×30 см", "Обкладинка": "Велюрова", "Сторінки": "Чорні"}', true),
    (guestbook_id, 'GB-20x30-VELOUR-CREAM', 1359, 50, '{"Розмір": "20×30 см", "Обкладинка": "Велюрова", "Сторінки": "Кремові"}', true)
    ON CONFLICT (sku) DO NOTHING;
END $$;

-- =====================================================
-- PART 2: PHOTO MAGAZINE WITH HARD COVER
-- =====================================================

DO $$
DECLARE
    magazine_hard_id UUID;
    magazines_category_id UUID;
BEGIN
    SELECT id INTO magazines_category_id FROM categories WHERE slug = 'hlyantsevi-zhurnaly';

    INSERT INTO products (name, slug, description, price, categories_id, is_active, is_popular)
    VALUES (
        'Фотожурнал з твердою обкладинкою',
        'magazine-hardcover',
        'Преміум глянцевий журнал з твердою обкладинкою',
        600,
        magazines_category_id,
        true,
        true
    )
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO magazine_hard_id;

    IF magazine_hard_id IS NULL THEN
        SELECT id INTO magazine_hard_id FROM products WHERE slug = 'magazine-hardcover';
    END IF;

    -- 14 page count variants
    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    (magazine_hard_id, 'MAG-HC-12P', 600, 100, '{"Кількість сторінок": "12"}', true),
    (magazine_hard_id, 'MAG-HC-16P', 750, 100, '{"Кількість сторінок": "16"}', true),
    (magazine_hard_id, 'MAG-HC-20P', 900, 100, '{"Кількість сторінок": "20"}', true),
    (magazine_hard_id, 'MAG-HC-24P', 1050, 100, '{"Кількість сторінок": "24"}', true),
    (magazine_hard_id, 'MAG-HC-28P', 1200, 100, '{"Кількість сторінок": "28"}', true),
    (magazine_hard_id, 'MAG-HC-32P', 1350, 100, '{"Кількість сторінок": "32"}', true),
    (magazine_hard_id, 'MAG-HC-36P', 1500, 100, '{"Кількість сторінок": "36"}', true),
    (magazine_hard_id, 'MAG-HC-40P', 1650, 100, '{"Кількість сторінок": "40"}', true),
    (magazine_hard_id, 'MAG-HC-44P', 1800, 100, '{"Кількість сторінок": "44"}', true),
    (magazine_hard_id, 'MAG-HC-48P', 1950, 100, '{"Кількість сторінок": "48"}', true),
    (magazine_hard_id, 'MAG-HC-52P', 2075, 100, '{"Кількість сторінок": "52"}', true),
    (magazine_hard_id, 'MAG-HC-60P', 2275, 100, '{"Кількість сторінок": "60"}', true),
    (magazine_hard_id, 'MAG-HC-72P', 2575, 100, '{"Кількість сторінок": "72"}', true),
    (magazine_hard_id, 'MAG-HC-80P', 2825, 100, '{"Кількість сторінок": "80"}', true)
    ON CONFLICT (sku) DO NOTHING;
END $$;

-- =====================================================
-- PART 3: BABY'S FIRST ALBUM (Перший альбом малюка)
-- =====================================================

DO $$
DECLARE
    baby_album_id UUID;
    kids_category_id UUID;
BEGIN
    SELECT id INTO kids_category_id FROM categories WHERE slug = 'kids';

    INSERT INTO products (name, slug, description, price, categories_id, is_active, is_popular)
    VALUES (
        'Перший альбом малюка',
        'baby-first-album',
        'Альбом для перших фото немовляти',
        799,
        kids_category_id,
        true,
        true
    )
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO baby_album_id;

    IF baby_album_id IS NULL THEN
        SELECT id INTO baby_album_id FROM products WHERE slug = 'baby-first-album';
    END IF;

    -- 9 variants: 3 sizes × 3 cover types
    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    (baby_album_id, 'BABY-23x23-PRINT', 799, 50, '{"Розмір": "23×23 см", "Обкладинка": "Друкована тверда"}', true),
    (baby_album_id, 'BABY-23x23-FABRIC', 999, 50, '{"Розмір": "23×23 см", "Обкладинка": "Тканина"}', true),
    (baby_album_id, 'BABY-23x23-VELOUR', 999, 50, '{"Розмір": "23×23 см", "Обкладинка": "Велюрова"}', true),
    (baby_album_id, 'BABY-20x30-PRINT', 899, 50, '{"Розмір": "20×30 см", "Обкладинка": "Друкована тверда"}', true),
    (baby_album_id, 'BABY-20x30-FABRIC', 1059, 50, '{"Розмір": "20×30 см", "Обкладинка": "Тканина"}', true),
    (baby_album_id, 'BABY-20x30-VELOUR', 1059, 50, '{"Розмір": "20×30 см", "Обкладинка": "Велюрова"}', true),
    (baby_album_id, 'BABY-30x20-PRINT', 899, 50, '{"Розмір": "30×20 см", "Обкладинка": "Друкована тверда"}', true),
    (baby_album_id, 'BABY-30x20-FABRIC', 1059, 50, '{"Розмір": "30×20 см", "Обкладинка": "Тканина"}', true),
    (baby_album_id, 'BABY-30x20-VELOUR', 1159, 50, '{"Розмір": "30×20 см", "Обкладинка": "Велюрова"}', true)
    ON CONFLICT (sku) DO NOTHING;
END $$;

-- =====================================================
-- PART 4: CANVAS PRINTS (Друк на полотні)
-- =====================================================

DO $$
DECLARE
    canvas_id UUID;
    gifts_category_id UUID;
BEGIN
    SELECT id INTO gifts_category_id FROM categories WHERE slug = 'gifts';

    INSERT INTO products (name, slug, description, price, categories_id, is_active, is_popular)
    VALUES (
        'Друк на полотні (холсті)',
        'canvas-print',
        'Ваші фото на натуральному полотні',
        360,
        gifts_category_id,
        true,
        false
    )
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO canvas_id;

    IF canvas_id IS NULL THEN
        SELECT id INTO canvas_id FROM products WHERE slug = 'canvas-print';
    END IF;

    -- 14 size variants
    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    (canvas_id, 'CANVAS-20x20', 360, 100, '{"Розмір": "20×20 см"}', true),
    (canvas_id, 'CANVAS-20x30', 440, 100, '{"Розмір": "20×30 см"}', true),
    (canvas_id, 'CANVAS-30x20', 440, 100, '{"Розмір": "30×20 см"}', true),
    (canvas_id, 'CANVAS-25x25', 460, 100, '{"Розмір": "25×25 см"}', true),
    (canvas_id, 'CANVAS-30x30', 530, 100, '{"Розмір": "30×30 см"}', true),
    (canvas_id, 'CANVAS-30x40', 610, 100, '{"Розмір": "30×40 см"}', true),
    (canvas_id, 'CANVAS-40x30', 610, 100, '{"Розмір": "40×30 см"}', true),
    (canvas_id, 'CANVAS-40x40', 720, 100, '{"Розмір": "40×40 см"}', true),
    (canvas_id, 'CANVAS-40x50', 799, 100, '{"Розмір": "40×50 см"}', true),
    (canvas_id, 'CANVAS-50x40', 799, 100, '{"Розмір": "50×40 см"}', true),
    (canvas_id, 'CANVAS-40x60', 849, 100, '{"Розмір": "40×60 см"}', true),
    (canvas_id, 'CANVAS-60x40', 849, 100, '{"Розмір": "60×40 см"}', true),
    (canvas_id, 'CANVAS-50x50', 899, 100, '{"Розмір": "50×50 см"}', true),
    (canvas_id, 'CANVAS-50x70', 999, 100, '{"Розмір": "50×70 см"}', true)
    ON CONFLICT (sku) DO NOTHING;
END $$;

-- =====================================================
-- PART 5: INSTAX CAMERA (Fujifilm instax mini 12)
-- =====================================================

DO $$
DECLARE
    instax_camera_id UUID;
    accessories_category_id UUID;
BEGIN
    SELECT id INTO accessories_category_id FROM categories WHERE slug = 'accessories';

    INSERT INTO products (name, slug, description, price, categories_id, is_active, is_popular)
    VALUES (
        'Fujifilm instax mini 12',
        'instax-mini-12',
        'Миттєва камера Fujifilm Instax Mini 12',
        4299,
        accessories_category_id,
        true,
        true
    )
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO instax_camera_id;

    IF instax_camera_id IS NULL THEN
        SELECT id INTO instax_camera_id FROM products WHERE slug = 'instax-mini-12';
    END IF;

    -- 5 color variants
    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    (instax_camera_id, 'INSTAX12-BLUE', 4299, 10, '{"Колір": "Синій"}', true),
    (instax_camera_id, 'INSTAX12-PINK', 4299, 10, '{"Колір": "Рожевий"}', true),
    (instax_camera_id, 'INSTAX12-GREEN', 4299, 10, '{"Колір": "Зелений"}', true),
    (instax_camera_id, 'INSTAX12-WHITE', 4299, 10, '{"Колір": "Білий"}', true),
    (instax_camera_id, 'INSTAX12-BLACK', 4299, 10, '{"Колір": "Чорний"}', true)
    ON CONFLICT (sku) DO NOTHING;
END $$;

-- =====================================================
-- PART 6: DIGITAL PHOTO FRAME
-- =====================================================

DO $$
DECLARE
    frame_id UUID;
    accessories_category_id UUID;
BEGIN
    SELECT id INTO accessories_category_id FROM categories WHERE slug = 'accessories';

    INSERT INTO products (name, slug, description, price, categories_id, is_active, is_popular)
    VALUES (
        'Цифрова фоторамка',
        'digital-photo-frame',
        'Електронна рамка для відображення фото',
        2400,
        accessories_category_id,
        true,
        false
    )
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO frame_id;

    IF frame_id IS NULL THEN
        SELECT id INTO frame_id FROM products WHERE slug = 'digital-photo-frame';
    END IF;

    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    (frame_id, 'DIGI-FRAME-10', 2400, 20, '{"Діагональ": "10 дюймів"}', true)
    ON CONFLICT (sku) DO NOTHING;
END $$;

-- =====================================================
-- PART 7: INSTAX FILM CARTRIDGE
-- =====================================================

DO $$
DECLARE
    film_id UUID;
    electronics_category_id UUID;
BEGIN
    SELECT id INTO electronics_category_id FROM categories WHERE slug = 'electronics';

    INSERT INTO products (name, slug, description, price, categories_id, is_active, is_popular)
    VALUES (
        'Картридж Fujifilm Instax Mini',
        'instax-mini-film',
        'Набір з 20 фото для Instax Mini',
        1059,
        electronics_category_id,
        true,
        false
    )
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO film_id;

    IF film_id IS NULL THEN
        SELECT id INTO film_id FROM products WHERE slug = 'instax-mini-film';
    END IF;

    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    (film_id, 'INSTAX-FILM-20', 1059, 50, '{"Кількість фото": "20"}', true)
    ON CONFLICT (sku) DO NOTHING;
END $$;

-- =====================================================
-- PART 8: BABY FOOTPRINT SET
-- =====================================================

DO $$
DECLARE
    footprint_id UUID;
    kids_category_id UUID;
BEGIN
    SELECT id INTO kids_category_id FROM categories WHERE slug = 'kids';

    INSERT INTO products (name, slug, description, price, categories_id, is_active, is_popular)
    VALUES (
        'Набір для відбитків ніжок та ручок',
        'baby-footprint-kit',
        'Створіть пам''ятні відбитки дитини',
        195,
        kids_category_id,
        true,
        false
    )
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO footprint_id;

    IF footprint_id IS NULL THEN
        SELECT id INTO footprint_id FROM products WHERE slug = 'baby-footprint-kit';
    END IF;

    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    (footprint_id, 'BABY-FOOTPRINT', 195, 100, '{"Тип": "Набір"}', true)
    ON CONFLICT (sku) DO NOTHING;
END $$;

-- =====================================================
-- PART 9: ACCESSORIES (Small items)
-- =====================================================

DO $$
DECLARE
    accessories_category_id UUID;
    led_curtain_id UUID;
    tape_id UUID;
    stickers_id UUID;
    corners_id UUID;
    marker_id UUID;
BEGIN
    SELECT id INTO accessories_category_id FROM categories WHERE slug = 'accessories';

    -- LED Curtain
    INSERT INTO products (name, slug, description, price, categories_id, is_active)
    VALUES ('Світлодіодна гірлянда-штора 3×3 м', 'led-curtain', 'Декоративна гірлянда', 299, accessories_category_id, true)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO led_curtain_id;

    IF led_curtain_id IS NULL THEN SELECT id INTO led_curtain_id FROM products WHERE slug = 'led-curtain'; END IF;

    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    (led_curtain_id, 'LED-CURTAIN-WARM', 299, 50, '{"Колір світла": "Теплий білий"}', true),
    (led_curtain_id, 'LED-CURTAIN-COLD', 299, 50, '{"Колір світла": "Холодний білий"}', true)
    ON CONFLICT (sku) DO NOTHING;

    -- Double-sided tape
    INSERT INTO products (name, slug, description, price, categories_id, is_active)
    VALUES ('Скотч двосторонній', 'double-sided-tape', 'Для альбомів та скрапбукінгу', 35, accessories_category_id, true)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO tape_id;

    IF tape_id IS NULL THEN SELECT id INTO tape_id FROM products WHERE slug = 'double-sided-tape'; END IF;

    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    (tape_id, 'TAPE-DOUBLE', 35, 200, '{"Тип": "Двосторонній"}', true)
    ON CONFLICT (sku) DO NOTHING;

    -- Stickers
    INSERT INTO products (name, slug, description, price, categories_id, is_active)
    VALUES ('Стікери', 'stickers', 'Декоративні наліпки для альбомів', 95, accessories_category_id, true)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO stickers_id;

    IF stickers_id IS NULL THEN SELECT id INTO stickers_id FROM products WHERE slug = 'stickers'; END IF;

    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    (stickers_id, 'STICKERS-PACK', 95, 100, '{"Тип": "Набір"}', true)
    ON CONFLICT (sku) DO NOTHING;

    -- Photo corners
    INSERT INTO products (name, slug, description, price, categories_id, is_active)
    VALUES ('Кутики для фото', 'photo-corners', 'Кутики для фіксації фото в альбомі', 45, accessories_category_id, true)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO corners_id;

    IF corners_id IS NULL THEN SELECT id INTO corners_id FROM products WHERE slug = 'photo-corners'; END IF;

    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    (corners_id, 'CORNERS-GOLD', 45, 100, '{"Колір": "Золотий"}', true),
    (corners_id, 'CORNERS-SILVER', 45, 100, '{"Колір": "Срібний"}', true),
    (corners_id, 'CORNERS-BLACK', 45, 100, '{"Колір": "Чорний"}', true)
    ON CONFLICT (sku) DO NOTHING;

    -- Markers
    INSERT INTO products (name, slug, description, price, categories_id, is_active)
    VALUES ('Маркер', 'marker', 'Для підписів в альбомах', 35, accessories_category_id, true)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO marker_id;

    IF marker_id IS NULL THEN SELECT id INTO marker_id FROM products WHERE slug = 'marker'; END IF;

    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    (marker_id, 'MARKER-BLACK', 35, 100, '{"Колір": "Чорний"}', true),
    (marker_id, 'MARKER-GOLD', 45, 100, '{"Колір": "Золотий"}', true),
    (marker_id, 'MARKER-SILVER', 45, 100, '{"Колір": "Срібний"}', true),
    (marker_id, 'MARKER-WHITE', 45, 100, '{"Колір": "Білий"}', true)
    ON CONFLICT (sku) DO NOTHING;
END $$;

-- =====================================================
-- PART 10: OTHER GIFT ITEMS
-- =====================================================

DO $$
DECLARE
    gifts_category_id UUID;
    vision_board_id UUID;
    song_id UUID;
BEGIN
    SELECT id INTO gifts_category_id FROM categories WHERE slug = 'gifts';

    -- Vision board
    INSERT INTO products (name, slug, description, price, categories_id, is_active)
    VALUES ('Карта візуалізації бажань', 'vision-board', 'Карта для візуалізації цілей', 1199, gifts_category_id, true)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO vision_board_id;

    IF vision_board_id IS NULL THEN SELECT id INTO vision_board_id FROM products WHERE slug = 'vision-board'; END IF;

    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    (vision_board_id, 'VISION-BOARD-A2', 1199, 50, '{"Розмір": "A2"}', true)
    ON CONFLICT (sku) DO NOTHING;

    -- Custom song
    INSERT INTO products (name, slug, description, price, categories_id, is_active)
    VALUES ('Індивідуальна пісня на замовлення', 'custom-song', 'Унікальна пісня для вашої події', 499, gifts_category_id, true)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO song_id;

    IF song_id IS NULL THEN SELECT id INTO song_id FROM products WHERE slug = 'custom-song'; END IF;

    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    (song_id, 'SONG-CUSTOM', 499, 10, '{"Тип": "На замовлення"}', true)
    ON CONFLICT (sku) DO NOTHING;
END $$;

-- =====================================================
-- VERIFICATION: Check all products imported
-- =====================================================

SELECT
    c.name as category,
    p.name as product,
    COUNT(pv.id) as variants,
    MIN(pv.price) as price_from,
    MAX(pv.price) as price_to
FROM products p
LEFT JOIN categories c ON p.categories_id = c.id
LEFT JOIN product_variants pv ON p.id = pv.product_id
WHERE p.is_active = true
GROUP BY c.name, p.name
ORDER BY c.name, p.name;

-- Count total products
SELECT COUNT(*) as total_products FROM products WHERE is_active = true;

-- Count products by category
SELECT c.name, COUNT(p.id) as product_count
FROM categories c
LEFT JOIN products p ON c.id = p.categories_id AND p.is_active = true
GROUP BY c.name
ORDER BY product_count DESC;
