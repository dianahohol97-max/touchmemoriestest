import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { computePaymentAmounts, getAvailablePaymentOptions, type CartItemPayment } from '@/lib/payment/options';

export const dynamic = 'force-dynamic';

/**
 * Server-side order submission.
 *
 * Customers never write into `orders` directly. The server validates the
 * payload (so a malicious client can't set payment_status='paid' or skip
 * Monobank), generates the order_number, and inserts via the service role.
 *
 * Payment type validation: the server re-checks whether the cart is
 * actually eligible for split payment (queries products.payment_mode by
 * slug). A client can't unlock split by lying — if any item is full_only,
 * the order is forced to payment_type='full' regardless of payload.
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
  slug?: string; // needed for payment_mode lookup
}

interface OrderPayload {
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_telegram?: string;
  items: OrderItem[];
  subtotal: number;
  delivery_cost: number;
  total: number;
  delivery_method: string;
  delivery_address?: unknown;
  notes?: string;
  with_designer?: boolean;
  designer_service_fee?: number;
  payment_type?: 'full' | 'split';
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

  // Validate. Reject anything that doesn't look like a real checkout payload.
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

  // If the caller is authenticated, attach customer_id.
  let customer_id: string | null = null;
  try {
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (user) {
      const admin0 = getAdminClient();
      const { data: customer } = await admin0
        .from('customers')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      customer_id = customer?.id || null;
    }
  } catch (e) {
    console.warn('orders/submit: customer lookup failed, falling back to guest', e);
  }

  // ──────────────────────────────────────────────────────────────
  // Server-side payment_type validation
  //   - Look up payment_mode for every item slug
  //   - Re-compute allowSplit; if client requested 'split' but it's not allowed → force 'full'
  // ──────────────────────────────────────────────────────────────
  const admin = getAdminClient();

  let payment_type: 'full' | 'split' = body.payment_type === 'split' ? 'split' : 'full';
  if (payment_type === 'split') {
    const slugs = Array.from(new Set(body.items.map(i => i.slug).filter(Boolean))) as string[];
    if (slugs.length > 0) {
      const { data: prodRows } = await admin
        .from('products')
        .select('slug, payment_mode')
        .in('slug', slugs);
      const modeBySlug = new Map<string, string>();
      (prodRows || []).forEach(r => modeBySlug.set(r.slug, r.payment_mode));
      const cartForCheck: CartItemPayment[] = body.items.map(i => ({
        slug: i.slug,
        payment_mode: (modeBySlug.get(i.slug || '') as any) || 'full_only',
      }));
      const opts = getAvailablePaymentOptions(cartForCheck);
      if (!opts.allowSplit) {
        // Client requested split but cart isn't eligible — silently downgrade.
        payment_type = 'full';
      }
    } else {
      payment_type = 'full';
    }
  }

  const amounts = computePaymentAmounts(total, payment_type, body.delivery_method);

  // Generate order_number.
  const order_number = `TM-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const { data: inserted, error } = await admin
    .from('orders')
    .insert({
      order_number,
      customer_id,
      customer_name: body.customer_name.trim(),
      customer_phone: body.customer_phone.trim(),
      customer_email: body.customer_email?.trim() || null,
      customer_telegram: body.customer_telegram?.toString().trim().slice(0, 200) || null,
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
      payment_type,
      prepaid_amount: amounts.prepaid_amount,
      cod_amount: amounts.cod_amount,
      pickup_unpaid_balance: amounts.pickup_unpaid_balance,
    })
    .select('id, order_number, payment_type, prepaid_amount, cod_amount, pickup_unpaid_balance')
    .single();

  if (error || !inserted) {
    console.error('orders/submit insert error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }

  // Audit trail
  await admin.from('order_history').insert({
    order_id: inserted.id,
    action: 'order_created',
    notes: payment_type === 'split'
      ? `Замовлення створено через checkout (50% передоплата = ${amounts.prepaid_amount} ₴, ${amounts.cod_amount > 0 ? `накладений ${amounts.cod_amount} ₴` : `при отриманні ${amounts.pickup_unpaid_balance} ₴`})`
      : `Замовлення створено через checkout (повна оплата онлайн)`,
  });

  return NextResponse.json({
    success: true,
    order_id: inserted.id,
    order_number: inserted.order_number,
    payment_type: inserted.payment_type,
    prepaid_amount: inserted.prepaid_amount,
    cod_amount: inserted.cod_amount,
    pickup_unpaid_balance: inserted.pickup_unpaid_balance,
  });
}
