-- Fulfillment type controls the production/shipping label on the product page.
--   'in_stock' -> "Термін відправки"; 'made_to_order' -> "Термін виготовлення"; null -> auto.
alter table public.products add column if not exists fulfillment_type text;
