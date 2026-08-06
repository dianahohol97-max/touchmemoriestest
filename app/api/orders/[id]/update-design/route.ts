import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Editing the design of an order that ALREADY EXISTS.
 *
 * Until now «Зберегти та замовити» always wrote to the cart: a customer who
 * reopened a design from their account got a new cart line, a new project row
 * and — after paying again — a second order, while the original order kept its
 * old макет. Diana asked for the edits to land on the order itself.
 *
 * That is a paid record being rewritten, so this route is deliberately strict.
 * Three things must hold, and each refusal names its own reason so the customer
 * is told what to do instead of silently getting nothing:
 *
 *   1. The order belongs to the signed-in customer. No guest path — a guest has
 *      no way to prove the order is theirs.
 *   2. The order has not moved into production. Once it is being printed or has
 *      shipped, the file on the printer's desk is the truth and changing the
 *      record would only create a mismatch nobody notices.
 *   3. The change does not touch anything that was PRICED. Photos, layouts,
 *      crops, text content, cover colours — all free to change. Page count,
 *      size, cover type, lamination, decoration, inscriptions, QR codes are
 *      not: they were paid for at a fixed amount, and TM-001113 is what happens
 *      when four unpaid pages reach the printer.
 *
 * On success the project row is updated in place (so the order keeps ONE
 * design), the order is annotated for the manager, and the print files are
 * re-rendered so the admin panel shows the new макет instead of the old one.
 */

/** Fields whose value was part of the price the customer paid. */
type PriceSignature = Record<string, string | number | boolean>;

function priceSignature(src: {
  totalPages?: unknown;
  config?: any;
  coverState?: any;
  generatedQRCount?: unknown;
}): PriceSignature {
  const cfg = src.config || {};
  const cover = src.coverState || {};
  return {
    pages: Number(src.totalPages) || 0,
    size: String(cfg.selectedSize || ''),
    coverType: String(cfg.selectedCoverType || ''),
    copies: String(cfg.selectedCopies || ''),
    pageLamination: String(cfg.selectedPageLamination || ''),
    coverLamination: String(cfg.selectedLamination || ''),
    kalka: !!cfg.enableKalka,
    endpaper: !!cfg.enableEndpaper,
    decoType: String(cover.decoType || 'none'),
    decoVariant: String(cover.decoVariant || ''),
    inscriptions: Array.isArray(cover.extraTexts) ? cover.extraTexts.length : 0,
    qr: Number(src.generatedQRCount) || 0,
  };
}

const FIELD_LABELS_UK: Record<string, string> = {
  pages: 'кількість сторінок',
  size: 'розмір',
  coverType: 'тип обкладинки',
  copies: 'кількість примірників',
  pageLamination: 'ламінація сторінок',
  coverLamination: 'ламінація обкладинки',
  kalka: 'калька',
  endpaper: 'друк на форзаці',
  decoType: 'оздоблення обкладинки',
  decoVariant: 'варіант оздоблення',
  inscriptions: 'написи на обкладинці',
  qr: 'QR-коди',
};

/** Why this order may not be edited any more, or null when it may. */
function lockReason(order: any): string | null {
  const status = String(order.order_status || '').toLowerCase();
  const production = String(order.production_status || '').toLowerCase();
  if (status === 'cancelled') return 'Замовлення скасоване.';
  if (status === 'completed' || status === 'delivered' || status === 'shipped') {
    return 'Замовлення вже виконане.';
  }
  if (order.production_at || order.shipped_at || order.delivered_at) {
    return 'Замовлення вже у виробництві, макет змінити не можна.';
  }
  if (production && production !== 'pending' && production !== 'new') {
    return 'Замовлення вже у виробництві, макет змінити не можна.';
  }
  return null;
}

async function loadContext(orderId: string) {
  const admin = getAdminClient();

  let userId: string | null = null;
  try {
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    userId = user?.id ?? null;
  } catch { /* no session */ }

  const { data: order } = await admin
    .from('orders')
    .select('id, order_number, customer_id, items, notes, custom_attributes, order_status, production_status, production_at, shipped_at, delivered_at')
    .eq('id', orderId)
    .maybeSingle();

  return { admin, userId, order };
}

/** GET — may this order's design still be edited by this customer? */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { admin, userId, order } = await loadContext(id);

  if (!order) return NextResponse.json({ editable: false, reason: 'Замовлення не знайдено.' });
  if (!userId || order.customer_id !== userId) {
    return NextResponse.json({ editable: false, reason: 'Це замовлення оформлене не з цього акаунта.' });
  }
  const locked = lockReason(order);
  if (locked) return NextResponse.json({ editable: false, reason: locked });

  const { count } = await admin
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', id);
  if ((count ?? 0) === 0) {
    return NextResponse.json({ editable: false, reason: 'До цього замовлення не прикріплений макет.' });
  }

  return NextResponse.json({ editable: true, orderNumber: order.order_number });
}

/** POST — replace the order's design with the one just built in the editor. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body?.design) {
    return NextResponse.json({ error: 'design required' }, { status: 400 });
  }

  const { admin, userId, order } = await loadContext(id);
  if (!order) return NextResponse.json({ error: 'order not found' }, { status: 404 });
  if (!userId || order.customer_id !== userId) {
    return NextResponse.json({ error: 'forbidden', reason: 'Це замовлення оформлене не з цього акаунта.' }, { status: 403 });
  }
  const locked = lockReason(order);
  if (locked) {
    return NextResponse.json({ error: 'locked', reason: locked }, { status: 409 });
  }

  const { data: project } = await admin
    .from('projects')
    .select('id, total_pages, cover_data, overlays_data, cart_payload')
    .eq('order_id', id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: 'no project', reason: 'До цього замовлення не прикріплений макет.' }, { status: 404 });
  }

  const design = body.design;
  const incoming = priceSignature({
    totalPages: body.totalPages,
    config: design.config,
    coverState: design.coverState,
    generatedQRCount: design.generatedQRCount,
  });
  const current = priceSignature({
    totalPages: project.total_pages,
    config: (project.overlays_data as any)?.config,
    coverState: project.cover_data,
    generatedQRCount: (project.overlays_data as any)?.generatedQRCount,
  });

  const changed = Object.keys(incoming).filter(k => String(incoming[k]) !== String(current[k]));
  if (changed.length > 0) {
    const names = changed.map(k => FIELD_LABELS_UK[k] || k).join(', ');
    return NextResponse.json({
      error: 'price_changed',
      changed,
      reason: `У цьому замовленні не можна змінити те, що впливає на вартість: ${names}. `
        + `Напишіть нам, і ми оформимо доплату або нове замовлення.`,
    }, { status: 409 });
  }

  // Apply. Only the design travels — order_id, cart_payload and user_id stay as
  // they were, so the order keeps exactly one project and the account list does
  // not sprout a second card for the same book.
  const { pages, coverState, pageStickers, pageShapes, pageBgs, freeSlots,
          qrOverlays, generatedQRCount, config, uploadedPhotos } = design;

  const { error: updErr } = await admin
    .from('projects')
    .update({
      pages_data: pages || [],
      cover_data: coverState || null,
      overlays_data: { pageStickers, pageShapes, pageBgs, freeSlots, qrOverlays, generatedQRCount, config },
      uploaded_photos: uploadedPhotos || [],
      updated_at: new Date().toISOString(),
    })
    .eq('id', project.id);

  if (updErr) {
    console.error('[update-design] project update failed', { orderId: id, error: updErr.message });
    return NextResponse.json({ error: 'update failed', detail: updErr.message }, { status: 500 });
  }

  // Tell the manager. A design that changes after payment is exactly the kind of
  // thing that must not be discovered by comparing files — one marker line,
  // refreshed rather than stacked, so a customer who saves five times does not
  // bury the rest of the notes.
  const MARKER = 'клієнт оновив макет після оформлення';
  const editedAt = new Date().toISOString();
  try {
    const kept = String(order.notes || '')
      .split('\n')
      .filter(line => !line.includes(MARKER))
      .join('\n')
      .trim();
    const stamp = editedAt.replace('T', ' ').slice(0, 16);
    const line = `ℹ️ ${MARKER} (${stamp} UTC) — макет перегенеровано, перевірте файли перед друком.`;
    // The note is for reading; custom_attributes is what the admin page renders
    // its banner from. A note can be edited or wiped by whoever is typing in the
    // textarea, and this fact must not be losable that way.
    const attrs = (order.custom_attributes && typeof order.custom_attributes === 'object')
      ? { ...(order.custom_attributes as Record<string, unknown>) } : {};
    attrs.design_updated_at = editedAt;
    attrs.design_update_count = Number(attrs.design_update_count || 0) + 1;
    await admin.from('orders')
      .update({ notes: kept ? `${line}\n\n${kept}` : line, custom_attributes: attrs })
      .eq('id', id);
  } catch (e: any) {
    console.error('[update-design] note update failed', { orderId: id, error: e?.message });
  }

  // Re-render so the admin panel shows the new макет. render-order replaces the
  // previous export set, so the old files do not linger next to the new ones.
  let rerendered = false;
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const res = await fetch(`${base}/api/print/render-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' },
      body: JSON.stringify({ orderId: id }),
    });
    rerendered = res.ok;
    if (!res.ok) console.error('[update-design] re-render refused', { orderId: id, status: res.status });
  } catch (e: any) {
    console.error('[update-design] re-render failed', { orderId: id, error: e?.message });
  }

  return NextResponse.json({ ok: true, orderNumber: order.order_number, rerendered });
}
