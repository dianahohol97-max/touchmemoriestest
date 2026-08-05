-- Sales managers: people who bring photographers, wedding and travel agencies
-- into the partner program and earn a percentage of what those partners
-- generate (Diana, 2026-08-05).
--
-- Attribution is stored on the partner, not on the lead, because a lead can be
-- reworked by several people while the money must credit whoever actually
-- closed it. Every accrual is one row in sales_commissions with a UNIQUE
-- (kind, source_id), which makes webhook retries harmless.

CREATE TABLE IF NOT EXISTS sales_managers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  email          text UNIQUE,
  phone          text,
  -- Private cabinet link, same pattern as photographers and agency partners.
  cabinet_token  uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  is_active      boolean NOT NULL DEFAULT true,
  -- Percent of an order that came through the partner's referral code.
  rate_order     numeric NOT NULL DEFAULT 1,
  -- Percent of a photographer's gallery storage plan payment.
  rate_gallery   numeric NOT NULL DEFAULT 5,
  total_earned   numeric NOT NULL DEFAULT 0,
  total_paid     numeric NOT NULL DEFAULT 0,
  payout_account text,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales_commissions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id     uuid NOT NULL REFERENCES sales_managers(id) ON DELETE CASCADE,
  -- 'order'   — замовлення за реферальним кодом партнера
  -- 'gallery' — оплата тарифу пам'яті фотографом
  kind           text NOT NULL,
  -- orders.id / photographer_subscriptions.id — whatever produced the money.
  source_id      text NOT NULL,
  partner_id     uuid REFERENCES agency_partners(id) ON DELETE SET NULL,
  photographer_id uuid REFERENCES photographers(id) ON DELETE SET NULL,
  base_amount    numeric NOT NULL,
  rate           numeric NOT NULL,
  amount         numeric NOT NULL,
  status         text NOT NULL DEFAULT 'pending',
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  paid_at        timestamptz,
  UNIQUE (kind, source_id)
);

CREATE INDEX IF NOT EXISTS sales_commissions_manager_idx ON sales_commissions(manager_id, created_at DESC);

-- Who brought this partner / photographer, and who owns this lead.
ALTER TABLE agency_partners ADD COLUMN IF NOT EXISTS sales_manager_id uuid REFERENCES sales_managers(id) ON DELETE SET NULL;
ALTER TABLE photographers   ADD COLUMN IF NOT EXISTS sales_manager_id uuid REFERENCES sales_managers(id) ON DELETE SET NULL;
ALTER TABLE leads           ADD COLUMN IF NOT EXISTS sales_manager_id uuid REFERENCES sales_managers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS leads_sales_manager_idx ON leads(sales_manager_id, created_at DESC);

-- Service-role only, like the rest of the B2B tables: every read and write
-- goes through token-authenticated API routes.
ALTER TABLE sales_managers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_commissions ENABLE ROW LEVEL SECURITY;
