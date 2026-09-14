import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/** Скільки рядків PostgREST віддає за один запит. Те саме число, що в /api/admin/clients. */
const PAGE = 1000;

// SECURITY: this endpoint used to return ALL orders with customer PII to any
// caller. It now requires admin auth. Customer-facing order lookup goes through
// /api/account/orders (own orders) or /api/orders/track (by order_number + email/phone).
export async function GET() {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();

    // Сторінками: замовлень 1107 (заміряно 14.09.2026), а PostgREST віддає
    // щонайбільше PAGE рядків і мовчки — помилки немає, просто приходить
    // менше. Той, хто читає цей маршрут, отримував 1000 і не мав як дізнатися,
    // що решту відрізало.
    const orders: any[] = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
            .from('orders')
            .select('*, customers(email)')
            .order('created_at', { ascending: false })
            .range(from, from + PAGE - 1);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        orders.push(...(data || []));
        if (!data || data.length < PAGE) break;
    }

    return NextResponse.json(orders);
}
