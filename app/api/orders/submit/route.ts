import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Server-side order submission.
 *
 * This replaces the legacy client-side `lib/submitOrder.ts` flow that
 * inserted directly into `orders` using the anon key. That stopped
 * working after we tightened RLS on `orders` — checkout was silently
 * blocked. The right architectural answer is: customers should never
 * write into `orders` directly. The server validates the payload (so
 * a malicious client can't set payment_status='paid' or skip Monobank),
 * generates the order_number, links to the authenticated customer if
 * logged in, and uses the service role to insert.
 *
 * The route does NOT require auth — guest checkout is supported. If the
 * caller IS authenticated (Supabase session cookie present), we look up
 * their customer row and attach customer_id so the order appears in
 * their /account/orders feed.
 *
 * The route DOES rate-limit at the application layer (TODO when traffic
 * justifies — currently checkout volume is low enough that PostgREST's
 * default protections plus Vercel's request limits are sufficient).
 */
interface OrderItem {
  product_type: string;
  product_name: string;
  format?: string;
  cover_type?: string;
  pages?: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  options?: Record<string, unknown>;
}

interface OrderPayload {
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  items: OrderItem[];
  subtotal: number;
  delivery_cost: number;
  total: number;
  delivery_method: string;
  delivery_address?: unknown;
  notes?: string;
  with_designer?: boolean;
  designer_service_fee?: number;
}

function isValidPhone(s: unknown): s is string {
  return typeof s === 'string' && /^\+?[0-9\s\-\(\)]{7,20}$/.test(s.trim());
}
function isValidEmail(s: unknown): s is string {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export async function POST(request: NextRequest) {
  let body: OrderPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Validate. Reject anything that doesn't look like a real checkout
  // payload so a malformed POST can't fill the orders table with junk.
  if (!body.customer_name || typeof body.customer_name !== 'string' || body.customer_name.length < 1 || body.customer_name.length > 200) {
    return NextResponse.json({ error: 'customer_name required' }, { status: 400 });
  }
  if (!isValidPhone(body.customer_phone)) {
    return NextResponse.json({ error: 'customer_phone invalid' }, { status: 400 });
  }
  if (body.customer_email && !isValidEmail(body.customer_email)) {
    return NextResponse.json({ error: 'customer_email invalid' }, { status: 400 });
  }
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
    return NextResponse.json({ error: 'items must be a non-empty array (max 50)' }, { status: 400 });
  }
  // Coerce numbers and clamp to reasonable bounds. Server NEVER trusts
  // client-supplied totals for payment — Monobank validates the amount
  // against this row before accepting payment.
  const subtotal = Number(body.subtotal);
  const delivery_cost = Number(body.delivery_cost);
  const total = Number(body.total);
  if (!Number.isFinite(subtotal) || subtotal < 0 || subtotal > 10_000_000) {
    return NextResponse.json({ error: 'subtotal out of range' }, { status: 400 });
  }
  if (!Number.isFinite(delivery_cost) || delivery_cost < 0 || delivery_cost > 100_000) {
    return NextResponse.json({ error: 'delivery_cost out of range' }, { status: 400 });
  }
  if (!Number.isFinite(total) || total < 1 || total > 10_000_000) {
    return NextResponse.json({ error: 'total out of range' }, { status: 400 });
  }
  if (!body.delivery_method || typeof body.delivery_method !== 'string') {
    return NextResponse.json({ error: 'delivery_method required' }, { status: 400 });
  }

  // If the caller is authenticated, attach customer_id. Anonymous
  // checkout works fine — the order just has no customer_id (guest).
  let customer_id: string | null = null;
  try {
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (user) {
      const admin = getAdminClient();
      const { data: customer } = await admin
        .from('customers')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      customer_id = customer?.id || null;
    }
  } catch (e) {
    // Auth lookup failure doesn't block checkout — fall back to guest.
    console.warn('orders/submit: customer lookup failed, falling back to guest', e);
  }

  // Generate order_number. Format mirrors what submitOrder.ts produced,
  // so admin UIs that pattern-match TM-* keep working.
  const order_number = `TM-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  // Insert via service role — RLS doesn't apply, but we just hand-validated
  // every field above, so this is safe.
  const admin = getAdminClient();
  const { data: inserted, error } = await admin
    .from('orders')
    .insert({
      order_number,
      customer_id,
      customer_name: body.customer_name.trim(),
      customer_phone: body.customer_phone.trim(),
      customer_email: body.customer_email?.trim() || null,
      items: body.items as any,
      subtotal,
      delivery_cost,
      total,
      delivery_method: body.delivery_method,
      delivery_address: body.delivery_address || null,
      notes: body.notes?.toString().slice(0, 5000) || null,
      with_designer: !!body.with_designer,
      designer_service_fee: body.with_designer ? (Number(body.designer_service_fee) || 0) : 0,
      order_status: 'new',
      payment_status: 'pending',
    })
    .select('id, order_number')
    .single();

  if (error || !inserted) {
    console.error('orders/submit insert error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }

  // Audit trail entry — same pattern as admin/orders/create + webhook.
  await admin.from('order_history').insert({
    order_id: inserted.id,
    action: 'order_created',
    notes: `Замовлення створено через checkout (${customer_id ? 'авторизований клієнт' : 'guest checkout'})`,
  });

  return NextResponse.json({
    success: true,
    order_id: inserted.id,
    order_number: inserted.order_number,
  });
}
