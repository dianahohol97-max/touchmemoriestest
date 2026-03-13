import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
    const supabase = getAdminClient();
    try {
        const { data, error } = await supabase
            .from('order_tags')
            .select('*')
            .order('sort_order', { ascending: true });

        if (error) throw error;

        // Also fetch stats
        const { data: stats, error: statsError } = await supabase
            .from('order_tag_assignments')
            .select('tag_id');

        if (statsError) throw statsError;

        const usageCount = stats.reduce((acc: any, curr: any) => {
            acc[curr.tag_id] = (acc[curr.tag_id] || 0) + 1;
            return acc;
        }, {});

        const enrichedData = data.map(tag => ({
            ...tag,
            usage_count: usageCount[tag.id] || 0
        }));

        return NextResponse.json(enrichedData);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const supabase = getAdminClient();
    try {
        const body = await req.json();
        const { name, color, icon, sort_order } = body;

        const { data, error } = await supabase
            .from('order_tags')
            .insert([{ name, color, icon, sort_order }])
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Bulk update order (drag-and-drop)
export async function PUT(req: Request) {
    const supabase = getAdminClient();
    try {
        const body = await req.json();
        const { tags } = body; // Array of { id, sort_order }

        const { error } = await supabase
            .from('order_tags')
            .upsert(tags); // Upsert needs full row or will fill defaults. Better to update one by one for partial.

        // Because upsert requires all NOT NULL fields if they don't have defaults, 
        // we'll update sequentially if there's no bulk update function.
        for (const tag of tags) {
            await supabase.from('order_tags')
                .update({ sort_order: tag.sort_order })
                .eq('id', tag.id);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
