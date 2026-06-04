-- Email automation infrastructure — phase 1: win-back / repeat sales.
-- Applied to production via Supabase MCP on 2026-06-04; committed here for tracking.

-- Reusable send log for all email automations (winback, abandoned_cart, welcome_series, ...)
create table if not exists public.email_automation_log (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  automation_type text not null,
  reference_id text,
  meta jsonb,
  sent_at timestamptz not null default now()
);
create index if not exists email_automation_log_lookup
  on public.email_automation_log (automation_type, lower(email), sent_at desc);

alter table public.email_automation_log enable row level security;
do $$ begin
  if not exists (select 1 from pg_policy where polrelid='public.email_automation_log'::regclass and polname='admin_all_email_automation_log') then
    create policy "admin_all_email_automation_log" on public.email_automation_log
      for all using (public.is_admin_user()) with check (public.is_admin_user());
  end if;
end $$;

-- Win-back candidate selector: emails whose latest PAID order is within the
-- [min,max] day window, who haven't ordered since, aren't unsubscribed, and
-- haven't been win-backed within the cooldown.
create or replace function public.get_winback_candidates(
  p_days_min int, p_days_max int, p_cooldown_days int, p_limit int
)
returns table(email text, customer_name text, last_order_at timestamptz, days_since int)
language sql stable security definer as $$
  with paid as (
    select lower(o.customer_email) as email,
           max(coalesce(o.customer_name, o.customer_first_name)) as customer_name,
           max(o.created_at) as last_order_at
    from public.orders o
    where o.payment_status = 'paid'
      and o.customer_email is not null and o.customer_email <> ''
    group by lower(o.customer_email)
  )
  select p.email, p.customer_name, p.last_order_at,
         extract(day from (now() - p.last_order_at))::int as days_since
  from paid p
  where p.last_order_at <= now() - make_interval(days => p_days_min)
    and p.last_order_at >= now() - make_interval(days => p_days_max)
    and not exists (
      select 1 from public.subscribers s
      where lower(s.email) = p.email and s.is_active = false
    )
    and not exists (
      select 1 from public.email_automation_log l
      where l.automation_type = 'winback' and lower(l.email) = p.email
        and l.sent_at >= now() - make_interval(days => p_cooldown_days)
    )
  order by p.last_order_at asc
  limit p_limit;
$$;

-- Win-back incentive code (idempotent).
insert into public.promo_codes (code, type, value, min_order_amount, is_single_use_per_customer, valid_from, valid_until, is_active, created_by, notes)
select 'WINBACK10', 'percent', 10, 0, true, now(), now() + interval '1 year', true, 'winback_auto', 'Авто win-back: -10% для клієнтів, що давно не замовляли'
where not exists (select 1 from public.promo_codes where code = 'WINBACK10');
