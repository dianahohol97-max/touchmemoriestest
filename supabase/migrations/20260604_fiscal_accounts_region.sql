-- 20260604_fiscal_accounts_region.sql
-- Applied via Supabase MCP on 2026-06-04.
-- Route fiscal receipts to the cash register of the ФОП that received the money:
-- region 'ua' (ФОП Коблик) / 'international' (ФОП Гоголь), matching orders.payment_region.
alter table public.fiscal_accounts
  add column if not exists region text not null default 'ua';
