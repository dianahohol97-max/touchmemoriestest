-- Cluster/geo SEO landing pages, served at /category/[categorySlug]/[occasion].
-- category_slug is the DB category slug; occasion is the sub-slug
-- (e.g. 'vesilni', 'dytyachi', 'ternopil'). Content is editable here (DB-driven).
create table if not exists public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  category_slug text not null,
  occasion text not null,
  kind text not null default 'cluster',
  h1 text not null,
  intro text not null default '',
  meta_title text,
  meta_description text,
  product_slugs text[] default '{}',
  hero_image text,
  is_active boolean not null default true,
  sort_order int default 0,
  translations jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (category_slug, occasion)
);

alter table public.landing_pages enable row level security;

drop policy if exists landing_pages_public_read on public.landing_pages;
create policy landing_pages_public_read on public.landing_pages
  for select using (is_active = true);
