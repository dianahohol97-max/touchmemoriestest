import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { PRODUCTION_STATUSES } from '../route';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/production/status — перенести замовлення між колонками
 * дошки виробництва. Приймає одне замовлення або відразу кілька.
 *
 * Дошка міняла order_status прямим update з браузера, і це був найгірший з
 * можливих варіантів мовчазної поломки. Політики на orders пускають
 * admin_users або призначеного дизайнера; у решти update не чіпав жодного
 * рядка, але Supabase на нуль рядків помилки не дає, тож error лишався null.
 * Картка від'їжджала в наступну колонку оптимістичним оновленням, спливав
 * зелений тост «Статус оновлено», а в базі не мінялося нічого — до першого
 * оновлення сторінки, після якого все поверталось назад.
 *
 * Тут статус пишеться сервісним клієнтом під requireStaff, з рядком в
 * order_history і зі списанням складу на переході в «Готово до відпр.» —
 * раніше списання теж не спрацьовувало, бо стояло в гілці «update пройшов».
 *
 * fromStatus — необовʼязкова умова: масова дія «відмітити як надруковано»
 * має чіпати лише те, що досі у друці, навіть якщо список устиг застаріти.
 */
export async function POST(req: NextRequest) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => null);
    const ids: string[] = Array.isArray(body?.ids)
        ? body.ids.filter((x: unknown): x is string => typeof x === 'string' && !!x).slice(0, 200)
        : [];
    const status = String(body?.status || '');
    const fromStatus = typeof body?.fromStatus === 'string' ? body.fromStatus : null;

    if (ids.length === 0) {
        return NextResponse.json({ error: 'ids required' }, { status: 400 });
    }
    if (!(PRODUCTION_STATUSES as readonly string[]).includes(status)) {
        return NextResponse.json({ error: 'Unsupported status' }, { status: 400 });
    }

    const admin = getAdminClient();

    // Знімок до оновлення — для історії, і щоб не писати запис там, де статус
    // насправді не змінився.
    const { data: before } = await admin
        .from('orders')
        .select('id, order_status')
        .in('id', ids);
    const previous = new Map((before || []).map((r: any) => [r.id, r.order_status]));

    let query = admin.from('orders').update({ order_status: status }).in('id', ids);
    if (fromStatus) query = query.eq('order_status', fromStatus);
    const { data: updated, error } = await query.select('id');

    if (error) {
        console.error('[production] status update failed', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const movedIds = (updated || []).map((r: any) => r.id as string);

    for (const id of movedIds) {
        const old = previous.get(id);
        if (old === status) continue;
        const { error: histErr } = await admin.from('order_history').insert({
            order_id: id,
            action: `Зміна статусу: ${old || '—'} → ${status}`,
            details: { field: 'order_status', old: old ?? null, new: status, source: 'production-board' },
        });
        if (histErr) console.error('[production] history insert failed', { id, error: histErr.message });
    }

    // Списання складу на відправку. Функція SECURITY DEFINER і сама вирішує,
    // які позиції взагалі мають облік залишків.
    if (status === 'shipped') {
        for (const id of movedIds) {
            const { error: rpcErr } = await admin.rpc('ship_order_stock', { p_order_id: id });
            if (rpcErr) console.error('[production] ship_order_stock failed', { id, error: rpcErr.message });
        }
    }

    return NextResponse.json({ ok: true, moved: movedIds });
}
