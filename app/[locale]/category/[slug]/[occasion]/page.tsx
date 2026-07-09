import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  getCanonicalUrl,
  getAlternateLanguages,
  getBaseUrl,
  OG_LOCALE_MAP,
  type Locale,
} from '@/lib/seo/locales';
import { getLocalized } from '@/lib/i18n/localize';
import { toDbCategorySlug, toPublicCategorySlug } from '@/lib/seo/categorySlugs';
import { geoCityLabel, clusterLabel } from '@/lib/seo/landingLabels';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';

export const revalidate = 300;

const PRODUCT_CARD_FIELDS = 'id, name, slug, price, price_from, short_description, images, translations';

async function getLanding(categorySlug: string, occasion: string) {
  const supabase = getAdminClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from('landing_pages')
    .select('*')
    .eq('category_slug', categorySlug)
    .eq('occasion', occasion)
    .eq('is_active', true)
    .maybeSingle();
  return data as any;
}

async function getLandingProducts(lp: any) {
  const supabase = getAdminClient();
  if (!supabase) return [];

  // Size-based subcategory pages ("200-foto", "300-foto", "500-foto", "800-foto")
  // list EVERY active album of that size in the category automatically — the size
  // is the number in the occasion and in each album's name. No manual product_slugs
  // to keep in sync: a new album shows up here as soon as it's active in the right
  // category. (Any curated product_slugs on these pages are intentionally ignored.)
  const sizeMatch = /^(\d+)-foto$/.exec(lp.occasion || '');
  if (sizeMatch) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', lp.category_slug)
      .maybeSingle();
    if (!cat) return [];
    const { data } = await supabase
      .from('products')
      .select(PRODUCT_CARD_FIELDS)
      .eq('category_id', (cat as any).id)
      .eq('is_active', true);
    // Match the size as a standalone number so "200" never catches "1200".
    const re = new RegExp(`(^|[^0-9])${sizeMatch[1]}([^0-9]|$)`);
    const arr = ((data as any[]) || []).filter((p) => re.test(p.name || ''));
    arr.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'uk'));
    return arr;
  }

  if (Array.isArray(lp.product_slugs) && lp.product_slugs.length > 0) {
    const { data } = await supabase
      .from('products')
      .select(PRODUCT_CARD_FIELDS)
      .in('slug', lp.product_slugs)
      .eq('is_active', true);
    const arr = (data as any[]) || [];
    // Preserve the curated order from product_slugs.
    arr.sort((a, b) => lp.product_slugs.indexOf(a.slug) - lp.product_slugs.indexOf(b.slug));
    return arr;
  }
  const { data: cat } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', lp.category_slug)
    .maybeSingle();
  if (!cat) return [];
  const { data } = await supabase
    .from('products')
    .select(PRODUCT_CARD_FIELDS)
    .eq('category_id', (cat as any).id)
    .eq('is_active', true)
    .order('created_at', { nullsFirst: false });
  return (data as any[]) || [];
}

const L: Record<string, { home: string; catalog: string; from: string; faq: string; countries: string }> = {
  uk: { home: 'Головна', catalog: 'Каталог', from: 'від', faq: 'Часті питання', countries: 'Travel Book по інших країнах' },
  en: { home: 'Home', catalog: 'Catalog', from: 'from', faq: 'FAQ', countries: 'Travel Books for other countries' },
  ro: { home: 'Acasă', catalog: 'Catalog', from: 'de la', faq: 'Întrebări frecvente', countries: 'Travel Book pentru alte țări' },
  pl: { home: 'Strona główna', catalog: 'Katalog', from: 'od', faq: 'FAQ', countries: 'Travel Book — inne kraje' },
  de: { home: 'Startseite', catalog: 'Katalog', from: 'ab', faq: 'FAQ', countries: 'Travel Books für andere Länder' },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string; occasion: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug, occasion } = await params;
  const locale = (rawLocale || 'uk') as Locale;
  const lp = await getLanding(toDbCategorySlug(slug), occasion);
  if (!lp) return { title: 'Touch.Memories' };

  const lpTitle = getLocalized(lp, locale, 'meta_title') || getLocalized(lp, locale, 'h1');
  const title = (lpTitle || 'Touch.Memories').toString();
  const description = (getLocalized(lp, locale, 'meta_description') || getLocalized(lp, locale, 'intro') || '')
    .toString()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  const path = `/category/${toPublicCategorySlug(lp.category_slug)}/${occasion}`;
  const ogImage = lp.hero_image || `${getBaseUrl()}/og-image.jpg`;

  return {
    title: title.includes('Touch.Memories') ? title : `${title} | Touch.Memories`,
    description,
    alternates: {
      canonical: getCanonicalUrl(locale, path),
      languages: getAlternateLanguages(path),
    },
    openGraph: {
      title,
      description,
      url: getCanonicalUrl(locale, path),
      siteName: 'Touch.Memories',
      locale: OG_LOCALE_MAP[locale],
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; occasion: string }>;
}) {
  const { locale: rawLocale, slug, occasion } = await params;
  const locale = (rawLocale || 'uk') as Locale;
  const t = L[locale] || L.uk;

  const dbCategorySlug = toDbCategorySlug(slug);
  const lp = await getLanding(dbCategorySlug, occasion);
  if (!lp) notFound();

  const products = await getLandingProducts(lp);
  const publicSlug = toPublicCategorySlug(lp.category_slug);

  // Category display name for the breadcrumb.
  const supabase = getAdminClient();
  const { data: cat } = supabase
    ? await supabase.from('categories').select('name, translations').eq('slug', lp.category_slug).maybeSingle()
    : { data: null };
  const catName = cat ? (getLocalized(cat as any, locale, 'name') || (cat as any).name) : '';

  // Sibling landing pages for internal linking (discovery + link equity).
  let geoSiblings: Array<{ category_slug: string; occasion: string; kind: string; h1: string | null; translations?: any }> = [];
  let countrySiblings: typeof geoSiblings = [];
  let otherSiblings: typeof geoSiblings = [];
  if (supabase) {
    const { data: sib } = await supabase
      .from('landing_pages')
      .select('category_slug, occasion, kind, h1, translations')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    const siblings = ((sib as any[]) || []).filter(
      (r) => !(r.category_slug === lp.category_slug && r.occasion === occasion)
    );
    geoSiblings = siblings.filter((r) => r.kind === 'geo').slice(0, 15);
    // Country pages link only to sibling countries of the SAME category —
    // a Travel Book Italy page should not surface photobook city pages first.
    countrySiblings = siblings
      .filter((r) => r.kind === 'country' && r.category_slug === lp.category_slug)
      .slice(0, 15);
    otherSiblings = siblings.filter((r) => r.kind !== 'geo' && r.kind !== 'country').slice(0, 12);
  }

  const site = getBaseUrl();
  const pageUrl = getCanonicalUrl(locale, `/category/${publicSlug}/${occasion}`);
  const catUrl = getCanonicalUrl(locale, `/category/${publicSlug}`);
  const lpH1 = getLocalized(lp, locale, 'h1') || lp.h1;
  const lpIntro = getLocalized(lp, locale, 'intro') || lp.intro;
  const lpMetaDesc = getLocalized(lp, locale, 'meta_description') || lp.meta_description;
  const introParas = String(lpIntro || '').split(/\n{2,}/).map((p: string) => p.trim()).filter(Boolean);

  // FAQ: array of {q, a}. Localized copy lives in translations.{locale}.faq
  // (same convention as text fields); uk reads the base column.
  const faqRaw = locale === 'uk'
    ? lp.faq
    : (((lp.translations as any) || {})[locale] || {}).faq || lp.faq;
  const faqItems: Array<{ q: string; a: string }> = Array.isArray(faqRaw)
    ? faqRaw.filter((f: any) => f && typeof f.q === 'string' && typeof f.a === 'string' && f.q.trim() && f.a.trim())
    : [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#collection`,
        name: lpH1,
        url: pageUrl,
        ...(lpMetaDesc || lpIntro
          ? { description: String(lpMetaDesc || lpIntro).replace(/\s+/g, ' ').slice(0, 300) }
          : {}),
        isPartOf: { '@id': `${site}/#website` },
        ...(lp.hero_image ? { primaryImageOfPage: lp.hero_image } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t.home, item: getCanonicalUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: t.catalog, item: getCanonicalUrl(locale, '/catalog') },
          ...(catName ? [{ '@type': 'ListItem', position: 3, name: catName, item: catUrl }] : []),
          { '@type': 'ListItem', position: catName ? 4 : 3, name: lpH1, item: pageUrl },
        ],
      },
      ...(products.length
        ? [
            {
              '@type': 'ItemList',
              numberOfItems: products.length,
              itemListElement: products.map((p, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: getCanonicalUrl(locale, `/catalog/${p.slug}`),
                name: getLocalized(p, locale, 'name') || p.name,
              })),
            },
          ]
        : []),
      ...(faqItems.length
        ? [
            {
              '@type': 'FAQPage',
              '@id': `${pageUrl}#faq`,
              mainEntity: faqItems.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navigation />

      <main style={{ flex: 1, padding: '140px 20px 80px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <nav aria-label="breadcrumb" style={{ fontSize: 14, color: '#64748b', marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href={`/${locale}`} style={{ color: '#64748b', textDecoration: 'none' }}>{t.home}</Link>
          <span>/</span>
          <Link href={`/${locale}/catalog`} style={{ color: '#64748b', textDecoration: 'none' }}>{t.catalog}</Link>
          {catName && (
            <>
              <span>/</span>
              <Link href={`/${locale}/category/${publicSlug}`} style={{ color: '#64748b', textDecoration: 'none' }}>{catName}</Link>
            </>
          )}
          <span>/</span>
          <span style={{ color: '#1e2d7d', fontWeight: 600 }}>{lpH1}</span>
        </nav>

        <header style={{ marginBottom: 32, maxWidth: 800 }}>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 900, color: '#1e2d7d', letterSpacing: '-0.02em', marginBottom: 16 }}>
            {lpH1}
          </h1>
          {introParas.map((p: string, i: number) => (
            <p key={i} style={{ fontSize: 16, lineHeight: 1.75, color: '#475569', marginBottom: 14 }}>{p}</p>
          ))}
        </header>

        {products.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 24 }}>
            {products.map((p) => {
              const pName = getLocalized(p, locale, 'name') || p.name;
              const img = Array.isArray(p.images) ? p.images[0] : undefined;
              const priceLabel =
                p.price != null
                  ? `${p.price_from ? t.from + ' ' : ''}${Number(p.price).toLocaleString('uk-UA')} ₴`
                  : '';
              return (
                <Link
                  key={p.id}
                  href={`/${locale}/catalog/${p.slug}`}
                  style={{ display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', background: '#fff', textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ aspectRatio: '1 / 1', background: '#f1f3fb', overflow: 'hidden' }}>
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={pName} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    )}
                  </div>
                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e2d7d', lineHeight: 1.35, margin: 0 }}>{pName}</h3>
                    {priceLabel && <div style={{ fontSize: 15, fontWeight: 700, color: '#263A99' }}>{priceLabel}</div>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {faqItems.length > 0 && (
          <section aria-label={t.faq} style={{ marginTop: 56, maxWidth: 800 }}>
            <h2 style={{ fontSize: 'clamp(1.3rem, 3vw, 1.7rem)', fontWeight: 800, color: '#1e2d7d', marginBottom: 20 }}>{t.faq}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {faqItems.map((f, i) => (
                <details key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', padding: '14px 18px' }}>
                  <summary style={{ fontSize: 16, fontWeight: 600, color: '#1e2d7d', cursor: 'pointer', listStyle: 'none' }}>{f.q}</summary>
                  <p style={{ fontSize: 15, lineHeight: 1.7, color: '#475569', margin: '10px 0 2px' }}>{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {(geoSiblings.length > 0 || countrySiblings.length > 0 || otherSiblings.length > 0) && (
          <section aria-label="Інші сторінки" style={{ marginTop: 56, paddingTop: 32, borderTop: '1px solid #eee' }}>
            {geoSiblings.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#263A99', textTransform: 'uppercase', letterSpacing: 0.6, margin: '0 0 12px' }}>Фотокниги в інших містах</h2>
                <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', listStyle: 'none', padding: 0, margin: 0 }}>
                  {geoSiblings.map((r) => (
                    <li key={`${r.category_slug}-${r.occasion}`}>
                      <Link href={`/${locale}/category/${toPublicCategorySlug(r.category_slug)}/${r.occasion}`} style={{ fontSize: 14, color: '#475569', textDecoration: 'none' }}>{geoCityLabel(r.occasion, r.h1)}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {countrySiblings.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#263A99', textTransform: 'uppercase', letterSpacing: 0.6, margin: '0 0 12px' }}>{t.countries}</h2>
                <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', listStyle: 'none', padding: 0, margin: 0 }}>
                  {countrySiblings.map((r) => (
                    <li key={`${r.category_slug}-${r.occasion}`}>
                      <Link href={`/${locale}/category/${toPublicCategorySlug(r.category_slug)}/${r.occasion}`} style={{ fontSize: 14, color: '#475569', textDecoration: 'none' }}>{clusterLabel(getLocalized(r, locale, 'h1'), r.occasion)}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {otherSiblings.length > 0 && (
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#263A99', textTransform: 'uppercase', letterSpacing: 0.6, margin: '0 0 12px' }}>Схожі сторінки</h2>
                <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', listStyle: 'none', padding: 0, margin: 0 }}>
                  {otherSiblings.map((r) => (
                    <li key={`${r.category_slug}-${r.occasion}`}>
                      <Link href={`/${locale}/category/${toPublicCategorySlug(r.category_slug)}/${r.occasion}`} style={{ fontSize: 14, color: '#475569', textDecoration: 'none' }}>{clusterLabel(getLocalized(r, locale, 'h1'), r.occasion)}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </main>

      <Footer categories={[]} />
    </div>
  );
}
