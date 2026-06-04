-- Email automation — CRM customer import for win-back.
-- Applied to production via Supabase MCP on 2026-06-04; committed here for tracking.

create table if not exists public.crm_imported_customers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  phone text,
  last_order_at timestamptz,
  order_count int default 0,
  total_spend numeric default 0,
  source text default 'import',
  raw jsonb,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists crm_imported_customers_email_uniq
  on public.crm_imported_customers (lower(email));

alter table public.crm_imported_customers enable row level security;
do $$ begin
  if not exists (select 1 from pg_policy where polrelid='public.crm_imported_customers'::regclass and polname='admin_all_crm_imported_customers') then
    create policy "admin_all_crm_imported_customers" on public.crm_imported_customers
      for all using (public.is_admin_user()) with check (public.is_admin_user());
  end if;
end $$;

-- Win-back selector merges real PAID orders with imported legacy-CRM customers
-- (later date wins; GREATEST ignores NULLs).
create or replace function public.get_winback_candidates(
  p_days_min int, p_days_max int, p_cooldown_days int, p_limit int
)
returns table(email text, customer_name text, last_order_at timestamptz, days_since int)
language sql stable security definer as $$
  with site_orders as (
    select lower(o.customer_email) as email,
           max(coalesce(o.customer_name, o.customer_first_name)) as customer_name,
           max(o.created_at) as last_order_at
    from public.orders o
    where o.payment_status = 'paid'
      and o.customer_email is not null and o.customer_email <> ''
    group by lower(o.customer_email)
  ),
  imported as (
    select lower(c.email) as email,
           max(c.name) as customer_name,
           max(c.last_order_at) as last_order_at
    from public.crm_imported_customers c
    where c.email is not null and c.email <> ''
    group by lower(c.email)
  ),
  merged as (
    select coalesce(s.email, i.email) as email,
           coalesce(s.customer_name, i.customer_name) as customer_name,
           greatest(s.last_order_at, i.last_order_at) as last_order_at
    from site_orders s
    full outer join imported i on s.email = i.email
  )
  select m.email, m.customer_name, m.last_order_at,
         extract(day from (now() - m.last_order_at))::int as days_since
  from merged m
  where m.last_order_at is not null
    and m.last_order_at <= now() - make_interval(days => p_days_min)
    and m.last_order_at >= now() - make_interval(days => p_days_max)
    and not exists (select 1 from public.subscribers s2 where lower(s2.email) = m.email and s2.is_active = false)
    and not exists (
      select 1 from public.email_automation_log l
      where l.automation_type = 'winback' and lower(l.email) = m.email
        and l.sent_at >= now() - make_interval(days => p_cooldown_days)
    )
  order by m.last_order_at asc
  limit p_limit;
$$;

-- Bulk upsert used by /api/admin/crm-import (dedup within file; keep latest date per email).
create or replace function public.crm_import_upsert(p_rows jsonb, p_source text default 'import')
returns int
language plpgsql security definer as $$
declare n int;
begin
  with incoming as (
    select
      lower(nullif(trim(r->>'email'),'')) as email,
      nullif(trim(r->>'name'),'') as name,
      nullif(trim(r->>'phone'),'') as phone,
      case when nullif(trim(r->>'last_order_at'),'') is not null
           then (r->>'last_order_at')::timestamptz else null end as last_order_at,
      coalesce(nullif(regexp_replace(r->>'order_count','[^0-9]','','g'),'')::int, 0) as order_count,
      coalesce(nullif(regexp_replace(r->>'total_spend','[^0-9.]','','g'),'')::numeric, 0) as total_spend,
      r as raw
    from jsonb_array_elements(p_rows) as r
  ),
  valid as (
    select distinct on (email) email, name, phone, last_order_at, order_count, total_spend, raw
    from incoming
    where email is not null and email like '%_@_%.%'
    order by email, last_order_at desc nulls last
  ),
  ins as (
    insert into public.crm_imported_customers (email, name, phone, last_order_at, order_count, total_spend, source, raw, updated_at)
    select email, name, phone, last_order_at, order_count, total_spend, p_source, raw, now() from valid
    on conflict (lower(email)) do update set
      name = coalesce(excluded.name, crm_imported_customers.name),
      phone = coalesce(excluded.phone, crm_imported_customers.phone),
      last_order_at = greatest(excluded.last_order_at, crm_imported_customers.last_order_at),
      order_count = greatest(excluded.order_count, crm_imported_customers.order_count),
      total_spend = greatest(excluded.total_spend, crm_imported_customers.total_spend),
      source = p_source,
      raw = excluded.raw,
      updated_at = now()
    returning 1
  )
  select count(*) into n from ins;
  return n;
end $$;