import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const MAX_ITEMS = 30;

/**
 * Resolver for the Meta Shops checkout URL flow. Meta lands the customer on
 * /[locale]/meta-checkout?products={id}:{qty},{id}:{qty}&coupon=CODE; that
 * page posts the parsed pairs here and gets back the public product data it
 * needs to fill the cart. Public by design (it powers a checkout entry
 * point) and returns only storefront-safe fields of active products.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const raw = Array.isArray(body?.items) ? body.items : [];
  const items: { id: string; qty: number }[] = raw
    .map((it: any) => ({
      id: String(it?.id || '').trim(),
      qty: Math.max(1, Math.min(99, Number(it?.qty) || 1)),
    }))
    .filter((it: { id: string }) => /^[0-9a-f-]{36}$/i.test(it.id))
    .slice(0, MAX_ITEMS);

  if (items.length === 0) return NextResponse.json({ error: 'Немає товарів' }, { status: 400 });

  const admin = getAdminClient();
  const { data: products, error } = await admin
    .from('products')
    .select('id, name, slug, price, sale_price, images, category_id, payment_mode, categories(slug)')
    .in('id', items.map(i => i.id))
    .eq('is_active', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byId = new Map((products || []).map((p: any) => [p.id, p]));
  const resolved = items
    .map(({ id, qty }) => {
      const p: any = byId.get(id);
      if (!p) return null;
      const category = Array.isArray(p.categories) ? p.categories[0] : p.categories;
      return {
        id: p.id,
        product_id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.sale_price ?? p.price ?? 0),
        qty,
        image: Array.isArray(p.images) ? p.images[0] : undefined,
        category_slug: category?.slug,
        payment_mode: p.payment_mode || undefined,
      };
    })
    .filter(Boolean);

  if (resolved.length === 0) return NextResponse.json({ error: 'Товари не знайдено' }, { status: 404 });
  return NextResponse.json({ items: resolved, missing: items.length - resolved.length });
}
