-- A hard daily send budget, so the Brevo free plan (300 emails/day, shared
-- between marketing and order confirmations) can never be blown.
-- Applied to production via Supabase MCP on 2026-08-06; committed here for tracking.
--
-- Two ideas:
--   1. Every send reserves a slot before it goes out. sendBrevoEmail is the one
--      choke point in the codebase — lib/email/resend.ts delegates to it too —
--      so a reservation there cannot be bypassed.
--   2. Marketing may only spend what is left ABOVE a reserve kept for
--      transactional mail. A newsletter can therefore never eat the quota a
--      customer's order confirmation needs.

create table if not exists public.email_quota_config (
  id boolean primary key default true check (id),
  daily_cap int not null default 300,
  transactional_reserve int not null default 120,
  updated_at timestamptz not null default now()
);
insert into public.email_quota_config (id) values (true) on conflict (id) do nothing;

create table if not exists public.email_quota_usage (
  day date primary key,
  transactional_used int not null default 0,
  marketing_used int not null default 0,
  updated_at timestamptz not null default now()
);

/*
 * Reserve up to p_count slots. Returns how many were actually granted, which
 * may be 0. Callers must send no more than the granted number.
 */
create or replace function public.email_quota_reserve(p_count int, p_kind text)
returns int
language plpgsql security definer as $$
declare
  cfg public.email_quota_config;
  cur public.email_quota_usage;
  used_total int;
  allowed int;
  granted int;
begin
  if p_count is null or p_count <= 0 then return 0; end if;

  select * into cfg from public.email_quota_config where id;
  -- No configuration row means the budget is not in use; never block on it.
  if not found then return p_count; end if;

  insert into public.email_quota_usage (day) values (current_date)
    on conflict (day) do nothing;
  select * into cur from public.email_quota_usage where day = current_date for update;

  used_total := cur.transactional_used + cur.marketing_used;

  if p_kind = 'marketing' then
    allowed := greatest(0, cfg.daily_cap - cfg.transactional_reserve - used_total);
  else
    allowed := greatest(0, cfg.daily_cap - used_total);
  end if;

  granted := least(p_count, allowed);

  if granted > 0 then
    if p_kind = 'marketing' then
      update public.email_quota_usage
         set marketing_used = marketing_used + granted, updated_at = now()
       where day = current_date;
    else
      update public.email_quota_usage
         set transactional_used = transactional_used + granted, updated_at = now()
       where day = current_date;
    end if;
  end if;

  return granted;
end $$;

/* Read-only view of today's budget for the admin screens. */
create or replace function public.email_quota_status()
returns table(
  daily_cap int, transactional_reserve int,
  transactional_used int, marketing_used int,
  marketing_left int, total_left int
)
language sql stable security definer as $$
  select
    c.daily_cap,
    c.transactional_reserve,
    coalesce(u.transactional_used, 0),
    coalesce(u.marketing_used, 0),
    greatest(0, c.daily_cap - c.transactional_reserve
               - coalesce(u.transactional_used, 0) - coalesce(u.marketing_used, 0)),
    greatest(0, c.daily_cap - coalesce(u.transactional_used, 0) - coalesce(u.marketing_used, 0))
  from public.email_quota_config c
  left join public.email_quota_usage u on u.day = current_date
  where c.id;
$$;

-- Queue for the manual newsletter. Without it a 5364-person send would fire
-- everything at once, hit the cap after a few hundred and fail the rest.
create table if not exists public.email_campaign_queue (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.email_campaigns(id) on delete cascade,
  email text not null,
  name text,
  status text not null default 'pending',
  attempts int not null default 0,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists email_campaign_queue_unique
  on public.email_campaign_queue (campaign_id, lower(email));
create index if not exists email_campaign_queue_pending_idx
  on public.email_campaign_queue (status, created_at) where status = 'pending';

alter table public.email_quota_config enable row level security;
alter table public.email_quota_usage enable row level security;
alter table public.email_campaign_queue enable row level security;

do $$
declare t text;
begin
  foreach t in array array['email_quota_config','email_quota_usage','email_campaign_queue'] loop
    if not exists (
      select 1 from pg_policy
      where polrelid = ('public.' || t)::regclass and polname = 'admin_all_' || t
    ) then
      execute format(
        'create policy %I on public.%I for all using (public.is_admin_user()) with check (public.is_admin_user())',
        'admin_all_' || t, t
      );
    end if;
  end loop;
end $$;
