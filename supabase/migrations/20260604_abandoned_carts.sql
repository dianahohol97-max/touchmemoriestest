-- Email automation — abandoned cart recovery.
-- Applied to production via Supabase MCP on 2026-06-04; committed here for tracking.

create table if not exists public.abandoned_carts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid,
  items jsonb not null default '[]'::jsonb,
  total numeric default 0,
  currency text default 'UAH',
  recovered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists abandoned_carts_email_uniq on public.abandoned_carts (lower(email));

alter table public.abandoned_carts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policy where polrelid='public.abandoned_carts'::regclass and polname='admin_all_abandoned_carts') then
    create policy "admin_all_abandoned_carts" on public.abandoned_carts
      for all using (public.is_admin_user()) with check (public.is_admin_user());
  end if;
end $$;

create or replace function public.get_abandoned_cart_candidates(
  p_hours_min int, p_hours_max int, p_cooldown_hours int, p_limit int
)
returns table(email text, items jsonb, total numeric, currency text)
language sql stable security definer as $$
  select a.email, a.items, a.total, a.currency
  from public.abandoned_carts a
  where a.recovered_at is null
    and jsonb_array_length(a.items) > 0
    and a.updated_at <= now() - make_interval(hours => p_hours_min)
    and a.updated_at >= now() - make_interval(hours => p_hours_max)
    and not exists (
      select 1 from public.orders o
      where lower(o.customer_email) = lower(a.email) and o.created_at >= a.updated_at
    )
    and not exists (
      select 1 from public.subscribers s
      where lower(s.email) = lower(a.email) and s.is_active = false
    )
    and not exists (
      select 1 from public.email_automation_log l
      where l.automation_type = 'abandoned_cart' and lower(l.email) = lower(a.email)
        and l.sent_at >= now() - make_interval(hours => p_cooldown_hours)
    )
  order by a.updated_at asc
  limit p_limit;
$$;

create or replace function public.abandoned_cart_upsert(p_email text, p_items jsonb, p_total numeric, p_currency text)
returns void language plpgsql security definer as $$
begin
  insert into public.abandoned_carts (email, items, total, currency, recovered_at, updated_at)
  values (lower(p_email), coalesce(p_items, '[]'::jsonb), coalesce(p_total, 0), coalesce(nullif(p_currency, ''), 'UAH'), null, now())
  on conflict (lower(email)) do update set
    items = excluded.items,
    total = excluded.total,
    currency = excluded.currency,
    recovered_at = null,
    updated_at = now();
end $$;