-- Category long-form copy + FAQ, and the header nav pointed at canonical URLs.
--
-- 1. categories.body / categories.faq
--    The glossy-magazines category was three sentences above a grid of two
--    products. It is the page that should be winning «глянцевий журнал на
--    замовлення», and it gave a reader nothing to stay for and a crawler
--    almost nothing to index. body is HTML (h2/p) rendered UNDER the grid —
--    above it the first product row falls off a phone screen — and faq feeds
--    BOTH the visible section and the FAQPage markup from the same rows, so
--    the two cannot drift.
--
--    Every fact in the copy is read off the two product rows in this category
--    (specs, options, price, production_time). No new numbers were introduced.
--
-- 2. navigation_links
--    The header's category links pointed at /catalog?category=X. That page
--    self-canonicalises to /catalog, so the most-clicked internal links on the
--    site handed their weight to a page that is not about the category at all.
--    They now point at /category/{ua-slug} — the canonical page — using the
--    public Ukrainian slug from lib/seo/categorySlugs.ts.
--
--    Only categories with active products are moved: an empty category answers
--    /category with a 301 to /catalog, and a nav link must never resolve
--    through a redirect. graduation-books is therefore left alone (inactive,
--    zero active products).

alter table categories add column if not exists body text;
alter table categories add column if not exists faq jsonb;

comment on column categories.body is
  'Long-form category copy rendered UNDER the product grid, as HTML (h2/p). The short `description` stays above the grid. Per-locale overrides in translations.{locale}.body.';
comment on column categories.faq is
  'Array of {q, a}, same convention as products.faq and landing_pages.faq. Rendered on the category page AND emitted as FAQPage from the same rows. Per-locale overrides in translations.{locale}.faq.';

with m(db, ua) as (values
  ('photobooks','fotoknygy'), ('travelbooks','trevel-buky'),
  ('hlyantsevi-zhurnaly','hlyantsevi-zhurnaly'), ('guestbooks','knyha-pobazhan'),
  ('photomagnets','fotomahnity'), ('posters','postery'), ('calendars','fotokalendari'),
  ('prints','druk-foto'), ('puzzles','pazly'))
update navigation_links n
set link_url = '/category/' || m.ua
from m
join categories c on c.slug = m.db
where n.link_url = '/catalog?category=' || m.db
  and c.is_active
  and (select count(*) from products p where p.category_id = c.id and p.is_active) > 0;
