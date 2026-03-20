-- ============================================================
-- MIGRATION: Fix Photomagnet Products
-- ============================================================
-- Remove non-existent sizes (50x50, round magnets)
-- Create single photomagnet product with size variants
-- ============================================================

-- ─────────────────────────────────────────────────────────
-- STEP 1: Delete/deactivate incorrect photomagnet products
-- ─────────────────────────────────────────────────────────

-- Delete 50x50 square magnets (doesn't exist in real business)
DELETE FROM public.products
WHERE (name ILIKE '%фотомагніт%' OR name ILIKE '%магніт%')
  AND (name ILIKE '%50×50%' OR name ILIKE '%50x50%' OR name ILIKE '%50 × 50%');

-- Delete round/circular magnets (doesn't exist in real business)
DELETE FROM public.products
WHERE (name ILIKE '%фотомагніт%' OR name ILIKE '%магніт%')
  AND (name ILIKE '%круглий%' OR name ILIKE '%круглі%' OR name ILIKE '%circle%' OR name ILIKE '%round%');

-- ─────────────────────────────────────────────────────────
-- STEP 2: Create/update photomagnets category
-- ─────────────────────────────────────────────────────────

INSERT INTO public.categories (name, slug, is_active, sort_order)
VALUES ('Фотомагніти', 'photomagnets', true, 70)
ON CONFLICT (slug)
DO UPDATE SET
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

-- ─────────────────────────────────────────────────────────
-- STEP 3: Delete all existing photomagnet products for clean slate
-- ─────────────────────────────────────────────────────────

DELETE FROM public.products
WHERE name ILIKE '%фотомагніт%' OR name ILIKE '%магніт%' OR slug ILIKE '%magnet%';

-- ─────────────────────────────────────────────────────────
-- STEP 4: Create single photomagnet product with size options
-- ─────────────────────────────────────────────────────────

INSERT INTO public.products (
    name,
    slug,
    category_id,
    price,
    price_from,
    description,
    short_description,
    images,
    is_active,
    options
) VALUES (
    'Фотомагніти',
    'photomagnets',
    (SELECT id FROM public.categories WHERE slug = 'photomagnets' LIMIT 1),
    15, -- Base price for smallest size (5×7.5 cm)
    15, -- Price from
    E'Для друку фотомагнітів ми використовуємо фотопапір Fujicolor Crystal Archive з гарантійним терміном зберігання фото більше 100 років, та неперевершеним спектром кольоропередачі. Друк здійснюється фотохімічним методом.\n\nФотомагніт — це чудовий спосіб прикрасити холодильник або будь-яку металеву поверхню вашими улюбленими фотографіями. Наші фотомагніти виготовляються на якісній магнітній основі та мають стійке до вицвітання зображення.',
    'Фотомагніти на холодильник. Друк на фотопапері Fujicolor Crystal Archive з магнітною основою.',
    ARRAY['https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=80']::text[],
    true,
    '[
        {
            "name": "Розмір",
            "values": [
                {"name": "5×7.5 см", "priceModifier": 0},
                {"name": "7×10 см", "priceModifier": 5},
                {"name": "9×13 см", "priceModifier": 10},
                {"name": "10×15 см", "priceModifier": 15},
                {"name": "13×18 см", "priceModifier": 25}
            ]
        }
    ]'::jsonb
)
ON CONFLICT (slug)
DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    price_from = EXCLUDED.price_from,
    description = EXCLUDED.description,
    short_description = EXCLUDED.short_description,
    images = EXCLUDED.images,
    is_active = EXCLUDED.is_active,
    options = EXCLUDED.options,
    category_id = EXCLUDED.category_id;

-- ─────────────────────────────────────────────────────────
-- STEP 5: Add helpful comments
-- ─────────────────────────────────────────────────────────

COMMENT ON COLUMN public.products.options IS 'JSONB options for product configuration (sizes, quantities, finishes, etc.)';

-- ─────────────────────────────────────────────────────────
-- Migration complete
-- ─────────────────────────────────────────────────────────
-- Available photomagnet sizes:
-- - 5×7.5 см (15₴ base)
-- - 7×10 см (+5₴ = 20₴)
-- - 9×13 см (+10₴ = 25₴)
-- - 10×15 см (+15₴ = 30₴)
-- - 13×18 см (+25₴ = 40₴)
--
-- Order flow: /order/photomagnets
-- Upload → Visualization → Confirmation
-- ============================================================
