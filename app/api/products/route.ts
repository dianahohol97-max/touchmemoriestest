import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
    const supabase = getAdminClient();
    const { data, error } = await supabase
        .from('products')
        .select('*, categories(name)')
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function POST(req: Request) {
    const supabase = getAdminClient();
    try {
        const body = await req.json();
        const { data, error } = await supabase
            .from('products')
            .insert([body])
            .select();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(data[0]);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
