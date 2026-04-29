import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

// SECURITY: this endpoint used to return ALL orders with customer PII to any
// caller. It now requires admin auth. Customer-facing order lookup goes through
// /api/account/orders (own orders) or /api/orders/track (by order_number + email/phone).
export async function GET() {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    const { data, error } = await supabase
        .from('orders')
        .select('*, customers(email)')
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
