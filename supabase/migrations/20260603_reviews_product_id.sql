-- Link reviews to a specific product so product pages can emit a genuine
-- AggregateRating (Google requires the rating to reflect reviews of THAT item).
-- Nullable: existing category-level social-proof reviews keep product_id NULL.
alter table public.reviews
  add column if not exists product_id uuid references public.products(id) on delete set null;

create index if not exists reviews_product_id_idx on public.reviews(product_id);
