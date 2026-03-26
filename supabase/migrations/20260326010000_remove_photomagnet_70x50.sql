-- Migration: Remove product "Фотомагніт прямокутний 70×50 мм"
-- This product should not appear on the public site

-- Soft-delete (archive) the product by setting is_active = false
-- This preserves the data in case it's referenced in old orders
UPDATE public.products
SET is_active = false
WHERE (
    name ILIKE '%70×50%'
    OR name ILIKE '%70x50%'
    OR name ILIKE '%70 × 50%'
    OR name ILIKE '%70 x 50%'
)
AND (
    name ILIKE '%фотомагніт%'
    OR name ILIKE '%магніт%'
    OR slug ILIKE '%magnet%'
);

-- Alternative: If the product should be hard-deleted (uncomment if needed)
-- DELETE FROM public.products
-- WHERE (
--     name ILIKE '%70×50%'
--     OR name ILIKE '%70x50%'
--     OR name ILIKE '%70 × 50%'
--     OR name ILIKE '%70 x 50%'
-- )
-- AND (
--     name ILIKE '%фотомагніт%'
--     OR name ILIKE '%магніт%'
--     OR slug ILIKE '%magnet%'
-- );
