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

-- The link exists BEFORE the order does: a Telegram order is entered into
-- KeyCRM hours later, so the customer sends photos first and the manager
-- attaches the batch afterwards (Diana, 2026-08-14).
alter table order_upload_links alter column order_id drop not null;
alter table order_upload_links add column if not exists code text;
alter table order_upload_links add column if not exists label text;
create unique index if not exists order_upload_links_code_idx on order_upload_links (code) where code is not null;

create table if not exists upload_session_files (
    id          uuid primary key default gen_random_uuid(),
    token       text not null references order_upload_links(token) on delete cascade,
    file_path   text not null,
    file_name   text not null,
    bucket_name text not null default 'order-files',
    file_size   bigint,
    mime_type   text,
    attached_order_id uuid references orders(id) on delete set null,
    created_at  timestamptz not null default now()
);
create index if not exists upload_session_files_token_idx on upload_session_files (token);
alter table upload_session_files enable row level security;
drop policy if exists "service role only" on upload_session_files;
create policy "service role only" on upload_session_files
    for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
