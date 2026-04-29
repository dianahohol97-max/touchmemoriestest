-- Lock down two RLS gaps missed by the 2026-04-29 security hardening pass.
--
-- Both tables had a policy of `FOR ALL TO authenticated USING (true)`, meaning
-- ANY authenticated user — including a customer who just signed up — could
-- INSERT/UPDATE/DELETE rows. featured_articles drives the homepage carousels;
-- travel_book_covers is the cover-template library used in the travel-book
-- editor. A malicious signed-up user could:
--   - Replace homepage feature cards with their own links (phishing, traffic theft)
--   - Mass-delete the travel-book cover library, breaking the editor
--   - Insert rows that point to malicious image URLs
--
-- Fix: drop the open authenticated policy, keep public SELECT (these are
-- public-facing content), and require admin for writes.
--
-- Idempotent: safe to re-run.

-- ─── featured_articles ───────────────────────────────────────────────────────
DO $$
DECLARE
  pol_name TEXT;
BEGIN
  -- Drop any FOR ALL policy on featured_articles regardless of name.
  FOR pol_name IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.featured_articles'::regclass
      AND polcmd = '*'  -- 'r' SELECT, 'a' INSERT, 'w' UPDATE, 'd' DELETE, '*' ALL
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON featured_articles', pol_name);
  END LOOP;
END $$;

-- Public can read active articles (homepage is public)
DROP POLICY IF EXISTS "Public can view featured articles" ON featured_articles;
CREATE POLICY "Public can view featured articles"
  ON featured_articles FOR SELECT
  USING (is_active = true);

-- Admin only for writes
DROP POLICY IF EXISTS "Admin manages featured articles" ON featured_articles;
CREATE POLICY "Admin manages featured articles"
  ON featured_articles FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── travel_book_covers ──────────────────────────────────────────────────────
DO $$
DECLARE
  pol_name TEXT;
BEGIN
  FOR pol_name IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.travel_book_covers'::regclass
      AND polcmd = '*'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON travel_book_covers', pol_name);
  END LOOP;
END $$;

-- Public can read active covers (the editor needs them without auth)
DROP POLICY IF EXISTS "Public can view travel book covers" ON travel_book_covers;
CREATE POLICY "Public can view travel book covers"
  ON travel_book_covers FOR SELECT
  USING (is_active = true);

-- Admin only for writes
DROP POLICY IF EXISTS "Admin manages travel book covers" ON travel_book_covers;
CREATE POLICY "Admin manages travel book covers"
  ON travel_book_covers FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
