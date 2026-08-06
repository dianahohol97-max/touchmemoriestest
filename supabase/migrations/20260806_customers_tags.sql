-- Customer tags for the CRM base (/admin/clients).
-- Applied to production via Supabase MCP on 2026-08-06; committed here for tracking.
--
-- The page has always rendered a tag chip row, a "Всі теги" filter and a VIP
-- tile counting customers tagged 'VIP', but customers.tags never existed on the
-- table — so every add/remove tag click failed on an unknown column.

alter table public.customers
  add column if not exists tags text[] not null default '{}';

-- The list filters by tag membership; GIN keeps that cheap as the base grows.
create index if not exists customers_tags_gin on public.customers using gin (tags);
