import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
    const params = await props.params;
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    // Call the Supabase RPC to increment the view count
    const { error } = await supabase.rpc('increment_blog_post_views', { post_slug: params.slug });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
