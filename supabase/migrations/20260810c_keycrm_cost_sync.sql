-- Remember the purchase cost each mapped CRM item reported.
--
-- The site keeps one cost per product (products.cost_price), but the CRM keeps
-- one per size. Storing the per-size figure here means nothing is lost when the
-- sizes disagree — the product-level column is only written when they agree,
-- and the conflict stays visible instead of one size quietly winning.

ALTER TABLE keycrm_product_map
  ADD COLUMN IF NOT EXISTS keycrm_cost_price numeric,
  ADD COLUMN IF NOT EXISTS keycrm_cost_synced_at timestamptz;
