-- 20260604_orders_pricing_freeze_eur_rate.sql
-- Applied via Supabase MCP on 2026-06-04.
--
-- Freezes pricing context on each order so "shown == charged" is auditable,
-- and seeds the buffered EUR rate used for EUR display (refreshed biweekly by
-- /api/cron/update-exchange-rate from NBU).

alter table public.orders
  add column if not exists ship_region text,
  add column if not exists price_multiplier numeric not null default 1.0,
  add column if not exists display_currency text not null default 'UAH',
  add column if not exists exchange_rate numeric;

-- value: { rate (buffered, used for display), base_rate (raw NBU), buffer_pct, source, updated_at }
insert into public.settings (key, value)
values (
  'eur_rate',
  '{"rate":50.76,"base_rate":50.76,"buffer_pct":3,"source":"manual_seed","updated_at":"2026-04-05"}'::jsonb
)
on conflict (key) do nothing;
