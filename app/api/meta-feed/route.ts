import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getBaseUrl } from '@/lib/seo/locales';

export const dynamic = 'force-dynamic';

/**
 * Product feed for Meta Commerce Manager (Facebook/Instagram Shop).
 *
 * Meta fetches this URL on a schedule, so it is public by design — but it
 * exposes ONLY the nine catalog columns below (no cost prices, stock levels
 * or any other internal fields). CSV per Meta's data-feed spec:
 * https://www.facebook.com/business/help/120325381656392
 *
 * Field sources (real `products` columns, verified against prod):
 *   id          → products.id (uuid) — matches the ids the pixel microdata
 *                 sends (product:retailer_item_id) and the JSON feed
 *                 (/api/feeds/facebook-catalog.json), so all three agree.
 *   title       → products.name
 *   description → products.description stripped of HTML (may contain <p>…);
 *                 falls back to the name-based stub — Meta rejects empty.
 *   price       → sale_price when set, else price — what the customer
 *                 actually pays on the site.
 *   link        → {SITE}/uk/catalog/{slug} (the canonical product page)
 *   image_link  → images[0] (already absolute Supabase storage URLs)
 *
 * Visibility filter: is_active = true only — the same filter the storefront
 * and the existing JSON feed use (`status` is not part of site visibility).
 */

const HEADERS = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand', 'quantity_to_sell_on_facebook'] as const;

/** RFC 4180: quote a field if it contains a comma, quote or newline;
 *  double any inner quotes. Otherwise the feed breaks on the first
 *  product name with a comma. */
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Descriptions in the DB are rich text (<p>, <br>…) — Meta wants plain text. */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET() {
  const admin = getAdminClient();
  const site = getBaseUrl();

  const { data: products, error } = await admin
    .from('products')
    .select('id, name, slug, description, short_description, price, sale_price, images, track_inventory, stock_available')
    .eq('is_active', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const lines: string[] = [HEADERS.join(',')];

  for (const p of products || []) {
    const title = (p.name || '').trim();
    if (!p.id || !title || !p.slug) continue;

    let description = stripHtml(p.description || p.short_description || '');
    if (!description) description = `${title} — персоналізований подарунок від Touch.Memories.`;
    if (description.length > 4900) description = description.slice(0, 4900);

    const effectivePrice = Number(p.sale_price ?? p.price ?? 0);
    if (!(effectivePrice > 0)) continue; // Meta rejects zero/empty prices

    const image = Array.isArray(p.images) && p.images[0] ? String(p.images[0]) : `${site}/og-image.jpg`;

    // Meta hides items with no sellable quantity ("Missing quantity" → not
    // shown in Shops). Most products are made-to-order, so a large constant
    // is honest; inventory-tracked items report their real stock.
    const quantity = p.track_inventory ? Math.max(Number(p.stock_available) || 0, 0) : 100;

    const row: Record<(typeof HEADERS)[number], string> = {
      id: String(p.id),
      title,
      description,
      availability: 'in stock',
      condition: 'new',
      price: `${effectivePrice.toFixed(0)} UAH`,
      link: `${site}/uk/catalog/${p.slug}`,
      image_link: image,
      brand: 'Touch.Memories',
      quantity_to_sell_on_facebook: String(quantity),
    };

    lines.push(HEADERS.map(h => csvField(row[h])).join(','));
  }

  return new NextResponse(lines.join('\r\n') + '\r\n', {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate',
    },
  });
}
