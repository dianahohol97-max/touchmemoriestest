import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

// Cache the nav data at the edge for 10 minutes
export const revalidate = 600;

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
      { links, categories: categories || [] },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=60',
        },
      }
    );
  } catch (e) {
    console.error('[navigation API]', e);
    return NextResponse.json({ links: [], categories: [] });
  }
}
