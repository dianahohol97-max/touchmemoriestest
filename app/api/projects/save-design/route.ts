import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/projects/save-design
 *
 * Saves the full constructor design to the `projects` table so the Railway
 * render service can find it after payment via Monobank webhook →
 * /api/print/render-order → Railway → 300 DPI JPEGs.
 *
 * Two moments call this, and BOTH must work for guests (no session):
 *   1. At "add to cart" (BookLayoutEditor) — with `cartItemId` and no order yet.
 *      This is the important one: the design is persisted on the server the
 *      instant it's built, instead of surviving as fragile sessionStorage that
 *      the guest checkout may lose. This closes the design-loss root cause.
 *   2. At checkout (checkout page) — with the real `orderId`, once submitOrder
 *      returns it. If a project was already saved at step 1 for this cartItemId,
 *      we just stamp order_id onto it (link) instead of inserting a duplicate.
 *
 * So the request needs a `design` plus at least one identifier — `cartItemId`
 * OR `orderId`. Idempotency is keyed on cart_payload->>id first (survives from
 * add-to-cart) and order_id second.
 *
 * Uses service role to bypass RLS (the anon INSERT policy only covers
 * auth.uid() = user_id, which fails for guests and would require a separate
 * anon policy that is a security risk).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { orderId, cartItemId, cartPayload, design, productType, productName, format, coverType, totalPages } = body;

  // The cart line id we key on. Prefer the explicit cartItemId; fall back to the
  // id inside a full cartPayload (add-to-cart sends the whole payload so the
  // account "Замовити ще раз" button can replay it verbatim with the right price).
  const cartId: string | null = cartItemId ? String(cartItemId) : (cartPayload?.id ? String(cartPayload.id) : null);

  // Need the design plus something to key it on. cartId (add-to-cart) or
  // orderId (checkout) — either is enough.
  if (!design || (!orderId && !cartId)) {
    return NextResponse.json({ error: 'design and (orderId or cartId) required' }, { status: 400 });
  }

  // Resolve the authenticated user if any (guests have no session → null).
  let userId: string | null = null;
  try {
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    userId = user?.id ?? null;
  } catch { /* guest — continue with null */ }

  const admin = getAdminClient();

  // Idempotency: a project may already exist for this design, saved either at
  // add-to-cart (keyed by cart_payload->>id) or at a previous checkout attempt
  // (keyed by order_id). Look it up by cartItemId first, then by orderId.
  let existing: { id: string; order_id: string | null } | null = null;
  if (cartId) {
    const { data } = await admin
      .from('projects')
      .select('id, order_id')
      .eq('cart_payload->>id', cartId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    existing = (data as any) ?? null;
  }
  if (!existing && orderId) {
    const { data } = await admin
      .from('projects')
      .select('id, order_id')
      .eq('order_id', orderId)
      .maybeSingle();
    existing = (data as any) ?? null;
  }

  const { pages, coverState, pageStickers, pageShapes, pageBgs, freeSlots,
          qrOverlays, generatedQRCount, config, uploadedPhotos } = design;

  const overlaysData = { pageStickers, pageShapes, pageBgs, freeSlots, qrOverlays, generatedQRCount, config };

  const name = productName || `${productType || 'photobook'} ${format || ''} · ${totalPages || 0} стор.`;

  // Full cart payload when provided (drives account "Замовити ще раз"), else a
  // minimal { id } marker so link-order can still stamp order_id by cart id.
  const cartPayloadToStore = cartPayload && typeof cartPayload === 'object'
    ? cartPayload
    : (cartId ? { id: cartId } : null);

  // Base row WITHOUT cart_payload — it's handled per-path below so a thin
  // { id } update at checkout never overwrites the full payload from add-to-cart.
  const row = {
    user_id: userId,
    name,
    product_type: productType || 'photobook',
    format: format || null,
    cover_type: coverType || null,
    total_pages: totalPages || 0,
    status: 'draft' as const,
    pages_data: pages || [],
    cover_data: coverState || null,
    overlays_data: overlaysData,
    uploaded_photos: uploadedPhotos || [],
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    // Update the existing project with the latest design, and — crucially —
    // stamp order_id if we now have one and it wasn't linked yet. This is the
    // link step at checkout for a design saved at add-to-cart. Keep the user_id
    // that was set when the project was created (don't null it for a guest
    // checkout of a design saved while logged in), so only patch when we have one.
    const patch: Record<string, unknown> = { ...row };
    if (!userId) delete patch.user_id;                 // never overwrite a real owner with null
    if (orderId && !existing.order_id) patch.order_id = orderId;
    else if (!orderId) delete (patch as any).order_id; // leave existing link untouched
    // Only write cart_payload when we received the FULL payload; a thin { id }
    // update at checkout must not overwrite the rich payload saved at add-to-cart.
    if (cartPayload && typeof cartPayload === 'object') patch.cart_payload = cartPayloadToStore;

    const { data, error } = await admin
      .from('projects')
      .update(patch)
      .eq('id', existing.id)
      .select('id')
      .single();

    if (error) {
      console.error('[save-design] update failed', { orderId, cartId, error: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, updated: true, projectId: data.id });
  }

  const { data, error } = await admin
    .from('projects')
    .insert({ ...row, cart_payload: cartPayloadToStore, order_id: orderId || null })
    .select('id')
    .single();

  if (error) {
    console.error('[save-design] insert failed', { orderId, cartId, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, projectId: data.id });
}
