-- Migration: Separate Posters into own category with A3 and A4 only
-- Remove A1/A2 posters, move from photoprint to posters category

-- Create posters category if it doesn't exist
INSERT INTO public.categories (name, slug, is_active, sort_order)
VALUES ('Постери', 'posters', true, 50)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

-- Delete A1 and A2 poster products (business doesn't offer these sizes)
DELETE FROM public.products
WHERE (name ILIKE '%постер%' OR name ILIKE '%poster%' OR name ILIKE '%плакат%')
  AND (name ILIKE '%A1%' OR name ILIKE '%A2%' OR name ILIKE '%a1%' OR name ILIKE '%a2%');

-- Delete any existing poster products to start fresh
DELETE FROM public.products
WHERE slug IN ('poster-a3', 'poster-a4', 'poster-a-3', 'poster-a-4');

-- Product 1: Poster A3
INSERT INTO public.products (
    name,
    slug,
    category_id,
    price,
    price_from,
    short_description,
    description,
    is_active,
    images,
    options
) VALUES (
    'Постер A3',
    'poster-a3',
    (SELECT id FROM public.categories WHERE slug = 'posters' LIMIT 1),
    60,
    60,
    'Високоякісний постер формату A3 (30×42 см) на преміальному папері Fujicolor.',
    'Для друку постерів ми використовуємо фотопапір Fujicolor Crystal Archive з гарантійним терміном зберігання фото більше 100 років, та неперевершеним спектром кольоропередачі. Друк здійснюється фотохімічним методом.

Формат: A3 (30×42 см). Папір може бути матовим або глянцевим.',
    true,
    ARRAY['https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=80']::text[],
    '[
        {
            "name": "Покриття",
            "values": [
                {"name": "Глянцеве", "priceModifier": 0},
                {"name": "Матове", "priceModifier": 0}
            ]
        }
    ]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    category_id = EXCLUDED.category_id,
    price = EXCLUDED.price,
    price_from = EXCLUDED.price_from,
    description = EXCLUDED.description,
    images = EXCLUDED.images,
    options = EXCLUDED.options,
    is_active = EXCLUDED.is_active;

-- Product 2: Poster A4
INSERT INTO public.products (
    name,
    slug,
    category_id,
    price,
    price_from,
    short_description,
    description,
    is_active,
    images,
    options
) VALUES (
    'Постер A4',
    'poster-a4',
    (SELECT id FROM public.categories WHERE slug = 'posters' LIMIT 1),
    30,
    30,
    'Високоякісний постер формату A4 (21×30 см) на преміальному папері Fujicolor.',
    'Для друку постерів ми використовуємо фотопапір Fujicolor Crystal Archive з гарантійним терміном зберігання фото більше 100 років, та неперевершеним спектром кольоропередачі. Друк здійснюється фотохімічним методом.

Формат: A4 (21×30 см). Папір може бути матовим або глянцевим.',
    true,
    ARRAY['https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=80']::text[],
    '[
        {
            "name": "Покриття",
            "values": [
                {"name": "Глянцеве", "priceModifier": 0},
                {"name": "Матове", "priceModifier": 0}
            ]
        }
    ]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    category_id = EXCLUDED.category_id,
    price = EXCLUDED.price,
    price_from = EXCLUDED.price_from,
    description = EXCLUDED.description,
    images = EXCLUDED.images,
    options = EXCLUDED.options,
    is_active = EXCLUDED.is_active;

-- Update any remaining poster products to use posters category
UPDATE public.products
SET category_id = (SELECT id FROM public.categories WHERE slug = 'posters' LIMIT 1)
WHERE (name ILIKE '%постер%' OR name ILIKE '%poster%' OR name ILIKE '%плакат%')
  AND category_id != (SELECT id FROM public.categories WHERE slug = 'posters' LIMIT 1);
