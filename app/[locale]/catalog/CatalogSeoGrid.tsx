import Link from 'next/link';
import styles from './catalog.module.css';
import { getLocalized } from '@/lib/i18n/localize';
import { localePath } from '@/lib/i18n/path';
import { detectCurrency } from '@/lib/i18n/currency';
import { formatDisplayPrice } from '@/lib/payment/pricing-region';
import type { Locale } from '@/lib/seo/locales';

// «від 675 ₴» — the same five spellings the category page carries in its own
// L map. Hardcoding the Ukrainian one here would print Cyrillic prices on the
// /de and /pl catalogs for the moment before hydration, and in the HTML a
// crawler keeps.
const FROM: Record<string, string> = {
  uk: 'від', en: 'from', ro: 'de la', pl: 'od', de: 'ab',
};

/**
 * The catalog grid as plain server-rendered HTML.
 *
 * Why this exists
 * ---------------
 * CatalogClient renders the real, interactive grid inside a <Suspense>
 * boundary, because CatalogContent calls useSearchParams() to read ?category=.
 * A client component that reads search params opts its whole subtree out of
 * prerendering: on the server React emits the FALLBACK, not the component. The
 * fallback was a spinner, so the initial HTML of /uk/catalog — the page every
 * category and every product links back to — contained no product name, no
 * price and no link at all. Googlebot renders JS eventually, but "eventually"
 * is a second crawl that may never be scheduled for a page it has already seen
 * as empty, and the links inside it never entered the link graph at all.
 *
 * Making this component the Suspense fallback rather than an extra block is
 * deliberate: it is the same slot, so there is no duplicate grid to hide after
 * hydration, no layout shift beyond the one the spinner already caused, and no
 * risk of a hydration mismatch — React never tries to reconcile a fallback with
 * the resolved subtree. A human sees it for the moment the spinner used to
 * occupy; a crawler sees the whole catalog.
 *
 * It is intentionally not interactive. Sorting, filtering and the cart button
 * all belong to the real grid that replaces it.
 */
export function CatalogSeoGrid({
  products,
  locale,
}: {
  products: any[];
  locale: Locale;
}) {
  if (!products.length) return null;
  // detectCurrency guards on `typeof navigator`, so on the server every
  // non-uk locale resolves to its default (EUR) — the same value the client
  // picks for everyone except en-GB/en-US. formatDisplayPrice is pure.
  const currency = detectCurrency(locale);

  return (
    <div className={styles.productGrid} style={{ padding: '0 20px', maxWidth: 1400, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {products.map((p) => {
        const name = getLocalized(p, locale, 'name') || p.name;
        const price = formatDisplayPrice(Number(p.price) || 0, locale, currency);
        return (
          <Link
            key={p.id}
            href={localePath(locale, `/catalog/${p.slug}`)}
            style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
          >
            {p.images?.[0] && (
              // Plain <img>: this markup is replaced within a tick of
              // hydration, so paying for next/image optimisation here would
              // queue transforms for images the visitor never keeps on screen.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.images[0]}
                alt={name}
                width={320}
                height={400}
                style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', borderRadius: 3, background: '#f5f5f5' }}
              />
            )}
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '12px 0 4px' }}>{name}</h2>
            {price && (
              <p style={{ fontSize: 15, margin: 0, color: '#1e2d7d' }}>
                {p.price_from ? `${FROM[locale] || FROM.uk} ${price}` : price}
              </p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
