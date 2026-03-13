import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    const { data, error } = await supabase
        .from('constructor_product_types')
        .select('*, constructor_product_templates(*)')
        .eq('id', params.id)
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function PUT(
    req: Request,
    { params }: { params: { id: string } }
) {
    const body = await req.json();
    const { data, error } = await supabase
        .from('constructor_product_types')
        .update(body)
        .eq('id', params.id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
    const { error } = await supabase
        .from('constructor_product_types')
        .delete()
        .eq('id', params.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
