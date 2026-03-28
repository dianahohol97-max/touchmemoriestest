import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const debug: any = {
        env: {
            hasUrl: !!url,
            hasKey: !!key,
            urlPrefix: url ? url.substring(0, 30) + '...' : 'MISSING',
            keyPrefix: key ? key.substring(0, 10) + '...' : 'MISSING',
            keyLength: key?.length || 0,
        },
        queries: {},
    };

    if (!url || !key) {
        debug.error = 'Missing environment variables';
        return NextResponse.json(debug);
    }

    const supabase = createClient(url, key);

    // Test 1: hero_buttons
    const { data: heroButtons, error: heroError } = await supabase
        .from('hero_buttons')
        .select('*')
        .eq('is_active', true);
    debug.queries.hero_buttons = { data: heroButtons, error: heroError, count: heroButtons?.length };

    // Test 2: products
    const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, slug, is_popular, is_active, status')
        .eq('is_popular', true)
        .eq('is_active', true)
        .eq('status', 'active')
        .limit(4);
    debug.queries.products = { data: products?.map(p => ({ name: p.name, slug: p.slug })), error: productsError, count: products?.length };

    // Test 3: categories
    const { data: categories, error: catError } = await supabase
        .from('categories')
        .select('id, name, slug')
        .eq('is_active', true)
        .limit(3);
    debug.queries.categories = { data: categories, error: catError, count: categories?.length };

    // Test 4: section_content
    const { data: sections, error: secError } = await supabase
        .from('section_content')
        .select('section_name, is_active')
        .limit(5);
    debug.queries.section_content = { data: sections, error: secError, count: sections?.length };

    // Test 5: raw count
    const { count, error: countError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });
    debug.queries.products_total_count = { count, error: countError };

    return NextResponse.json(debug);
}
