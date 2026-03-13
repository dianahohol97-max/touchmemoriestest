import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize a supabase client with the service role key strictly for admin actions
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('staff')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Ensure initials are created if not provided directly
        if (!body.initials && body.name) {
            body.initials = body.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
        }

        const { data, error } = await supabase
            .from('staff')
            .insert([body])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing staff ID' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('staff')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
