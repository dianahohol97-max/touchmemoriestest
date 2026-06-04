-- 20260604_intl_shipping_config.sql
-- Applied via Supabase MCP (execute_sql) on 2026-06-04.
-- International shipping policy: free over a EUR threshold, else a flat EUR fee.
-- Read by /api/orders/submit (charge) and /api/exchange-rate (client display).
-- Code falls back to DEFAULT_INTL_SHIPPING if this row is absent.
insert into public.settings (key, value)
values ('intl_shipping', '{"free_threshold_eur":0,"flat_fee_eur":25}'::jsonb)
on conflict (key) do nothing;
