import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
    const params = await props.params;
    const supabase = getAdminClient();

    // Call the Supabase RPC to increment the view count
    const { error } = await supabase.rpc('increment_blog_post_views', { post_slug: params.slug });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
