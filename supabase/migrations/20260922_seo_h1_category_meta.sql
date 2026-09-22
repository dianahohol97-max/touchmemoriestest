-- SEO: an H1 that is not the product name, and real meta fields on categories.
--
-- Why products needs its own h1 column
-- ------------------------------------
-- The product page has always rendered `products.name` as its <h1>
-- (ProductClient.tsx). That name is not a heading — it is the label the cart,
-- the order card, KeyCRM and the Facebook catalogue feed all print, so it has
-- to stay short and stable («Travel Book»). A heading wants the query the page
-- is trying to win («Тревелбук 20×30 — книга про одну твою подорож»).
--
-- Renaming the product to fix the heading would have rewritten every order
-- line and every CRM mirror. A separate, optional column lets the two diverge
-- and keeps the fallback honest: a product with no h1 still renders its name,
-- exactly as before.
alter table products add column if not exists h1 text;

comment on column products.h1 is
  'Optional page heading. NULL means "use name". Per-locale overrides live in '
  'translations.{locale}.h1, the same convention landing_pages already uses. '
  'Never printed in the cart, an order or the CRM — those read name.';

-- Why categories needs meta columns at all
-- ----------------------------------------
-- `categories` had no meta_title/meta_description, unlike `products`. The
-- category page therefore built its <title> as "{name} | Touch.Memories" and
-- cut `description` to 160 characters with a bare slice() — mid-word, no word
-- boundary. For «Глянцеві журнали» that produced a snippet that stopped in the
-- middle of «обкладинку», which is what Diana saw in the SERP.
--
-- The cut is fixed in code (toMetaText), but a truncated body paragraph is a
-- poor description whatever way it is cut: the body speaks to a reader who is
-- already on the page, the description has to earn the click. These columns let
-- the two be written separately, and both stay NULL-able so every category that
-- has no override keeps the current derived behaviour.
alter table categories add column if not exists meta_title text;
alter table categories add column if not exists meta_description text;

comment on column categories.meta_title is
  'Optional <title> override. NULL falls back to "{name} | Touch.Memories". '
  'Per-locale overrides in translations.{locale}.meta_title.';
comment on column categories.meta_description is
  'Optional meta description. NULL falls back to the trimmed description body. '
  'Per-locale overrides in translations.{locale}.meta_description.';

-- Reviews: the product page reads them by product_id on every render, and the
-- homepage reads the active ones. Both filters are unindexed today.
create index if not exists reviews_product_active_idx
  on reviews (product_id, is_active, sort_order)
  where product_id is not null;
