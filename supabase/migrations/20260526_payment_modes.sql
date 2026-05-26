-- ============================================================
-- Payment modes — Session E (50% split payment support)
-- ============================================================
-- Applied via Supabase MCP on 2026-05-26.
-- This file is for repo record-keeping; the migration has already run on production.
-- Idempotent — safe to re-run.
-- ============================================================
--
-- Per-product setting:
--   'full_only'           → must pay 100% online up front (default)
--   'full_or_split'       → can pay 100% online OR 50% online + 50% on delivery
--   'full_only_if_alone'  → full_only if it's the only product in cart,
--                          but allows split if accompanying a 'full_or_split' product
--
-- Cart-level logic (computed in lib/payment/options.ts):
--   allowSplit = (no product has 'full_only')
--             AND (at least one product is 'full_or_split')
--   else only 'full_online' is offered.
-- ============================================================

-- 1) Add payment_mode column to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'full_only'
  CHECK (payment_mode IN ('full_only', 'full_or_split', 'full_only_if_alone'));

CREATE INDEX IF NOT EXISTS products_payment_mode_idx ON products(payment_mode);

-- 2) Add payment_type + amounts to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_type text CHECK (payment_type IN ('full', 'split'));

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS prepaid_amount numeric DEFAULT 0 CHECK (prepaid_amount >= 0);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cod_amount numeric DEFAULT 0 CHECK (cod_amount >= 0);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pickup_unpaid_balance numeric DEFAULT 0 CHECK (pickup_unpaid_balance >= 0);

COMMENT ON COLUMN orders.payment_type IS 'full = 100% online; split = 50% online + 50% COD/pickup';
COMMENT ON COLUMN orders.prepaid_amount IS 'Amount paid online up front (= total for full; total/2 for split)';
COMMENT ON COLUMN orders.cod_amount IS 'Cash-on-delivery amount sent to Nova Poshta as backward delivery (only for split + Nova Poshta)';
COMMENT ON COLUMN orders.pickup_unpaid_balance IS 'Balance customer owes at pickup (only for split + pickup delivery; manager collects cash)';

-- 3) Seed payment_mode per product
-- 3a) Specific slugs that span multiple categories
UPDATE products SET payment_mode = 'full_or_split'
WHERE slug IN (
  'wishbook',
  'karta-vizualizatsii',
  'tsyfrova-fotoramka',
  'pershyj-albom-malyuka',
  'fotoalbom-500-this-is-us-blakytnyj',
  'instax-album',
  'instax-album-108',
  'instax-album-64',
  'wedding-newspaper'
);

-- 3b) Category-based seeding for the remaining book-like products
UPDATE products SET payment_mode = 'full_or_split'
WHERE category_id IN (
  SELECT id FROM categories WHERE slug IN (
    'photobooks',
    'scrapbook-albums',
    'photoalbomy-failykovi',
    'hlyantsevi-zhurnaly',
    'travelbooks',
    'graduation-books'
  )
);

-- 3c) full_only_if_alone — special case
UPDATE products SET payment_mode = 'full_only_if_alone'
WHERE slug = 'nabir-vidbytkiv';

-- 4) Storage bucket: extend allowed mime types so iPhone HEIC/HEIF/AVIF uploads work
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif', 'image/avif',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/mpeg'
]
WHERE name = 'touch-memories-assets';
