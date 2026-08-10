-- Manual emails sent from the admin order page need their text kept for the
-- per-order correspondence history (Diana, 2026-08-07). Automatic template
-- sends may stay body-less — the template name identifies them.
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS body text;
