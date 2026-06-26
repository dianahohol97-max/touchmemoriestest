import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Link pre-payment projects to their order.
 *
 * Some constructors (wall calendar, and other cart-first products) save the
 * project row at add-to-cart time, before an order exists, storing the cart
 * item id in cart_payload.id. At checkout we stamp the real order_id onto those
 * projects so the Monobank webhook → /api/print/render-order can find the design
 * and render it. Book editors set order_id themselves, so they're unaffected.
 *
 * Auth: the caller is the checkout page on behalf of the buyer. We only update
 * projects whose cart_payload.id matches one of the order's cart items AND that
 * have no order_id yet, so this can't reassign someone else's design.
 */
export async function POST(request: NextRequest) {
  const { orderId, cartItemIds } = await request.json().catch(() => ({}));
  if (!orderId || !Array.isArray(cartItemIds) || cartItemIds.length === 0) {
    return NextResponse.json({ error: 'orderId and cartItemIds required' }, { status: 400 });
  }

  const admin = getAdminClient();
  let linked = 0;

  for (const itemId of cartItemIds) {
    if (!itemId) continue;
    // Match by the cart item id stored in cart_payload, only when not yet linked.
    const { data, error } = await admin
      .from('projects')
      .update({ order_id: orderId })
      .eq('cart_payload->>id', itemId)
      .is('order_id', null)
      .select('id');
    if (error) {
      console.error('[link-order] update failed', { orderId, itemId, error: error.message });
      continue;
    }
    linked += data?.length || 0;
  }

  return NextResponse.json({ ok: true, linked });
}
