import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Public endpoint — returns all active travel book covers (cities + countries).
// Cached at the CDN for 5 minutes since the list rarely changes.
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from('travelbook_covers')
      .select('id, name, name_en, image_url, kind, sort_order')
      .eq('active', true)
      .order('kind', { ascending: true })
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('travelbook-covers:', error.message);
      return NextResponse.json({ covers: [] }, { status: 200 });
    }

    return NextResponse.json(
      { covers: data || [] },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } }
    );
  } catch (e) {
    console.error('travelbook-covers error:', e);
    return NextResponse.json({ covers: [] }, { status: 200 });
  }
}
