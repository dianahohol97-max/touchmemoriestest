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
    try {
        const { data, error } = await supabase
            .from('print_profiles')
            .select('*')
            .eq('id', params.id)
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const body = await req.json();
        const { data, error } = await supabase
            .from('print_profiles')
            .update(body)
            .eq('id', params.id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { error } = await supabase
            .from('print_profiles')
            .delete()
            .eq('id', params.id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
