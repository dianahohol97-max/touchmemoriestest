-- Customer-submitted reviews go through moderation:
--   status = 'pending' (default for submissions) -> admin approves -> 'approved'
-- Admin-created reviews default to 'approved'. Public can only read approved+active.
alter table public.reviews add column if not exists status text not null default 'approved';
create index if not exists reviews_status_idx on public.reviews(status);

drop policy if exists "Anyone reads active reviews" on public.reviews;
create policy "Anyone reads active reviews" on public.reviews
  for select using (is_active = true and status = 'approved');

-- Admins must see ALL reviews (incl. pending) to moderate; anon stays limited.
drop policy if exists "Admins read all reviews" on public.reviews;
create policy "Admins read all reviews" on public.reviews
  for select using (is_admin());
