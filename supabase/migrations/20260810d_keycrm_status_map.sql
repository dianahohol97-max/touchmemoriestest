-- How a KeyCRM status translates into a website order status.
--
-- Status ids are account-specific and their names are whatever the shop called
-- its pipeline stages, so there is nothing to hard-code. Until a stage is
-- mapped here the two-way sync leaves the website status alone: guessing that
-- "Готово" means shipped would email customers a parcel that has not moved.
--
-- direction controls which way a stage travels:
--   'from_crm' — a CRM stage that should update the website order
--   'to_crm'   — a website status that should push the order into this stage
--   'both'     — both of the above
CREATE TABLE IF NOT EXISTS keycrm_status_map (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keycrm_status_id   text NOT NULL UNIQUE,
  keycrm_status_name text,
  site_order_status  text NOT NULL,
  direction          text NOT NULL DEFAULT 'from_crm',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE keycrm_status_map ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'Admins manage keycrm_status_map'
      AND polrelid = 'keycrm_status_map'::regclass
  ) THEN
    CREATE POLICY "Admins manage keycrm_status_map" ON keycrm_status_map
      FOR ALL
      USING (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.role = 'admin'));
  END IF;
END $$;
