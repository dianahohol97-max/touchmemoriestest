-- Close the last public-read RLS gap found during the security audit follow-up.
--
-- customer_projects had a policy named "Admin full access to customer_projects"
-- with `USING (true)` and no role restriction. So despite the name, ANY anon
-- caller could SELECT every project's share_token, thumbnail_url, customer
-- comments, etc. The customer-facing review page (/review/[token]) used to
-- rely on this open policy via the cookie-bound client — that path is now
-- moved to a token-validated server route at /api/review/[token]/[action]
-- which uses the service-role client.

DROP POLICY IF EXISTS "Admin full access to customer_projects" ON customer_projects;

CREATE POLICY "Admin only customer_projects" ON customer_projects
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Customer reads own customer_projects" ON customer_projects
  FOR SELECT
  USING (
    customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
  );
