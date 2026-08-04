-- Paid storage plans for photographers (Diana, 2026-08-04). One row per
-- payment attempt; the webhook flips it to 'paid' and extends the
-- photographer's plan by one month. plan_expires_at on photographers is the
-- authority — when it passes, the effective plan falls back to 'free'
-- (computed at read time, so no cron is required).
CREATE TABLE IF NOT EXISTS photographer_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id uuid NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
  plan text NOT NULL,
  amount_uah integer NOT NULL,
  months integer NOT NULL DEFAULT 1,
  invoice_id text UNIQUE,
  payment_url text,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photographer_subscriptions_photographer_idx
  ON photographer_subscriptions(photographer_id, created_at DESC);

ALTER TABLE photographers
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;

ALTER TABLE photographer_subscriptions ENABLE ROW LEVEL SECURITY;
-- No policies: every access goes through the service role in our API routes,
-- exactly like the rest of the photographer tables.
