import { NextResponse } from 'next/server';
import { requireSection } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** Скільки рядків PostgREST віддає за один запит. Те саме число, що в /api/admin/clients. */
const PAGE = 1000;

/**
 * Замовлення, які схожі на акаунт, але доказу забракло.
 *
 * Це ВИДИМИЙ список, а не прапорець у базі. Прапорець без списку накопичується:
 * рівно так назбиралося 79 гостьових замовлень, прив'язаних до акаунтів лише
 * поштою і не прив'язаних нічим у даних. Менеджер має бачити пару поруч — ім'я
 * в картці проти імені в замовленні, суму й дату — і сказати «та сама людина»
 * або «ні».
 *
 * Кандидати ставить lib/customers/link-guest-orders.ts при реєстрації, коли
 * правило з name-match.ts не знайшло достатнього доказу тотожності.
 */
export async function GET() {
    const guard = await requireSection('customers', 'view');
    if (!guard.ok) return guard.response;

    const admin = getAdminClient();

    const rows: any[] = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await admin
            .from('orders')
            .select(`
                id, order_number, created_at, total, paid_amount,
                customer_name, customer_email, customer_phone,
                link_candidate_customer_id, link_candidate_at, link_candidate_reason,
                candidate:customers!orders_link_candidate_customer_id_fkey(id, name, email, phone)
            `)
            .is('customer_id', null)
            .not('link_candidate_customer_id', 'is', null)
            .is('link_review_rejected_at', null)
            .order('link_candidate_at', { ascending: false })
            .range(from, from + PAGE - 1);

        if (error) {
            console.error('[link-review] read failed', error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        rows.push(...(data || []));
        if (!data || data.length < PAGE) break;
    }

    return NextResponse.json({ items: rows, count: rows.length });
}

/**
 * Рішення менеджера по одній парі.
 *
 * confirm — це та сама людина: ставимо customer_id і прибираємо кандидата.
 * reject — ні: customer_id лишається порожнім НАЗАВЖДИ для цієї пари, і
 * замовлення більше не з'явиться в списку. Дата відмови зберігається, щоб
 * потім було видно, що рішення ухвалили, а не загубили.
 *
 * Право те саме, що на редагування клієнтів: це рішення про чужі покупки в
 * чужому кабінеті, і переглядати його має той, хто відповідає за клієнтів.
 */
export async function POST(req: Request) {
    const guard = await requireSection('customers', 'edit');
    if (!guard.ok) return guard.response;

    let body: { orderId?: string; decision?: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: 'Некоректний запит' }, { status: 400 }); }

    const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
    const decision = body?.decision;
    if (!orderId || (decision !== 'confirm' && decision !== 'reject')) {
        return NextResponse.json({ error: 'Потрібні orderId і decision' }, { status: 400 });
    }

    const admin = getAdminClient();

    const { data: order } = await admin
        .from('orders')
        .select('id, customer_id, link_candidate_customer_id')
        .eq('id', orderId)
        .maybeSingle();

    if (!order) return NextResponse.json({ error: 'Замовлення не знайдено' }, { status: 404 });
    if (order.customer_id) {
        return NextResponse.json({ error: 'Замовлення вже прив’язане' }, { status: 409 });
    }
    if (!order.link_candidate_customer_id) {
        return NextResponse.json({ error: 'У замовлення немає кандидата' }, { status: 409 });
    }

    const patch = decision === 'confirm'
        ? {
            customer_id: order.link_candidate_customer_id,
            link_candidate_customer_id: null,
            link_candidate_at: null,
            link_candidate_reason: null,
            updated_at: new Date().toISOString(),
        }
        : {
            link_review_rejected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

    // Умова customer_id is null стоїть у WHERE, а не перевіркою вище: між
    // читанням і записом замовлення міг прив'язати хтось інший.
    const { data: updated, error } = await admin
        .from('orders')
        .update(patch)
        .eq('id', orderId)
        .is('customer_id', null)
        .select('id')
        .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!updated) return NextResponse.json({ error: 'Замовлення щойно змінив хтось інший' }, { status: 409 });

    return NextResponse.json({ ok: true, decision });
}
