-- Gallery storage plans (Diana, 2026-08-04): free 4 GB, start 50 GB / 149 ₴,
-- pro 250 GB / 329 ₴, studio 500 GB / 599 ₴. Definitions live in
-- lib/photographers/plans.ts; the column only records which plan a
-- photographer is on. Payments are a separate step — for now the plan is set
-- by hand from the admin side.
ALTER TABLE photographers
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';
