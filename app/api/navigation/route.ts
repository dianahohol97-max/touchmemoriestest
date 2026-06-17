import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

// Cache the nav data at the edge for 1 minute so menu edits (e.g. adding a
// navigation_links row) appear within ~a minute instead of up to 10.
export const revalidate = 60;

export async function GET() {
  try {
    const supabase = getAdminClient();
    if (!supabase) return NextResponse.json({ links: [], categories: [] });

    // Single query — fetch all nav links (parents + children) at once
    const [{ data: allLinks }, { data: categories }] = await Promise.all([
      supabase
        .from('navigation_links')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
      supabase
        .from('categories')
        .select('id, name, slug, translations, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
    ]);

    // Filter out categories that have no active products — they'd show as empty pages
    const { data: productCounts } = await supabase
      .from('products')
      .select('category_id')
      .eq('is_active', true);
    const slugsWithProducts = new Set((productCounts || []).map((p: any) => p.category_id));
    const filteredCategories = (categories || []).filter((c: any) => slugsWithProducts.has(c.id));

    // Build tree in JS — no extra DB round-trips
    const parents = (allLinks || []).filter((l: any) => !l.parent_id);
    const children = (allLinks || []).filter((l: any) => l.parent_id);

    const links = parents.map((link: any) => ({
      id: link.id,
      link_text: link.link_text,
      link_url: link.link_url,
      translations: link.translations || {},
      children: children
        .filter((c: any) => c.parent_id === link.id)
        .map((c: any) => ({
          id: c.id,
          link_text: c.link_text,
          link_url: c.link_url,
          translations: c.translations || {},
        })),
    }));

    return NextResponse.json(
      { links, categories: filteredCategories },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        },
      }
    );
  } catch (e) {
    console.error('[navigation API]', e);
    return NextResponse.json({ links: [], categories: [] });
  }
}
