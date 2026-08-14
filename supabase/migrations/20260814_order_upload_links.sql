-- Client upload links: a customer opens one and drops photos straight into our
-- storage, without Telegram (Diana, 2026-08-14 — 18 MB files kept failing to
-- upload from a phone on mobile data).
create table if not exists order_upload_links (
    token       text primary key,
    order_id    uuid not null references orders(id) on delete cascade,
    created_at  timestamptz not null default now(),
    expires_at  timestamptz not null default (now() + interval '30 days'),
    revoked     boolean not null default false,
    uploads     integer not null default 0,
    last_used_at timestamptz
);

create index if not exists order_upload_links_order_idx on order_upload_links (order_id);

alter table order_upload_links enable row level security;

drop policy if exists "service role only" on order_upload_links;
create policy "service role only" on order_upload_links
    for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
