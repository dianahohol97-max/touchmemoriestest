-- is_admin_user() gates INSERT/UPDATE/DELETE on 89 tables (114 RLS
-- policies) across the admin panel — every "admin write" table site-wide,
-- including cover_colors (velour swatch colours). It only ever checked
-- admin_users by email, with no fallback to a staff row.
--
-- Аліна (mozgovayaaa18@gmail.com) is `staff.role = 'owner'`, is_active,
-- but has no admin_users row. Every application-level guard already treats
-- staff role admin/owner as a full admin (see requireAdmin() in
-- lib/auth/guards.ts), but this RLS function did not — so any browser
-- write that goes straight to Supabase (bypassing our API routes, e.g.
-- the velour-colors admin page's `supabase.from('cover_colors').insert(...)`)
-- was silently rejected with "new row violates row-level security policy"
-- for an account every other check in the codebase treats as a full admin.
--
-- Fix mirrors requireAdmin() exactly: admin_users OR staff.role IN
-- ('admin','owner'). Diana, 2026-09-22.
CREATE OR REPLACE FUNCTION public.is_admin_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE email = auth.email()
  ) OR EXISTS (
    SELECT 1 FROM public.staff
    WHERE email = auth.email()
      AND role IN ('admin', 'owner')
  );
$function$;
