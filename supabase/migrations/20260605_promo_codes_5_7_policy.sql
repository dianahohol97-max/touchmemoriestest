-- 20260605_promo_codes_5_7_policy.sql  (applied via Supabase MCP)
-- Discount policy: promo codes may only be 5% or 7%.
update public.promo_codes set value = 7, is_active = false,
  notes = coalesce(notes,'') || ' [capped to 7%, superseded by WINBACK7]'
  where code = 'WINBACK10';
insert into public.promo_codes (code, type, value, min_order_amount, applies_to, is_single_use_per_customer, is_active, created_by, notes)
select 'WELCOME5','percent',5,0,'all',true,true,'policy','Welcome 5% (alt to WELCOME7)'
where not exists (select 1 from public.promo_codes where code='WELCOME5');
insert into public.promo_codes (code, type, value, min_order_amount, applies_to, is_single_use_per_customer, is_active, created_by, notes)
select 'WINBACK7','percent',7,0,'all',true,true,'policy','Win-back 7%'
where not exists (select 1 from public.promo_codes where code='WINBACK7');
