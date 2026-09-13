import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';

import { ATTENTION_AFTER_HOURS, ATTENTION_EXCLUDED_SOURCES } from '@/lib/orders/attention';

export const dynamic = 'force-dynamic';

/** Один перелік полів на обидві гілки — інакше вони мовчки розійдуться. */
const ORDER_SELECT = `
    *,
    customers(id, name, phone, email),
    manager:staff!orders_manager_id_fkey(id, name, initials, color),
    designer:staff!orders_designer_id_fkey(id, name, initials, color),
    order_tag_assignments(order_tags(*))
`;

/** Дата останнього листа для переданих замовлень, з вигляду order_last_contact. */
async function attachLastContact(
    supabase: ReturnType<typeof getAdminClient>,
    orders: any[],
): Promise<any[]> {
    if (orders.length === 0) return orders;
    const ids = orders.map(o => o.id).filter(Boolean);
    if (ids.length === 0) return orders;

    const { data, error } = await supabase
        .from('order_last_contact')
        .select('order_id, last_contact_at')
        .in('order_id', ids);

    if (error) {
        // Колонка «останній контакт» не варта того, щоб через неї не відкрився
        // весь список: показуємо «—» і працюємо далі.
        console.error('[Orders API] last contact lookup failed:', error.message);
        return orders;
    }

    const byId = new Map((data || []).map((r: any) => [String(r.order_id), r.last_contact_at]));
    return orders.map(o => ({ ...o, last_contact_at: byId.get(String(o.id)) || null }));
}

export async function GET(req: Request) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    try {
        const supabase = getAdminClient();
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const limit = parseInt(searchParams.get('limit') || '200');
        const attention = searchParams.get('attention') === '1';
        const sort = searchParams.get('sort') || '';

        // ФІЛЬТР «ПОТРЕБУЄ УВАГИ» — окремою гілкою, на сервері.
        //
        // Решта фільтрів у списку працює в браузері над уже отриманою сторінкою
        // на 200 найновіших рядків. Для цього фільтра так не можна: зависле
        // замовлення — це рівно те, що з тієї сторінки давно випало, і
        // браузерний фільтр показував би порожньо саме тоді, коли він
        // найпотрібніший.
        //
        // База віддає впорядкований перелік id (найдавніший контакт зверху), а
        // далі рядки добираються звичайним запитом із тими самими приєднаннями,
        // що й усюди, і повертаються в порядку функції.
        if (attention) {
            const { data: flagged, error: attErr } = await supabase.rpc('orders_needing_attention', {
                p_hours: ATTENTION_AFTER_HOURS,
                p_exclude_sources: ATTENTION_EXCLUDED_SOURCES,
                p_limit: limit,
            });
            if (attErr) {
                console.error('[Orders API] attention rpc failed:', attErr);
                return NextResponse.json({ error: attErr.message }, { status: 500 });
            }

            const rows = (flagged || []) as { order_id: string; last_contact_at: string | null }[];
            if (rows.length === 0) return NextResponse.json({ orders: [] });

            const ids = rows.map(r => r.order_id);
            const { data: full, error: fullErr } = await supabase
                .from('orders')
                .select(ORDER_SELECT)
                .in('id', ids);
            if (fullErr) {
                console.error('[Orders API] attention fetch failed:', fullErr);
                return NextResponse.json({ error: fullErr.message }, { status: 500 });
            }

            // Порядок задає функція, а не база: .in() повертає рядки як
            // заманеться, а сенс фільтра саме в тому, що зверху найдавніший
            // контакт.
            const byId = new Map((full || []).map((o: any) => [String(o.id), o]));
            const ordered = rows
                .map(r => {
                    const o = byId.get(String(r.order_id));
                    return o ? { ...o, last_contact_at: r.last_contact_at } : null;
                })
                .filter(Boolean);

            return NextResponse.json({ orders: ordered });
        }

        let query = supabase
            .from('orders')
            .select(ORDER_SELECT)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (status && status !== 'all') {
            query = query.eq('order_status', status);
        }

        if (search) {
            // Strip PostgREST filter metacharacters so the search term can't
            // inject extra `.or()` terms (staff-gated, but cheap to close).
            const s = search.replace(/[,()*]/g, ' ').trim();
            // Email and ТТН are here because the list page's own filter matches
            // on them too — a search that finds a row in one place and not the
            // other is worse than no search at all.
            if (s) query = query.or(
                `order_number.ilike.%${s}%,customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%,`
                + `customer_email.ilike.%${s}%,ttn.ilike.%${s}%`,
            );
        }

        // Date window, so filtering by an old range reaches past the newest
        // `limit` rows instead of searching an already-truncated page.
        if (from) query = query.gte('created_at', `${from}T00:00:00`);
        if (to) query = query.lte('created_at', `${to}T23:59:59.999`);

        const { data, error } = await query;

        if (error) {
            console.error('[Orders API] Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Останній контакт для видимої сторінки. Окремим запитом, а не
        // приєднанням: order_last_contact — це вигляд з агрегатом, і PostgREST
        // не вміє вбудовувати його як звʼязану сутність. Індекс
        // email_logs (order_id, sent_at DESC) уже стоїть, заміряно 11 мс на
        // всьому журналі.
        const orders = (data || []) as any[];
        const withContact = await attachLastContact(supabase, orders);

        // Сортування параметром. Досі порядок був жорстко зашитий у created_at
        // desc, і поміняти його не міг ніхто.
        if (sort === 'last_contact_asc') {
            withContact.sort((a, b) => {
                // Ті, кому не писали жодного разу, — найперші: це не «давно», а
                // «ніколи», і таке замовлення потребує уваги найбільше.
                const av = a.last_contact_at ? new Date(a.last_contact_at).getTime() : -Infinity;
                const bv = b.last_contact_at ? new Date(b.last_contact_at).getTime() : -Infinity;
                return av - bv;
            });
        }

        return NextResponse.json({ orders: withContact });
    } catch (err: any) {
        console.error('[Orders API] Exception:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
// audit Wed Apr  1 11:08:21 UTC 2026
