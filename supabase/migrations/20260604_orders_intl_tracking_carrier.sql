-- 20260604_orders_intl_tracking_carrier.sql
-- Applied via Supabase MCP on 2026-06-04.
-- Support manual Nova Global international fulfilment: record which carrier a
-- tracking number belongs to and a public tracking URL. orders.ttn holds the
-- number for both domestic and international; tracking_carrier lets the domestic
-- sync-tracking cron skip international (Nova Global) shipments.
alter table public.orders
  add column if not exists tracking_carrier text,
  add column if not exists tracking_url text;
