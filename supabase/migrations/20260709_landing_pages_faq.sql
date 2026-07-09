-- FAQ support for SEO landing pages (country pages for Travel Book etc.).
-- Array of {q, a} objects rendered as an FAQ section + FAQPage JSON-LD.
-- Localized via translations.{locale}.faq (same convention as other fields).
alter table public.landing_pages add column if not exists faq jsonb not null default '[]'::jsonb;
comment on column public.landing_pages.faq is 'Array of {q, a} objects rendered as FAQ section + FAQPage schema. Localized via translations.{locale}.faq.';
