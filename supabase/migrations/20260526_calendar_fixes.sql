-- ============================================================
-- Calendar pricing & duplicate cleanup — 2026-05-26
-- ============================================================
-- Applied via Supabase MCP on 2026-05-26.
-- This file is for repo record-keeping; the migration has already run on production.
-- Idempotent — safe to re-run.
-- ============================================================

-- 1) desk-calendar-2026 canonical: base 269 ₴ (no stand), +50 ₴ stand, +10 ₴ date-circling option
UPDATE products SET
  price = 269,
  price_from = true,
  options = '[
    {
      "name": "Комплектація",
      "type": "select",
      "options": [
        {"label": "Без мольберта",                "price": 0,  "value": "no_stand"},
        {"label": "З дерев''яним мольбертом",     "price": 50, "value": "with_stand"}
      ]
    },
    {
      "name": "Обведення дат",
      "type": "select",
      "options": [
        {"label": "Без обведення",                       "price": 0,  "value": "no"},
        {"label": "З обведенням (особисті події)",       "price": 10, "value": "yes"}
      ]
    }
  ]'::jsonb
WHERE slug = 'desk-calendar-2026';

-- 2) wall-calendar-2026 canonical: A4 790 ₴ base, A3 +100 ₴, +10 ₴ date-circling option
UPDATE products SET
  price = 790,
  price_from = true,
  options = '[
    {
      "name": "Розмір",
      "type": "select",
      "options": [
        {"label": "А4 (21×29.7 см)",  "price": 0,   "value": "A4"},
        {"label": "А3 (29.7×42 см)",  "price": 100, "value": "A3"}
      ]
    },
    {
      "name": "Обведення дат",
      "type": "select",
      "options": [
        {"label": "Без обведення",                       "price": 0,  "value": "no"},
        {"label": "З обведенням (особисті події)",       "price": 10, "value": "yes"}
      ]
    }
  ]'::jsonb
WHERE slug = 'wall-calendar-2026';

-- 3) Deactivate legacy duplicates (canonical is 2026-prefixed slug)
UPDATE products SET is_active = false
WHERE slug IN ('calendar-table', 'calendar-wall-a3');
