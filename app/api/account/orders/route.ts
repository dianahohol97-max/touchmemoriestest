import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        const cookieStore = await cookies();

        // This relies on the auth token being sent via cookie if using standard Next.js auth flows
        const accessToken = cookieStore.get('sb-access-token')?.value || '';

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                },
            }
        );

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
