import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/orders/[id]/clone-project-to-me
 *
 * Copies the customer's constructor project linked to this order into the
 * CURRENT staff member's own drafts, named '{order_number} — переекспорт'.
 * The staff member then opens their drafts in the constructor and re-runs
 * the export on current (fixed) code — the customer is never asked to
 * redo anything. Born from TM-001046: this exact move (done by SQL that
 * time) regenerated Angelina's blank book with zero customer effort.
 * Storage stays untouched: the copy references the customer's original
 * photo paths (photobook-uploads is public-select, so rehydrate works
 * from any session).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;
    const staffUserId = (guard as any).userId as string | undefined;
    if (!staffUserId) return NextResponse.json({ error: 'Не вдалося визначити ваш акаунт' }, { status: 400 });

    const { id } = await params;
    const admin = getAdminClient();

    const { data: order } = await admin
        .from('orders').select('id, order_number').eq('id', id).maybeSingle();
    if (!order) return NextResponse.json({ error: 'Замовлення не знайдено' }, { status: 404 });

    const { data: projects } = await admin
        .from('projects')
        .select('id, product_type, format, cover_type, total_pages, pages_data, cover_data, uploaded_photos, overlays_data, cart_payload')
        .eq('order_id', id);
    if (!projects || projects.length === 0) {
        return NextResponse.json({ error: 'До замовлення не привʼязано жодного макета' }, { status: 404 });
    }

    const copies: string[] = [];
    for (const p of projects) {
        const { data: copy, error } = await admin
            .from('projects')
            .insert({
                user_id: staffUserId,
                product_type: p.product_type,
                format: p.format,
                cover_type: p.cover_type,
                total_pages: p.total_pages,
                pages_data: p.pages_data,
                cover_data: p.cover_data,
                uploaded_photos: p.uploaded_photos,
                overlays_data: p.overlays_data,
                cart_payload: p.cart_payload,
                status: 'draft',
                name: `${order.order_number} — переекспорт`,
            })
            .select('id')
            .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (copy) copies.push(copy.id);
    }

    return NextResponse.json({
        ok: true,
        copies: copies.length,
        message: `Макет скопійовано у ваші чернетки як «${order.order_number} — переекспорт». Відкрийте конструктор → Мої чернетки.`,
    });
}
