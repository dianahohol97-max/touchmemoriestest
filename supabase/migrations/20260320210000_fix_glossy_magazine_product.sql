-- Migration: Fix glossy magazine product
-- Rename, add image, add cover type options, clean up data

-- Update glossy magazine product name and slug
UPDATE public.products
SET
    name = 'Персональний глянцевий журнал',
    slug = 'personalized-glossy-magazine',
    images = ARRAY['https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&q=80']::text[],
    sale_price = NULL,
    short_description = 'Створіть унікальний глянцевий журнал з вашими фотографіями. Преміальна якість друку на глянцевому папері.',
    description = 'Персональний глянцевий журнал — це ідеальний спосіб зберегти ваші найкращі спогади у форматі професійного видання. Друк на преміальному глянцевому папері забезпечує яскраві кольори та чіткість зображення.

За бажанням можна обрати тверду обкладинку (як у фотокниги) для додаткового захисту та презентабельного вигляду.

Кількість правок необмежена. Термін виготовлення — 4–8 робочих днів.',
    options = '[
        {
            "name": "Тип обкладинки",
            "values": [
                {"name": "М'\''яка обкладинка", "priceModifier": 0},
                {"name": "Тверда обкладинка (як книга)", "priceModifier": 150}
            ]
        },
        {
            "name": "Кількість сторінок",
            "values": [
                {"name": "20 сторінок", "priceModifier": 0},
                {"name": "24 сторінки", "priceModifier": 50},
                {"name": "28 сторінок", "priceModifier": 100},
                {"name": "32 сторінки", "priceModifier": 150},
                {"name": "36 сторінок", "priceModifier": 200}
            ]
        },
        {
            "name": "Кількість примірників",
            "values": [
                {"name": "1 примірник", "priceModifier": 0},
                {"name": "2 примірники", "priceModifier": 300},
                {"name": "3 примірники", "priceModifier": 600},
                {"name": "5 примірників", "priceModifier": 1000}
            ]
        }
    ]'::jsonb
WHERE slug = 'glossy-magazine' OR slug = 'hlyantsevy-zhurnal' OR name LIKE '%Глянцевий журнал%' OR name LIKE '%глянцевий журнал%';

-- If no product was found with above conditions, try to find by category
UPDATE public.products
SET
    name = 'Персональний глянцевий журнал',
    slug = 'personalized-glossy-magazine',
    images = ARRAY['https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&q=80']::text[],
    sale_price = NULL,
    short_description = 'Створіть унікальний глянцевий журнал з вашими фотографіями. Преміальна якість друку на глянцевому папері.',
    description = 'Персональний глянцевий журнал — це ідеальний спосіб зберегти ваші найкращі спогади у форматі професійного видання. Друк на преміальному глянцевому папері забезпечує яскраві кольори та чіткість зображення.

За бажанням можна обрати тверду обкладинку (як у фотокниги) для додаткового захисту та презентабельного вигляду.

Кількість правок необмежена. Термін виготовлення — 4–8 робочих днів.',
    options = '[
        {
            "name": "Тип обкладинки",
            "values": [
                {"name": "М'\''яка обкладинка", "priceModifier": 0},
                {"name": "Тверда обкладинка (як книга)", "priceModifier": 150}
            ]
        },
        {
            "name": "Кількість сторінок",
            "values": [
                {"name": "20 сторінок", "priceModifier": 0},
                {"name": "24 сторінки", "priceModifier": 50},
                {"name": "28 сторінок", "priceModifier": 100},
                {"name": "32 сторінки", "priceModifier": 150},
                {"name": "36 сторінок", "priceModifier": 200}
            ]
        },
        {
            "name": "Кількість примірників",
            "values": [
                {"name": "1 примірник", "priceModifier": 0},
                {"name": "2 примірники", "priceModifier": 300},
                {"name": "3 примірники", "priceModifier": 600},
                {"name": "5 примірників", "priceModifier": 1000}
            ]
        }
    ]'::jsonb
WHERE category_id IN (SELECT id FROM public.categories WHERE slug IN ('magazines', 'journals', 'zhurnaly'))
  AND slug != 'personalized-glossy-magazine'
  AND NOT EXISTS (SELECT 1 FROM public.products WHERE slug = 'personalized-glossy-magazine')
LIMIT 1;
