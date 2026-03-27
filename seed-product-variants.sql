-- =====================================================
-- SEED PRODUCT VARIANTS FOR MISSING PRODUCTS
-- Run this in Supabase Dashboard SQL Editor
-- =====================================================
-- These products exist but have 0 variants (no prices, no options)
-- User cannot order them until variants are created
-- =====================================================

-- NOTE: This is a SAMPLE template. You need to:
-- 1. Get the actual product IDs from the products table
-- 2. Customize sizes, prices, and attributes per product
-- 3. Run INSERT statements for each variant

-- =====================================================
-- EXAMPLE: Фотомагніти (7 size variants)
-- =====================================================

-- First, get the product ID
-- SELECT id FROM products WHERE slug = 'photomagnets' OR name LIKE '%Фотомагніт%';

-- Then insert variants (replace <product_id> with actual UUID)
/*
INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
-- Size: 5×7.5 см
('<product_id>', 'MAGNET-5x7.5', 215, 1000, '{"size": "5×7.5 см", "quantity": "9 шт"}', true),

-- Size: 6×9 см
('<product_id>', 'MAGNET-6x9', 215, 1000, '{"size": "6×9 см", "quantity": "9 шт"}', true),

-- Size: 7.5×10 см
('<product_id>', 'MAGNET-7.5x10', 215, 1000, '{"size": "7.5×10 см", "quantity": "9 шт"}', true),

-- Size: 9×9 см
('<product_id>', 'MAGNET-9x9', 215, 1000, '{"size": "9×9 см", "quantity": "9 шт"}', true),

-- Size: 10×10 см
('<product_id>', 'MAGNET-10x10', 215, 1000, '{"size": "10×10 см", "quantity": "9 шт"}', true),

-- Size: Polaroid 7.6×10.1 см
('<product_id>', 'MAGNET-POLAROID-1', 215, 1000, '{"size": "Polaroid 7.6×10.1 см", "quantity": "9 шт"}', true),

-- Size: Polaroid 8.6×5.4 см
('<product_id>', 'MAGNET-POLAROID-2', 215, 1000, '{"size": "Polaroid 8.6×5.4 см", "quantity": "9 шт"}', true);
*/

-- =====================================================
-- EXAMPLE: Polaroid Prints
-- =====================================================

-- Get product ID
-- SELECT id FROM products WHERE slug = 'polaroid-print' OR name LIKE '%Polaroid%';

-- Insert variant
/*
INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
('<product_id>', 'POLAROID-PRINT', 7.5, 10000, '{"size": "7.5×10 см", "finish": "Глянець"}', true);
*/

-- =====================================================
-- EXAMPLE: Настільний календар
-- =====================================================

-- Get product ID
-- SELECT id FROM products WHERE slug LIKE '%desk-calendar%' OR name LIKE '%Настільний календар%';

-- Insert variant
/*
INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
('<product_id>', 'DESK-CALENDAR-2026', 299, 100, '{"year": "2026", "size": "10×15 см"}', true);
*/

-- =====================================================
-- EXAMPLE: Настінний календар A3
-- =====================================================

-- Get product ID
-- SELECT id FROM products WHERE slug LIKE '%wall-calendar%' OR name LIKE '%Настінний календар%';

-- Insert variants
/*
INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
-- Size A3
('<product_id>', 'WALL-CALENDAR-A3-2026', 690, 100, '{"year": "2026", "size": "A3"}', true),

-- Size A4
('<product_id>', 'WALL-CALENDAR-A4-2026', 590, 100, '{"year": "2026", "size": "A4"}', true);
*/

-- =====================================================
-- EXAMPLE: Пазл A4
-- =====================================================

-- Get product ID
-- SELECT id FROM products WHERE slug LIKE '%puzzle%' OR name LIKE '%Пазл%';

-- Insert variants
/*
INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
-- Size 15×21 см
('<product_id>', 'PUZZLE-15x21', 349, 500, '{"size": "15×21 см"}', true),

-- Size 20×30 см
('<product_id>', 'PUZZLE-20x30', 249, 500, '{"size": "20×30 см"}', true);
*/

-- =====================================================
-- EXAMPLE: Книга побажань (15 variants)
-- =====================================================

-- Get product ID
-- SELECT id FROM products WHERE slug LIKE '%guest-book%' OR name LIKE '%Книга побажань%';

-- Insert variants
/*
INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
-- 23×23 cm, Друкована тверда, білі сторінки
('<product_id>', 'GUESTBOOK-23x23-PRINT-WHITE', 559, 50, '{"size": "23×23 см", "cover": "Друкована тверда", "pages": "Білі"}', true),
('<product_id>', 'GUESTBOOK-23x23-PRINT-BLACK', 559, 50, '{"size": "23×23 см", "cover": "Друкована тверда", "pages": "Чорні"}', true),
('<product_id>', 'GUESTBOOK-23x23-PRINT-CREAM', 559, 50, '{"size": "23×23 см", "cover": "Друкована тверда", "pages": "Кремові"}', true),

-- 23×23 cm, Тканина
('<product_id>', 'GUESTBOOK-23x23-FABRIC-WHITE', 659, 50, '{"size": "23×23 см", "cover": "Тканина", "pages": "Білі"}', true),
('<product_id>', 'GUESTBOOK-23x23-FABRIC-BLACK', 659, 50, '{"size": "23×23 см", "cover": "Тканина", "pages": "Чорні"}', true),
('<product_id>', 'GUESTBOOK-23x23-FABRIC-CREAM', 659, 50, '{"size": "23×23 см", "cover": "Тканина", "pages": "Кремові"}', true),

-- 23×23 cm, Велюрова
('<product_id>', 'GUESTBOOK-23x23-VELOUR-WHITE', 759, 50, '{"size": "23×23 см", "cover": "Велюрова", "pages": "Білі"}', true),
('<product_id>', 'GUESTBOOK-23x23-VELOUR-BLACK', 759, 50, '{"size": "23×23 см", "cover": "Велюрова", "pages": "Чорні"}', true),
('<product_id>', 'GUESTBOOK-23x23-VELOUR-CREAM', 759, 50, '{"size": "23×23 см", "cover": "Велюрова", "pages": "Кремові"}', true),

-- 30×20 cm variants (prices ~50 grn higher)
('<product_id>', 'GUESTBOOK-30x20-PRINT-WHITE', 609, 50, '{"size": "30×20 см", "cover": "Друкована тверда", "pages": "Білі"}', true),
('<product_id>', 'GUESTBOOK-30x20-FABRIC-WHITE', 709, 50, '{"size": "30×20 см", "cover": "Тканина", "pages": "Білі"}', true),
('<product_id>', 'GUESTBOOK-30x20-VELOUR-WHITE', 809, 50, '{"size": "30×20 см", "cover": "Велюрова", "pages": "Білі"}', true),

-- 20×30 cm variants
('<product_id>', 'GUESTBOOK-20x30-PRINT-WHITE', 609, 50, '{"size": "20×30 см", "cover": "Друкована тверда", "pages": "Білі"}', true),
('<product_id>', 'GUESTBOOK-20x30-FABRIC-WHITE', 709, 50, '{"size": "20×30 см", "cover": "Тканина", "pages": "Білі"}', true),
('<product_id>', 'GUESTBOOK-20x30-VELOUR-WHITE', 809, 50, '{"size": "20×30 см", "cover": "Велюрова", "pages": "Білі"}', true);
*/

-- =====================================================
-- STEPS TO USE THIS FILE:
-- =====================================================
-- 1. Run query to get product IDs:
--    SELECT id, name, slug FROM products WHERE name LIKE '%your_product%';
--
-- 2. Copy the product ID (UUID)
--
-- 3. Uncomment the relevant INSERT block above
--
-- 4. Replace '<product_id>' with the actual UUID
--
-- 5. Run the INSERT statement in Supabase SQL Editor
--
-- 6. Verify variants created:
--    SELECT * FROM product_variants WHERE product_id = '<product_id>';
--
-- 7. Repeat for each product
-- =====================================================

-- Verification query to check which products have 0 variants:
SELECT
    p.id,
    p.name,
    p.slug,
    COUNT(pv.id) as variant_count
FROM products p
LEFT JOIN product_variants pv ON p.id = pv.product_id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.slug
HAVING COUNT(pv.id) = 0
ORDER BY p.name;
