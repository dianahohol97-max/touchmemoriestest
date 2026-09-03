import { NextRequest, NextResponse } from 'next/server';
import { requireSection } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Картка одного клієнта: сам клієнт, його замовлення та нотатки менеджера.
 *
 * Сторінка читала customers і orders прямо з браузера, а обидві таблиці
 * закриті на is_admin_user(). Для менеджера, якого немає в admin_users,
 * картка показувала «Клієнт не знайдений» — при тому, що клієнт існує, а
 * роль дає йому customers: full.
 *
 * Нотатки автозберігаються з дебаунсом у секунду і йшли тим самим прямим
 * update. Він не міняв жодного рядка, помилки не давав, і менеджер бачив
 * акуратне «збережено» над текстом, який нікуди не потрапив.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireSection('customers', 'view');
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const admin = getAdminClient();

    const { data: customer, error } = await admin
        .from('customers')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        console.error('[admin/customers/:id] read failed', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: orders } = await admin
        .from('orders')
        .select('id, order_number, total, created_at, order_status')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

    return NextResponse.json({ customer, orders: orders || [] });
}

/** Нотатки менеджера — єдине поле, яке ця картка редагує. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireSection('customers', 'edit');
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body.notes !== 'string') {
        return NextResponse.json({ error: 'notes required' }, { status: 400 });
    }

    const admin = getAdminClient();
    const { error } = await admin
        .from('customers')
        .update({ notes: body.notes })
        .eq('id', id);

    if (error) {
        console.error('[admin/customers/:id] notes save failed', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
}
