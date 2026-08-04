import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getPhotographerByToken } from '@/lib/photographers/helpers';

export const dynamic = 'force-dynamic';

// Same guard as the b2b register route: the email is interpolated into a
// PostgREST .or() filter string, where commas/parentheses could inject
// extra filter terms. Our own DB emails should always pass this.
const SAFE_EMAIL_RE = /^[^\s@,()]+@[^\s@,()]+\.[^\s@,()]+$/;

/** The photographer's own shop orders (auth = cabinet token) — so the
 *  cabinet can show their discounted purchases next to galleries and
 *  referral earnings. Orders are matched by the linked customer account
 *  and by email (guest checkouts with the same address). */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const photographer = await getPhotographerByToken(token);
  if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const admin = getAdminClient();
  const parts: string[] = [];
  if (photographer.customer_id) parts.push(`customer_id.eq.${photographer.customer_id}`);
  if (photographer.email && SAFE_EMAIL_RE.test(photographer.email)) parts.push(`customer_email.eq.${photographer.email.toLowerCase()}`);
  if (parts.length === 0) return NextResponse.json({ orders: [] });

  const { data: orders, error } = await admin
    .from('orders')
    .select('id, order_number, created_at, order_status, payment_status, total, subtotal, discount_amount, discount_type, promo_code, items')
    .or(parts.join(','))
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) {
    console.error('[photographers/orders] list failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    orders: (orders || []).map(o => ({
      id: o.id,
      order_number: o.order_number,
      created_at: o.created_at,
      order_status: o.order_status,
      payment_status: o.payment_status,
      total: o.total,
      subtotal: o.subtotal,
      discount_amount: o.discount_amount,
      discount_type: o.discount_type,
      promo_code: o.promo_code,
      items_count: Array.isArray(o.items) ? o.items.length : 0,
    })),
  });
}
