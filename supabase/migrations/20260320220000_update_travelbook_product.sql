-- Migration: Update TravelBook product with correct size and new options
-- Change size from 21×21 to 20×30, add pages/cover/quantity options

UPDATE public.products
SET
    name = 'Travel Book — журнал твоєї подорожі',
    short_description = 'Створіть унікальний журнал вашої подорожі у форматі 20×30 см. Глянцевий папір, тверда обкладинка, персональний дизайн.',
    description = 'Travel Book — це персональний журнал вашої подорожі у преміальному форматі 20×30 см (книжкова орієнтація). Тверда обкладинка, друк на глянцевому папері, професійний макет у подарунок.

Оберіть один з варіантів дизайну обкладинки: готовий дизайн від нашої студії, шаблон з вашими фото, або повністю персоналізована обкладинка (+50 грн).

Кількість правок необмежена. Термін виготовлення — 10 робочих днів.',
    options = '[
        {
            "name": "Кількість сторінок",
            "values": [
                {"name": "12 сторінок", "priceModifier": 0},
                {"name": "16 сторінок", "priceModifier": 50},
                {"name": "20 сторінок", "priceModifier": 100},
                {"name": "24 сторінки", "priceModifier": 150},
                {"name": "32 сторінки", "priceModifier": 250},
                {"name": "40 сторінок", "priceModifier": 350},
                {"name": "48 сторінок", "priceModifier": 450},
                {"name": "56 сторінок", "priceModifier": 550},
                {"name": "64 сторінки", "priceModifier": 650},
                {"name": "72 сторінки", "priceModifier": 750},
                {"name": "80 сторінок", "priceModifier": 850}
            ]
        },
        {
            "name": "Обкладинка",
            "values": [
                {"name": "Наш дизайн", "priceModifier": 0},
                {"name": "Наш шаблон + ваші фото", "priceModifier": 0},
                {"name": "Персоналізована обкладинка", "priceModifier": 50}
            ]
        },
        {
            "name": "Кількість примірників",
            "values": [
                {"name": "1 примірник", "priceModifier": 0},
                {"name": "2 примірники", "priceModifier": 550},
                {"name": "3 примірники", "priceModifier": 1100},
                {"name": "4 примірники", "priceModifier": 1650},
                {"name": "5 примірників", "priceModifier": 2200}
            ]
        }
    ]'::jsonb
WHERE slug = 'travelbook' OR slug = 'travel-book' OR name LIKE '%Travel Book%' OR name LIKE '%TravelBook%';

-- If no product was found with above conditions, try to find by category
UPDATE public.products
SET
    name = 'Travel Book — журнал твоєї подорожі',
    short_description = 'Створіть унікальний журнал вашої подорожі у форматі 20×30 см. Глянцевий папір, тверда обкладинка, персональний дизайн.',
    description = 'Travel Book — це персональний журнал вашої подорожі у преміальному форматі 20×30 см (книжкова орієнтація). Тверда обкладинка, друк на глянцевому папері, професійний макет у подарунок.

Оберіть один з варіантів дизайну обкладинки: готовий дизайн від нашої студії, шаблон з вашими фото, або повністю персоналізована обкладинка (+50 грн).

Кількість правок необмежена. Термін виготовлення — 10 робочих днів.',
    options = '[
        {
            "name": "Кількість сторінок",
            "values": [
                {"name": "12 сторінок", "priceModifier": 0},
                {"name": "16 сторінок", "priceModifier": 50},
                {"name": "20 сторінок", "priceModifier": 100},
                {"name": "24 сторінки", "priceModifier": 150},
                {"name": "32 сторінки", "priceModifier": 250},
                {"name": "40 сторінок", "priceModifier": 350},
                {"name": "48 сторінок", "priceModifier": 450},
                {"name": "56 сторінок", "priceModifier": 550},
                {"name": "64 сторінки", "priceModifier": 650},
                {"name": "72 сторінки", "priceModifier": 750},
                {"name": "80 сторінок", "priceModifier": 850}
            ]
        },
        {
            "name": "Обкладинка",
            "values": [
                {"name": "Наш дизайн", "priceModifier": 0},
                {"name": "Наш шаблон + ваші фото", "priceModifier": 0},
                {"name": "Персоналізована обкладинка", "priceModifier": 50}
            ]
        },
        {
            "name": "Кількість примірників",
            "values": [
                {"name": "1 примірник", "priceModifier": 0},
                {"name": "2 примірники", "priceModifier": 550},
                {"name": "3 примірники", "priceModifier": 1100},
                {"name": "4 примірники", "priceModifier": 1650},
                {"name": "5 примірників", "priceModifier": 2200}
            ]
        }
    ]'::jsonb
WHERE category_id IN (SELECT id FROM public.categories WHERE slug IN ('travelbooks', 'travel-books', 'travel'))
  AND (slug != 'travelbook' AND slug != 'travel-book')
  AND NOT EXISTS (SELECT 1 FROM public.products WHERE slug IN ('travelbook', 'travel-book'))
LIMIT 1;
