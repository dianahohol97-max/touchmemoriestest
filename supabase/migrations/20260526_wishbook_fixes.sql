-- Wishbook fixes — Session D
-- Applied via Supabase MCP on 2026-05-26
-- This file is for repo record-keeping; the migration has already run on production.

-- 1) Add 14 velour cover colors (single source of truth for both photobook-velour and wishbook)
-- Pulled from lib/editor/constants.ts VELOUR_COLORS — exact match with production hardcoded values.
INSERT INTO cover_colors (cover_type_id, code, name, hex_approx, sort_order, active) VALUES
  ('0472fb81-56a5-48ed-8a60-8a838b517a33', 'В-01', 'Молочний',         '#F0EAD6',  1, true),
  ('0472fb81-56a5-48ed-8a60-8a838b517a33', 'В-02', 'Бежевий',          '#D9C8B0',  2, true),
  ('0472fb81-56a5-48ed-8a60-8a838b517a33', 'В-03', 'Таупе',            '#A89880',  3, true),
  ('0472fb81-56a5-48ed-8a60-8a838b517a33', 'В-04', 'Рожевий',          '#E8B4B8',  4, true),
  ('0472fb81-56a5-48ed-8a60-8a838b517a33', 'В-05', 'Бордо',            '#7A2838',  5, true),
  ('0472fb81-56a5-48ed-8a60-8a838b517a33', 'В-06', 'Сірий перловий',   '#9A9898',  6, true),
  ('0472fb81-56a5-48ed-8a60-8a838b517a33', 'В-07', 'Лаванда',          '#B8A8C8',  7, true),
  ('0472fb81-56a5-48ed-8a60-8a838b517a33', 'В-08', 'Синій',            '#1A2040',  8, true),
  ('0472fb81-56a5-48ed-8a60-8a838b517a33', 'В-09', 'Графітовий',       '#3A3038',  9, true),
  ('0472fb81-56a5-48ed-8a60-8a838b517a33', 'В-10', 'Бірюзовий',        '#1A9090', 10, true),
  ('0472fb81-56a5-48ed-8a60-8a838b517a33', 'В-11', 'Марсала',          '#6E2840', 11, true),
  ('0472fb81-56a5-48ed-8a60-8a838b517a33', 'В-12', 'Блакитно-сірий',   '#607080', 12, true),
  ('0472fb81-56a5-48ed-8a60-8a838b517a33', 'В-13', 'Темно-зелений',    '#1E3028', 13, true),
  ('0472fb81-56a5-48ed-8a60-8a838b517a33', 'В-14', 'Жовтий',           '#D4A020', 14, true)
ON CONFLICT DO NOTHING;

-- 2) Create wishbook_prices table
CREATE TABLE IF NOT EXISTS wishbook_prices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cover_category text NOT NULL CHECK (cover_category IN ('printed', 'fabric')),
  page_color     text NOT NULL CHECK (page_color IN ('white', 'black', 'cream')),
  size_code      text NOT NULL CHECK (size_code IN ('23x23', '20x30', '30x20')),
  price          numeric NOT NULL CHECK (price > 0),
  created_at     timestamp with time zone DEFAULT now(),
  UNIQUE (cover_category, page_color, size_code)
);

ALTER TABLE wishbook_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wishbook_prices_public_read" ON wishbook_prices;
CREATE POLICY "wishbook_prices_public_read" ON wishbook_prices FOR SELECT USING (true);

-- 3) Seed 18 price rows (2 cover_cat × 3 page_color × 3 sizes)
-- 'printed' covers (Друкована тверда):
--   white: 629 (23x23), 679 (20x30 & 30x20)
--   black/cream: 1009 (23x23), 1049 (20x30 & 30x20)
-- 'fabric' covers (Велюр + Шкірзамінник + Тканина = same price):
--   white: 1159 (23x23), 1209 (20x30 & 30x20)
--   black/cream: 1459 (23x23), 1509 (20x30 & 30x20)
INSERT INTO wishbook_prices (cover_category, page_color, size_code, price) VALUES
  ('printed', 'white',  '23x23',  629),
  ('printed', 'white',  '20x30',  679),
  ('printed', 'white',  '30x20',  679),
  ('printed', 'black',  '23x23', 1009),
  ('printed', 'black',  '20x30', 1049),
  ('printed', 'black',  '30x20', 1049),
  ('printed', 'cream',  '23x23', 1009),
  ('printed', 'cream',  '20x30', 1049),
  ('printed', 'cream',  '30x20', 1049),
  ('fabric',  'white',  '23x23', 1159),
  ('fabric',  'white',  '20x30', 1209),
  ('fabric',  'white',  '30x20', 1209),
  ('fabric',  'black',  '23x23', 1459),
  ('fabric',  'black',  '20x30', 1509),
  ('fabric',  'black',  '30x20', 1509),
  ('fabric',  'cream',  '23x23', 1459),
  ('fabric',  'cream',  '20x30', 1509),
  ('fabric',  'cream',  '30x20', 1509)
ON CONFLICT (cover_category, page_color, size_code) DO UPDATE SET price = EXCLUDED.price;

-- 4) Update canonical wishbook product options
UPDATE products SET options = '[
  {
    "name": "Матеріал обкладинки",
    "type": "select",
    "options": [
      {"label": "Друкована тверда",    "price": 0, "value": "printed"},
      {"label": "Велюр",               "price": 0, "value": "velour"},
      {"label": "Шкірзамінник",        "price": 0, "value": "leatherette"},
      {"label": "Тканина",             "price": 0, "value": "fabric"}
    ]
  },
  {
    "name": "Розмір",
    "type": "select",
    "options": [
      {"label": "23×23 см (квадратна)",     "price": 0, "value": "23x23"},
      {"label": "20×30 см (вертикальна)",   "price": 0, "value": "20x30"},
      {"label": "30×20 см (горизонтальна)", "price": 0, "value": "30x20"}
    ]
  },
  {
    "name": "Колір сторінок",
    "type": "select",
    "options": [
      {"label": "Білі сторінки",   "price": 0, "value": "white"},
      {"label": "Чорні сторінки",  "price": 0, "value": "black"},
      {"label": "Кремові сторінки","price": 0, "value": "cream"}
    ]
  },
  {
    "name": "Кількість сторінок",
    "type": "select",
    "options": [
      {"label": "32 сторінки", "price": 0, "value": "32"}
    ]
  }
]'::jsonb,
price = 629,
price_from = true
WHERE slug = 'wishbook';

-- 5) Deactivate 3 duplicates (canonical is 'wishbook')
UPDATE products
SET is_active = false
WHERE slug IN ('guestbook-wedding', 'guestbook-kids', 'knyha-pobazhan-dytyacha');
