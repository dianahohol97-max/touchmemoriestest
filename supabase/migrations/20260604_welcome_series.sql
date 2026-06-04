-- Email automation — welcome series (drip after the immediate welcome email).
-- Applied to production via Supabase MCP on 2026-06-04; committed here for tracking.

create or replace function public.get_welcome_series_candidates(
  p_automation_type text, p_day_offset int, p_max_age_days int, p_limit int
) returns table(email text, name text)
language sql stable security definer as $$
  select s.email, s.name
  from public.subscribers s
  where s.is_active = true
    and s.email is not null and s.email <> ''
    and s.subscribed_at <= now() - make_interval(days => p_day_offset)
    and s.subscribed_at >= now() - make_interval(days => p_max_age_days)
    and not exists (
      select 1 from public.email_automation_log l
      where l.automation_type = p_automation_type and lower(l.email) = lower(s.email)
    )
  order by s.subscribed_at asc
  limit p_limit;
$$;