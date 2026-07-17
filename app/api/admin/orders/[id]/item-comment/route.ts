import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/orders/[id]/item-comment  { index, comment }
 *
 * Saves a staff comment on ONE order line item. The order card previously wrote
 * the whole orders.items array with the browser client, which RLS silently
 * blocked (0 rows, no error) — so the comment looked saved but never persisted.
 *
 * This runs under the service role (staff-guarded) and re-reads the items array
 * server-side, mutating ONLY the target item's `comment` field. It never trusts
 * a client-supplied items array, so prices/quantities/other fields can't be
 * tampered with through this path.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const { id } = await params;
    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

    const index = Number(body?.index);
    if (!Number.isInteger(index) || index < 0) {
        return NextResponse.json({ error: 'index required' }, { status: 400 });
    }
    const comment = String(body?.comment ?? '').slice(0, 5000);

    const admin = getAdminClient();
    const { data: order, error: readErr } = await admin
        .from('orders')
        .select('items')
        .eq('id', id)
        .maybeSingle();
    if (readErr || !order) return NextResponse.json({ error: 'order not found' }, { status: 404 });

    const items = Array.isArray(order.items) ? [...order.items] : [];
    if (index >= items.length) return NextResponse.json({ error: 'index out of range' }, { status: 400 });

    items[index] = { ...items[index], comment };

    const { error } = await admin
        .from('orders')
        .update({ items, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
}
