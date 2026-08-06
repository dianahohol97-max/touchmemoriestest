-- Working unsubscribe for the newsletter.
-- Applied to production via Supabase MCP on 2026-08-06; committed here for tracking.
--
-- 1. subscribers.unsubscribe_token never existed, yet four routes already
--    selected it (birthday-emails, the new-product campaign, the subscribe flow
--    and /api/email/unsubscribe/[token]). Adding it repairs those and gives the
--    newsletter a link that cannot be forged by editing an address in the URL.
-- 2. email_unsubscribes records who left and after which campaign, so the
--    "Листи" screen can show more than "надіслано / не надіслано".

alter table public.subscribers
  add column if not exists unsubscribe_token text,
  add column if not exists unsubscribed_at timestamptz;

-- 24 random bytes as URL-safe base64 → 32 chars of [A-Za-z0-9_-], which is what
-- the existing token route already validates.
update public.subscribers
   set unsubscribe_token = translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_')
 where unsubscribe_token is null;

alter table public.subscribers
  alter column unsubscribe_token set default translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');

create unique index if not exists subscribers_unsubscribe_token_uniq
  on public.subscribers (unsubscribe_token);

create table if not exists public.email_unsubscribes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  campaign_id uuid references public.email_campaigns(id) on delete set null,
  source text,
  created_at timestamptz not null default now()
);

create index if not exists email_unsubscribes_campaign_idx on public.email_unsubscribes (campaign_id);
create index if not exists email_unsubscribes_email_idx on public.email_unsubscribes (lower(email));

alter table public.email_unsubscribes enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policy
    where polrelid = 'public.email_unsubscribes'::regclass
      and polname = 'admin_all_email_unsubscribes'
  ) then
    create policy "admin_all_email_unsubscribes" on public.email_unsubscribes
      for all using (public.is_admin_user()) with check (public.is_admin_user());
  end if;
end $$;
