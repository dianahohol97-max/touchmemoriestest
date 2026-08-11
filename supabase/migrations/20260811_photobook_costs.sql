-- Photobook production costs, per size and page count, mirrored from KeyCRM.
-- The site prices photobooks from a matrix (cover × size × pages) while the
-- CRM keeps one product per SIZE whose variants are page counts, with the
-- покупна вартість on each. Neither shape fits keycrm_product_map (one row =
-- one product + one size), so photobook costs live in their own table.
-- Diana, 2026-08-11: cover type changes neither price nor cost — the premium
-- cover is a separate decoration line — so cost is a function of size × pages.
-- Applied to prod via MCP on 2026-08-11.

CREATE TABLE IF NOT EXISTS photobook_costs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    size text NOT NULL,
    page_count integer NOT NULL,
    cost numeric,
    crm_price numeric,
    crm_offer_id text,
    crm_product_id text,
    crm_name text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (size, page_count)
);

ALTER TABLE photobook_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage photobook costs" ON photobook_costs;
CREATE POLICY "Admins manage photobook costs" ON photobook_costs
    FOR ALL USING (is_admin()) WITH CHECK (is_admin());

COMMENT ON TABLE photobook_costs IS 'Photobook покупна вартість per size × page count, synced from the KeyCRM photobook products (settings.photobook_crm_links).';
