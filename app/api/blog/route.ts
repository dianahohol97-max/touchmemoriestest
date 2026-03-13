import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const supabase = getAdminClient();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const limit = parseInt(searchParams.get('limit') || '10');

    let query = supabase
        .from('blog_posts')
        .select(`
            *,
            category:blog_categories(name, slug)
        `)
        .eq('is_published', true)
        .order('published_at', { ascending: false });

    if (category) {
        // First get the category ID
        const { data: categoryData } = await supabase
            .from('blog_categories')
            .select('id')
            .eq('slug', category)
            .single();

        if (categoryData) {
            query = query.eq('category_id', categoryData.id);
        }
    }

    if (featured === 'true') {
        query = query.eq('is_featured', true);
    }

    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
