-- Repoint every admin RLS policy that read public.admin_users DIRECTLY at the
-- existing SECURITY DEFINER helper public.is_admin_user().
--
-- Why: those policies used `EXISTS (SELECT 1 FROM admin_users ...)`, and that
-- subquery runs as the CALLER's role. `authenticated` has no SELECT grant on
-- admin_users, so any direct browser-client read/write to such a table failed
-- with "permission denied for table admin_users" (e.g. inserting order_history
-- from the order card, or reading order_tag_assignments in the browser).
--
-- public.is_admin_user() (owned by postgres, SECURITY DEFINER, STABLE,
-- search_path=public) does the admin_users lookup with the definer's rights, so
-- the caller needs no grant on admin_users. order_tags already used it; this
-- brings the rest in line.
--
-- Semantics are preserved exactly: each policy still means "caller is an admin",
-- is_admin_user() returns false for anon / non-admins, and the USING /
-- WITH CHECK shape of every policy is kept. Idempotent — safe to re-run (it only
-- touches policies still referencing admin_users, and is a no-op once migrated).
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual ilike '%admin_users%' or with_check ilike '%admin_users%')
  loop
    if r.qual is not null and r.with_check is not null then
      execute format(
        'alter policy %I on %I.%I using (public.is_admin_user()) with check (public.is_admin_user())',
        r.policyname, r.schemaname, r.tablename);
    elsif r.qual is not null then
      execute format(
        'alter policy %I on %I.%I using (public.is_admin_user())',
        r.policyname, r.schemaname, r.tablename);
    elsif r.with_check is not null then
      execute format(
        'alter policy %I on %I.%I with check (public.is_admin_user())',
        r.policyname, r.schemaname, r.tablename);
    end if;
  end loop;
end $$;
