import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = await createClient();

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = user.id;

        // Fetch their orders
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('*')
            .eq('customer_id', userId)
            .order('created_at', { ascending: false });

        if (ordersError) throw ordersError;

        return NextResponse.json({ orders });

    } catch (error: any) {
        console.error('Error fetching account orders:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
