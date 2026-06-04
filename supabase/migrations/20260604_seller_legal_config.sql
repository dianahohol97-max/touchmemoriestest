-- 20260604_seller_legal_config.sql
-- Applied via Supabase MCP (execute_sql) on 2026-06-04.
-- Seller legal details for the commercial invoice (lib/export/invoice.ts).
-- Admin-only (settings table). tax_id / iban filled by Diana on request.
insert into public.settings (key, value)
values (
  'seller_legal',
  '{"name_en":"Diana Hohol (sole proprietor / FOP)","address_en":"Voiakiv Dyvizii Halychyna St. 13a, Ternopil, Ukraine","tax_id":"","iban":"","email":"hello@touchmemories.com.ua"}'::jsonb
)
on conflict (key) do nothing;
