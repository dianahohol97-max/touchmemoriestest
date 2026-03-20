-- Migration: Restructure photobook products with 4 cover types
-- Remove old photobook products and add 4 new cover type products

-- Delete old photobook products (if they exist)
DELETE FROM public.products WHERE slug IN ('photobook', 'photobook-standard', 'photobook-premium');

-- Insert 4 photobook cover type products

-- Product 1: Velour cover
INSERT INTO public.products (
    name,
    slug,
    category_id,
    price,
    description,
    is_active,
    variants
) VALUES (
    'Фотокнига з велюровою обкладинкою',
    'photobook-velour',
    (SELECT id FROM public.categories WHERE slug = 'photobooks' LIMIT 1),
    1050,
    'Фотокнига з велюровою обкладинкою ідеально підійде, щоб зберегти найважливіші спогади. У нас ви можете отримати макет обкладинки та книги в подарунок, а також у нас гарантія якості 100 років.

За бажанням можна додати кальку (першу напівпрозору сторінку з надписом або фото). Вартість калька — 280 грн.

Кількість правок необмежена. Термін виготовлення — 14 робочих днів.',
    true,
    '[
        {"name": "20×20 см", "price": 1050},
        {"name": "25×25 см", "price": 1250},
        {"name": "20×30 см (книжкова)", "price": 1150},
        {"name": "30×20 см (альбомна)", "price": 1150},
        {"name": "30×30 см", "price": 1450}
    ]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    description = EXCLUDED.description,
    variants = EXCLUDED.variants;

-- Product 2: Printed cover (hard binding)
INSERT INTO public.products (
    name,
    slug,
    category_id,
    price,
    description,
    is_active,
    variants
) VALUES (
    'Фотокнига з друкованою обкладинкою (тверда палітурка)',
    'photobook-printed',
    (SELECT id FROM public.categories WHERE slug = 'photobooks' LIMIT 1),
    450,
    'Фотокниги — ідеальний спосіб зберегти спогади. У нас ви можете отримати макет обкладинки та книги в подарунок, а також у нас гарантія якості 100 років.

За бажанням можна додати кальку (першу напівпрозору сторінку з надписом або фото). Вартість калька — 280 грн. Для захисту від подряпин використовується глянцева або матова ламінація обкладинки.

Кількість правок необмежена. Термін виготовлення — 14 робочих днів.',
    true,
    '[
        {"name": "20×20 см", "price": 450},
        {"name": "25×25 см", "price": 550},
        {"name": "20×30 см (книжкова)", "price": 500},
        {"name": "30×20 см (альбомна)", "price": 500},
        {"name": "30×30 см", "price": 650}
    ]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    description = EXCLUDED.description,
    variants = EXCLUDED.variants;

-- Product 3: Leatherette cover
INSERT INTO public.products (
    name,
    slug,
    category_id,
    price,
    description,
    is_active,
    variants
) VALUES (
    'Фотокнига з обкладинкою зі шкірзамінника',
    'photobook-leatherette',
    (SELECT id FROM public.categories WHERE slug = 'photobooks' LIMIT 1),
    1050,
    'Фотокнига з обкладинкою зі шкірзамінника ідеально підійде, щоб зберегти найважливіші спогади. У нас ви можете отримати макет обкладинки та книги в подарунок, а також у нас гарантія якості 100 років.

За бажанням можна додати кальку (першу напівпрозору сторінку з надписом або фото). Вартість калька — 280 грн.

Кількість правок необмежена. Термін виготовлення — 14 робочих днів.',
    true,
    '[
        {"name": "20×20 см", "price": 1050},
        {"name": "25×25 см", "price": 1250},
        {"name": "20×30 см (книжкова)", "price": 1150},
        {"name": "30×20 см (альбомна)", "price": 1150},
        {"name": "30×30 см", "price": 1450}
    ]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    description = EXCLUDED.description,
    variants = EXCLUDED.variants;

-- Product 4: Fabric cover
INSERT INTO public.products (
    name,
    slug,
    category_id,
    price,
    description,
    is_active,
    variants
) VALUES (
    'Фотокнига з обкладинкою з тканини',
    'photobook-fabric',
    (SELECT id FROM public.categories WHERE slug = 'photobooks' LIMIT 1),
    1050,
    'Фотокнига з обкладинкою з тканини ідеально підійде, щоб зберегти найважливіші спогади. У нас ви можете отримати макет обкладинки та книги в подарунок, а також у нас гарантія якості 100 років.

За бажанням можна додати кальку (першу напівпрозору сторінку з надписом або фото). Вартість калька — 280 грн.

Кількість правок необмежена. Термін виготовлення — 14 робочих днів.',
    true,
    '[
        {"name": "20×20 см", "price": 1050},
        {"name": "25×25 см", "price": 1250},
        {"name": "20×30 см (книжкова)", "price": 1150},
        {"name": "30×20 см (альбомна)", "price": 1150},
        {"name": "30×30 см", "price": 1450}
    ]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    description = EXCLUDED.description,
    variants = EXCLUDED.variants;
