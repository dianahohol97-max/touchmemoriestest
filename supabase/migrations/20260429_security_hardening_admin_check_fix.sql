-- Follow-up to 20260429_security_hardening.sql.
--
-- The previous migration created several admin-check policies using
-- `EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())`. That predicate is
-- WRONG because admin_users.id is its own UUID, not the auth.users.id.
-- 
-- Production already has correct admin helper functions defined at the database
-- level: is_admin() (auth.jwt()->>'email' against admin_users.email) and
-- is_admin_user() (auth.email() against admin_users.email). We re-declare the
-- affected policies using is_admin() so admins are actually recognized.
--
-- Without this fix, every admin RLS predicate would return false and admin RLS
-- access to bank_accounts, fiscal_accounts, fiscal_rules, np_accounts,
-- subscribers, wishlists, and magazine_briefs would be silently blocked.
-- (Server routes that go through the service-role client are unaffected; the
-- bug only impacts cookie-bound queries.)

-- magazine_briefs
DROP POLICY IF EXISTS "Customer access own magazine_briefs" ON magazine_briefs;
CREATE POLICY "Customer access own magazine_briefs" ON magazine_briefs
  FOR ALL
  USING (
    customer_email = (SELECT email FROM customers WHERE auth_user_id = auth.uid())
    OR is_admin()
  )
  WITH CHECK (
    customer_email = (SELECT email FROM customers WHERE auth_user_id = auth.uid())
    OR is_admin()
  );

-- subscribers
DROP POLICY IF EXISTS "Admins read subscribers" ON subscribers;
CREATE POLICY "Admins read subscribers" ON subscribers
  FOR SELECT
  USING (is_admin());

-- wishlists
DROP POLICY IF EXISTS "Owner reads own wishlist" ON wishlists;
CREATE POLICY "Owner reads own wishlist" ON wishlists
  FOR SELECT
  USING (
    customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
    OR is_admin()
  );

-- Financial accounts — admin only
DROP POLICY IF EXISTS "Admin only bank_accounts" ON bank_accounts;
CREATE POLICY "Admin only bank_accounts" ON bank_accounts FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin only fiscal_accounts" ON fiscal_accounts;
CREATE POLICY "Admin only fiscal_accounts" ON fiscal_accounts FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin only fiscal_rules" ON fiscal_rules;
CREATE POLICY "Admin only fiscal_rules" ON fiscal_rules FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin only np_accounts" ON np_accounts;
CREATE POLICY "Admin only np_accounts" ON np_accounts FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());
