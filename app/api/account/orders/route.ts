import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch orders by both user id and email (handles both registration flows)
        const { data: orders, error } = await supabase
            .from('orders')
            .select('id,order_number,order_status,payment_status,total,created_at,items,customer_name,delivery_address,tracking_number')
            .or(`customer_id.eq.${user.id},customer_email.eq.${user.email}`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ orders: orders || [] });

    } catch (error: any) {
        console.error('Error fetching account orders:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
