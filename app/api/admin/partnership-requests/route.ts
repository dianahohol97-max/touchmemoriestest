import { NextResponse } from 'next/server';
import { requirePartnerApprover, getSession } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Заявки на партнерство: перегляд і закриття.
 *
 * requirePartnerApprover, а не requireAdmin: партнерів підтверджують не тільки
 * власники, і закривати заявки має право той самий коло людей (Діана,
 * 15.09.2026). Хто саме закрив — лишається в closed_by.
 */

// GET /api/admin/partnership-requests?status=new
export async function GET(request: Request) {
    const guard = await requirePartnerApprover();
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const admin = getAdminClient();
    // Свідомий ліміт замість вибірки без межі: заявки надходять із публічної
    // форми, тобто таблиця росте сама, а PostgREST мовчки віддає щонайбільше
    // тисячу рядків. Екран «останні заявки» більшого й не показує, а решта
    // знайдеться фільтром за статусом.
    let q = admin.from('partnership_requests').select('*');
    if (status && status !== 'all') q = q.eq('status', status);
    q = q.order('created_at', { ascending: false }).limit(300);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ requests: data || [] });
}

/**
 * 'duplicate' стоїть окремо від 'declined' свідомо: повторну заявку не
 * відхилили по суті, вона просто друга на ту саму пошту. Якби вона лягала в
 * 'declined', із картки виглядало б, ніби людині відмовили, а слід про те, що
 * вона зверталася двічі, зник би.
 */
const CLOSING_STATUSES = ['declined', 'duplicate'];
const ALLOWED_STATUSES = ['new', 'contacted', 'active', ...CLOSING_STATUSES];

// PATCH /api/admin/partnership-requests  { id, status, reason? }
export async function PATCH(request: Request) {
    const guard = await requirePartnerApprover();
    if (!guard.ok) return guard.response;

    const { id, status, reason } = await request.json();
    if (!id || !ALLOWED_STATUSES.includes(status)) {
        return NextResponse.json({ error: 'Невірні параметри' }, { status: 400 });
    }

    const closing = CLOSING_STATUSES.includes(status);
    const patch: Record<string, any> = { status };
    if (closing) {
        const { user } = await getSession();
        patch.decline_reason = String(reason || '').trim().slice(0, 500) || null;
        patch.closed_at = new Date().toISOString();
        patch.closed_by = user?.email || null;
    } else {
        // Повернення заявки в роботу стирає слід закриття, інакше в картці
        // висіла б причина відмови поряд із живою заявкою.
        patch.decline_reason = null;
        patch.closed_at = null;
        patch.closed_by = null;
    }

    const admin = getAdminClient();
    const { error } = await admin.from('partnership_requests').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
