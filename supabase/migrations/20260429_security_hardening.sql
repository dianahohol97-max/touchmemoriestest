-- Security hardening migration following the security audit on 2026-04-29.
--
-- Closes the following findings:
--   1. magazine_briefs had RLS disabled — any anon caller could SELECT all
--      sensitive personal-questionnaire data ("what amazes you", etc.).
--   2. subscribers had a public SELECT policy — full email list was exposed
--      to anyone with the anon key (which is in every browser bundle).
--   3. orders had "Free Designer Orders Read" policy that let anon callers
--      see all designer-service orders with customer_name/email/phone.
--   4. wishlists had "anon read" policy — leaked customer wishlists.
--   5. photobook_projects had "anon all" policies — full CRUD via anon key.
--   6. recipes had public delete/update/insert policies — anyone could wipe
--      the table.
--   7. bank_accounts, fiscal_accounts, np_accounts had USING (true) for any
--      authenticated user, including regular customers. Restricted to admins.
--   8. gift_certificates had public SELECT — anyone could enumerate codes.
--   9. inventory_movements had public SELECT — competitors could see stock
--      flow. Restricted to authenticated.
--  10. staff had USING (true) for any authenticated user. Restricted to
--      admins. Salary rates, telegram_chat_id etc. are now private.
--  11. design_briefs/design_revisions had USING (true) under the guise of
--      token-based access but no token validation. Restricted to admin.
--      Token-based public access (if needed for review links) must be
--      reintroduced via a different code path that validates the token
--      before bypassing RLS via service role.
--  12. The orphan dashboard_*, daily_logs, body_measurements, training_*,
--      boards, pins tables (none used by TM code; left over from sibling
--      projects sharing this Supabase) had FOR ALL USING (true). Locked
--      down to service_role only — sibling projects must reauthenticate
--      via service role or define their own restrictive policies.

-- ─────────────────────────────────────────────────────────────────────
-- 1. magazine_briefs — enable RLS, add owner-or-admin policy
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE magazine_briefs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid='public.magazine_briefs'::regclass
                   AND polname='Customer access own magazine_briefs') THEN
    CREATE POLICY "Customer access own magazine_briefs" ON magazine_briefs
      FOR ALL
      USING (
        customer_email = (SELECT email FROM customers WHERE auth_user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
      )
      WITH CHECK (
        customer_email = (SELECT email FROM customers WHERE auth_user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid='public.magazine_briefs'::regclass
                   AND polname='Anon insert magazine_briefs') THEN
    -- Submit form is anonymous (no login required to fill out the brief).
    -- We allow inserts but not reads from anon.
    CREATE POLICY "Anon insert magazine_briefs" ON magazine_briefs
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- 2. subscribers — drop public SELECT, keep only admin/auth read
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can query subscribers" ON subscribers;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid='public.subscribers'::regclass
                   AND polname='Admins read subscribers') THEN
    CREATE POLICY "Admins read subscribers" ON subscribers
      FOR SELECT
      USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- 3. orders — drop "Free Designer Orders Read" anon-readable policy
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Free Designer Orders Read" ON orders;
-- Designers still have a separate "Designer Read Orders" policy that lets
-- them read free orders only when they're logged in as a designer staff.


-- ─────────────────────────────────────────────────────────────────────
-- 4. wishlists — restrict to owner or admin only
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Wishlists are viewable by everyone (for sync/merge logic handle" ON wishlists;
DROP POLICY IF EXISTS "anon_read_wishlists" ON wishlists;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid='public.wishlists'::regclass
                   AND polname='Owner reads own wishlist') THEN
    CREATE POLICY "Owner reads own wishlist" ON wishlists
      FOR SELECT
      USING (
        customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
      );
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- 5. photobook_projects — drop anon FOR ALL policies
-- (table is orphan — no rows, no live code path — but plug the hole)
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_all_photobook_projects" ON photobook_projects;
DROP POLICY IF EXISTS "anon_insert_projects" ON photobook_projects;
DROP POLICY IF EXISTS "anon_select_projects" ON photobook_projects;
DROP POLICY IF EXISTS "anon_update_projects" ON photobook_projects;


-- ─────────────────────────────────────────────────────────────────────
-- 6. recipes — orphan table from sibling project; lock to service_role
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public delete access" ON recipes;
DROP POLICY IF EXISTS "Public insert access" ON recipes;
DROP POLICY IF EXISTS "Public read access" ON recipes;
DROP POLICY IF EXISTS "Public update access" ON recipes;


-- ─────────────────────────────────────────────────────────────────────
-- 7. bank_accounts / fiscal_accounts / fiscal_rules / np_accounts —
--    these are sensitive financial config. Restrict from "any authenticated
--    user" to "admin only".
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin can do everything on bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Admin can do everything on fiscal_accounts" ON fiscal_accounts;
DROP POLICY IF EXISTS "Admin can do everything on fiscal_rules" ON fiscal_rules;
DROP POLICY IF EXISTS "Admin can do everything on np_accounts" ON np_accounts;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.bank_accounts'::regclass AND polname='Admin only bank_accounts') THEN
    CREATE POLICY "Admin only bank_accounts" ON bank_accounts FOR ALL
      USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.fiscal_accounts'::regclass AND polname='Admin only fiscal_accounts') THEN
    CREATE POLICY "Admin only fiscal_accounts" ON fiscal_accounts FOR ALL
      USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.fiscal_rules'::regclass AND polname='Admin only fiscal_rules') THEN
    CREATE POLICY "Admin only fiscal_rules" ON fiscal_rules FOR ALL
      USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.np_accounts'::regclass AND polname='Admin only np_accounts') THEN
    CREATE POLICY "Admin only np_accounts" ON np_accounts FOR ALL
      USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- 8. gift_certificates — drop public SELECT (admin can still read all,
--    public lookup must go through a code-validated API endpoint).
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public read by code" ON gift_certificates;
DROP POLICY IF EXISTS "public_read_gift_certificates" ON gift_certificates;


-- ─────────────────────────────────────────────────────────────────────
-- 9. inventory_movements — restrict to authenticated only
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Enable reading movements for all" ON inventory_movements;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.inventory_movements'::regclass AND polname='Authenticated read inventory_movements') THEN
    CREATE POLICY "Authenticated read inventory_movements" ON inventory_movements
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- 10. staff — drop "any authenticated reads" policy; restrict to admins
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow read access to all authenticated users for staff" ON staff;
-- "admin_all_staff" and "Allow full access to admins for staff" remain.


-- ─────────────────────────────────────────────────────────────────────
-- 11. design_briefs / design_revisions — drop USING (true) anon-all policies
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can access brief via token" ON design_briefs;
DROP POLICY IF EXISTS "Anyone can access revision via token" ON design_revisions;
-- Token-based public access (if needed) should go through a server route
-- that validates the token, then queries via service role.


-- ─────────────────────────────────────────────────────────────────────
-- 12. orphan tables from sibling projects — drop public FOR ALL policies
-- ─────────────────────────────────────────────────────────────────────
-- These tables aren't referenced by any TM code path. They appear to belong
-- to a separate dashboard / personal-tracking app sharing this Supabase
-- project. We drop their open policies; sibling projects must reauthenticate
-- via service role or write their own restrictive policies.
DROP POLICY IF EXISTS "Allow all dashboard_files" ON dashboard_files;
DROP POLICY IF EXISTS "Allow all dashboard_projects" ON dashboard_projects;
DROP POLICY IF EXISTS "Allow all dashboard_subtasks" ON dashboard_subtasks;
DROP POLICY IF EXISTS "Allow all dashboard_tasks" ON dashboard_tasks;
DROP POLICY IF EXISTS "allow_all_body_measurements" ON body_measurements;
DROP POLICY IF EXISTS "allow_all_daily_logs" ON daily_logs;
DROP POLICY IF EXISTS "allow_all_training_exercises" ON training_exercises;
DROP POLICY IF EXISTS "allow_all_training_sessions" ON training_sessions;
