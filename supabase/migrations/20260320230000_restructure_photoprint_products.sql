-- Migration: Restructure photoprint products into 3 distinct products
-- Standard sizes, non-standard sizes, and Polaroid prints

-- First, delete any existing photoprint products
DELETE FROM public.products WHERE category_id IN (
    SELECT id FROM public.categories WHERE slug IN ('photoprint', 'prints', 'photo-prints')
);

-- Product 1: Standard Photo Prints
INSERT INTO public.products (
    name,
    slug,
    category_id,
    price,
    price_from,
    short_description,
    description,
    is_active,
    options
) VALUES (
    'Фотодрук (стандартні розміри)',
    'photoprint-standard',
    (SELECT id FROM public.categories WHERE slug IN ('photoprint', 'prints', 'photo-prints') LIMIT 1),
    8,
    8,
    'Професійний фотодрук на преміальному папері Fujicolor. Термін зберігання 100+ років.',
    'Для друку фото ми використовуємо фотопапір Fujicolor Crystal Archive з гарантійним терміном зберігання фото більше 100 років, та неперевершеним спектром кольоропередачі. Друк здійснюється фотохімічним методом.

Папір може бути матовим або глянцевим.',
    true,
    '[
        {
            "name": "Розмір",
            "values": [
                {"name": "10×15 см", "priceModifier": 0, "price": 8},
                {"name": "13×18 см", "priceModifier": 4, "price": 12},
                {"name": "15×21 см", "priceModifier": 7, "price": 15},
                {"name": "20×25 см", "priceModifier": 17, "price": 25},
                {"name": "20×30 см", "priceModifier": 22, "price": 30},
                {"name": "30×40 см", "priceModifier": 52, "price": 60}
            ]
        },
        {
            "name": "Покриття",
            "values": [
                {"name": "Глянцеве", "priceModifier": 0},
                {"name": "Матове", "priceModifier": 0}
            ]
        },
        {
            "name": "Біла рамочка 3мм",
            "values": [
                {"name": "Так", "priceModifier": 0},
                {"name": "Ні", "priceModifier": 0}
            ]
        }
    ]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    price_from = EXCLUDED.price_from,
    description = EXCLUDED.description,
    options = EXCLUDED.options;

-- Product 2: Non-standard Photo Prints
INSERT INTO public.products (
    name,
    slug,
    category_id,
    price,
    price_from,
    short_description,
    description,
    is_active,
    options
) VALUES (
    'Фотодрук (нестандартні розміри)',
    'photoprint-nonstandard',
    (SELECT id FROM public.categories WHERE slug IN ('photoprint', 'prints', 'photo-prints') LIMIT 1),
    7.5,
    7.5,
    'Фотодрук будь-якого розміру на преміальному папері Fujicolor. Біла рамочка 3мм включена.',
    'Для друку фото ми використовуємо фотопапір Fujicolor Crystal Archive з гарантійним терміном зберігання фото більше 100 років, та неперевершеним спектром кольоропередачі. Друк здійснюється фотохімічним методом.

Папір може бути матовим або глянцевим.

Примітка: Біла рамочка 3мм включена автоматично для всіх нестандартних розмірів.',
    true,
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
    price = EXCLUDED.price,
    price_from = EXCLUDED.price_from,
    description = EXCLUDED.description,
    options = EXCLUDED.options;

-- Product 3: Polaroid Prints
INSERT INTO public.products (
    name,
    slug,
    category_id,
    price,
    short_description,
    description,
    is_active,
    options
) VALUES (
    'Полароїд',
    'polaroid-print',
    (SELECT id FROM public.categories WHERE slug IN ('photoprint', 'prints', 'photo-prints') LIMIT 1),
    7.5,
    'Друк у класичному форматі Polaroid (8.9×10.7 см). Місце для підпису внизу.',
    'Для друку фото ми використовуємо фотопапір Fujicolor Crystal Archive з гарантійним терміном зберігання фото більше 100 років. Розмір: 8.9×10.7 см (класичний Polaroid формат). Унизу є місце для підпису (білий простір).',
    true,
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
    price = EXCLUDED.price,
    description = EXCLUDED.description,
    options = EXCLUDED.options;

-- Add images to products (using Unsplash placeholders)
UPDATE public.products
SET images = ARRAY['https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=800&q=80']::text[]
WHERE slug = 'photoprint-standard';

UPDATE public.products
SET images = ARRAY['https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=800&q=80']::text[]
WHERE slug = 'photoprint-nonstandard';

UPDATE public.products
SET images = ARRAY['https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&q=80']::text[]
WHERE slug = 'polaroid-print';
