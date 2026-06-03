-- Per-product override for the production/shipping-time line on the product page.
alter table public.products add column if not exists production_time text;
