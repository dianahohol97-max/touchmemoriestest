-- The mirror marks its read-only copies with source='keycrm', and every
-- customer-facing job filters on that marker. The check constraint predates the
-- mirror and rejected all 263 inserts on the first live run, so 'keycrm' joins
-- the allowed list. Applied to production on 2026-08-11.
ALTER TABLE orders DROP CONSTRAINT orders_source_check;
ALTER TABLE orders ADD CONSTRAINT orders_source_check
  CHECK (source = ANY (ARRAY['site'::text, 'instagram'::text, 'telegram'::text, 'phone'::text, 'manual'::text, 'other'::text, 'keycrm'::text]));
