-- Close the last open RLS gap from the round-8 audit.
--
-- Repo had `FOR ALL TO authenticated USING(true)` on featured_articles AND
-- travel_book_covers (per lib/supabase/schema/ and supabase/migrations/),
-- meaning any signed-up customer could overwrite homepage cards or wipe the
-- cover-template library.
--
-- Production check on 2026-04-29 found:
--   - featured_articles: already fixed via admin_write_featured_articles
--     (FOR ALL USING is_admin_user()) + public_read_featured_articles
--     (FOR SELECT USING true). Nothing to do for this table.
--   - travel_book_covers: only had public_read_travel_book_covers (FOR SELECT
--     USING true). RLS was on but no write policy = every write denied,
--     including the admin UI's. This migration adds the missing admin write
--     policy.
--
-- Using is_admin_user() (not is_admin()) to match the existing featured_articles
-- policy and keep the codebase consistent. Both functions exist and behave
-- identically; is_admin_user() is what prod uses for similar tables.
--
-- Applied to prod 2026-04-29.
-- Idempotent: safe to re-run.

DROP POLICY IF EXISTS "admin_write_travel_book_covers" ON travel_book_covers;

CREATE POLICY "admin_write_travel_book_covers"
  ON travel_book_covers
  FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());
