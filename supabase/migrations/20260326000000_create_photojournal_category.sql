-- Migration: Create photojournal category for hard cover magazines
-- This fixes the broken "Журнал з твердою обкладинкою" button on homepage

-- Insert photojournal category if it doesn't exist
INSERT INTO public.categories (name, slug, description, is_active, sort_order)
VALUES (
    'Журнал з твердою обкладинкою',
    'photojournal',
    'Преміум фотожурнали з твердою обкладинкою - стильний формат для збереження спогадів',
    true,
    4
)
ON CONFLICT (slug) DO UPDATE
SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

-- Create a photojournal product if one doesn't exist
-- This ensures the category shows at least one product
INSERT INTO public.products (
    name,
    slug,
    price,
    price_from,
    category_id,
    short_description,
    description,
    images,
    is_active,
    is_personalized,
    format,
    default_pages
)
SELECT
    'Фотожурнал з твердою обкладинкою',
    'photojournal-hard-cover-a4',
    600,
    true,
    (SELECT id FROM public.categories WHERE slug = 'photojournal'),
    'Створіть професійний фотожурнал з твердою обкладинкою. Формат A4, глянцевий папір 170г/м², тверда палітурка.',
    'Фотожурнал з твердою обкладинкою - це поєднання стильного журнального формату та надійності фотокниги. Ідеально підходить для:

• Професійних портфоліо
• Корпоративних видань
• Подорожніх журналів
• Сімейних хронік

**Характеристики:**
- Формат: A4 (21×29.7 см)
- Папір: глянцевий 170 г/м²
- Обкладинка: тверда палітурка з друком
- Від 12 до 80 сторінок
- Термін виготовлення: 5-7 робочих днів

**Відмінності від глянцевого журналу:**
Фотожурнал має тверду обкладинку, як у класичній фотокниги, що забезпечує додатковий захист та презентабельний вигляд.',
    ARRAY['https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&q=80']::text[],
    true,
    true,
    'A4',
    20
WHERE NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE slug = 'photojournal-hard-cover-a4'
);
