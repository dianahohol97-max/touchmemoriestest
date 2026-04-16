import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = getAdminClient();
    const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, items, order_status, created_at, designer_note')
        .eq('with_designer', true)
        .is('designer_id', null)
        .in('order_status', ['new', 'confirmed', 'pending'])
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ orders: data || [] });
}
