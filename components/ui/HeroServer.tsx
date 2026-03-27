import { getAdminClient } from '@/lib/supabase/admin';
import { HeroClient } from './HeroClient';

export async function HeroServer() {
    const supabase = getAdminClient();

    // hero_content table does not exist in production — use site_content key-value store for hero text
    const { data: siteContentRows, error: siteContentError } = await supabase
        .from('site_content')
        .select('*');

    if (siteContentError) {
        console.error('[HeroServer] Error fetching site_content:', siteContentError);
    }

    // Build a simple key→value map from site_content
    const siteContent: Record<string, string> = {};
    if (siteContentRows) {
        for (const row of siteContentRows) {
            if (row.key && row.value) {
                siteContent[row.key] = row.value;
            }
        }
    }

    // Fetch hero buttons — actual columns: id, text, url, variant, sort_order, is_active
    const { data: heroButtons, error: heroButtonsError } = await supabase
        .from('hero_buttons')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (heroButtonsError) {
        console.error('[HeroServer] Error fetching hero_buttons:', heroButtonsError);
    }

    console.log('[HeroServer] siteContent rows:', siteContentRows?.length || 0);
    console.log('[HeroServer] heroButtons:', heroButtons?.length || 0);

    return (
        <HeroClient
            siteContent={siteContent}
            heroButtons={heroButtons || []}
        />
    );
}
