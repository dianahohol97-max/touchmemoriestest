-- Map products at the size level, not the product level.
--
-- One website product is several CRM items. "Книга побажань" is sold as 23×23,
-- 20×30 and 30×20, and the CRM keeps a separate entry for each, so a mapping
-- keyed only by slug can never point at the right one — it would attach every
-- wish book to whichever size happened to be matched first.
--
-- site_variant holds the canonical size key ("23x23", "30x20", "7.5x10"), or an
-- empty string for products that have no size choice. Empty rather than NULL on
-- purpose: NULLs do not compare equal in a unique index, so a nullable column
-- would silently allow duplicate rows for the same product.

ALTER TABLE keycrm_product_map
  ADD COLUMN IF NOT EXISTS site_variant text NOT NULL DEFAULT '';

ALTER TABLE keycrm_product_map
  ADD COLUMN IF NOT EXISTS site_variant_label text;

-- The old single-column uniqueness would reject the second size of any product.
ALTER TABLE keycrm_product_map
  DROP CONSTRAINT IF EXISTS keycrm_product_map_site_slug_key;

CREATE UNIQUE INDEX IF NOT EXISTS keycrm_product_map_slug_variant_idx
  ON keycrm_product_map (site_slug, site_variant);
