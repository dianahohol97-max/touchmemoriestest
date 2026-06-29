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
 * Called from checkout immediately after submitOrder returns the real order
 * UUID. Works for both authenticated users and guests (user_id = null for
 * guests — the project is linked by order_id alone).
 *
 * Uses service role to bypass RLS (the anon INSERT policy only covers
 * auth.uid() = user_id, which fails for guests and would require a separate
 * anon policy that is a security risk).
 *
 * The design payload comes from sessionStorage (set by BookLayoutEditor at
 * addToCart time under the key `design_{cartItemId}`), forwarded here by
 * the checkout page.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { orderId, cartItemId, design, productType, productName, format, coverType, totalPages } = body;

  if (!orderId || !design) {
    return NextResponse.json({ error: 'orderId and design required' }, { status: 400 });
  }

  // Resolve the authenticated user if any (guests have no session → null).
  let userId: string | null = null;
  try {
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    userId = user?.id ?? null;
  } catch { /* guest — continue with null */ }

  const admin = getAdminClient();

  // Idempotent: if a project already exists for this order, skip.
  const { data: existing } = await admin
    .from('projects')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, skipped: true, projectId: existing.id });
  }

  const { pages, coverState, pageStickers, pageShapes, pageBgs, freeSlots,
          qrOverlays, generatedQRCount, config, uploadedPhotos } = design;

  const overlaysData = { pageStickers, pageShapes, pageBgs, freeSlots, qrOverlays, generatedQRCount, config };

  const name = productName || `${productType || 'photobook'} ${format || ''} · ${totalPages || 0} стор.`;

  const { data, error } = await admin
    .from('projects')
    .insert({
      user_id: userId,
      order_id: orderId,
      name,
      product_type: productType || 'photobook',
      format: format || null,
      cover_type: coverType || null,
      total_pages: totalPages || 0,
      status: 'draft',
      pages_data: pages || [],
      cover_data: coverState || null,
      overlays_data: overlaysData,
      cart_payload: cartItemId ? { id: cartItemId } : null,
      uploaded_photos: uploadedPhotos || [],
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[save-design] insert failed', { orderId, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, projectId: data.id });
}
