-- The catalogue sync captured the CRM's purchase cost but dropped its SALE
-- price, so «а які ціни в CRM?» had no answer on the site side (Diana,
-- 2026-08-11). The price is stored on the mapping row for display/reference;
-- site prices do not auto-follow it — that stays a human decision.
-- Applied to prod via MCP on 2026-08-11.

ALTER TABLE keycrm_product_map ADD COLUMN IF NOT EXISTS keycrm_price numeric;
COMMENT ON COLUMN keycrm_product_map.keycrm_price IS 'CRM sale price of the linked offer, captured by syncCostPrices alongside the cost. Display/reference only — site prices do not auto-follow.';
