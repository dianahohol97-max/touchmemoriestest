-- ============================================================
-- Calendar UX fixes — 2026-05-26 (round 2)
-- ============================================================
-- Applied via Supabase MCP. Idempotent. For repo history only.
-- ============================================================

-- desk-calendar-2026: switch default to "З мольбертом" (319 ₴ base)
-- and offer "Без мольберта" as a -50 ₴ option. Date-circling unchanged.
UPDATE products SET
  price = 319,
  price_from = true,
  options = '[
    {
      "name": "Комплектація",
      "type": "select",
      "options": [
        {"label": "З дерев''яним мольбертом (319 грн)", "price": 0,   "value": "with_stand"},
        {"label": "Без мольберта (269 грн)",            "price": -50, "value": "no_stand"}
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
