-- Product mapping between the website catalogue and KeyCRM.
--
-- Why this table exists: the two catalogues were built independently and share
-- no identifier. Every website product has an empty `sku`, and the names differ
-- ("Фотоальбом на 200 фото «Family»" on the site against whatever the same item
-- is called in the CRM). Without a mapping, an order pushed to KeyCRM arrives
-- as free text: it looks right to a human reading the card, but it is attached
-- to no catalogue item, so CRM stock and product analytics silently stay empty.
--
-- One row per website product slug. `confirmed` separates a match a human has
-- checked from one the matcher merely proposed — only confirmed rows are used
-- when pushing an order, because a wrong link is worse than no link at all.

CREATE TABLE IF NOT EXISTS keycrm_product_map (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_slug         text NOT NULL UNIQUE,
  site_product_name text,
  keycrm_offer_id   text,
  keycrm_sku        text,
  keycrm_name       text,
  -- 'exact-sku' | 'exact-name' | 'fuzzy-name' | 'manual'
  match_type        text,
  -- 0..1, how close the automatic match was. NULL for manual entries.
  match_score       numeric,
  confirmed         boolean NOT NULL DEFAULT false,
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS keycrm_product_map_confirmed_idx
  ON keycrm_product_map (confirmed);

ALTER TABLE keycrm_product_map ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'Admins manage keycrm_product_map'
      AND polrelid = 'keycrm_product_map'::regclass
  ) THEN
    CREATE POLICY "Admins manage keycrm_product_map" ON keycrm_product_map
      FOR ALL
      USING (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.role = 'admin'));
  END IF;
END $$;
