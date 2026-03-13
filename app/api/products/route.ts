import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
    const { data, error } = await supabase
        .from('products')
        .select('*, categories(name)')
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function POST(req: Request) {
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
