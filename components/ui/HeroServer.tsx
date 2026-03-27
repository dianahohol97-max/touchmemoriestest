import { getAdminClient } from '@/lib/supabase/admin';
import { HeroClient } from './HeroClient';

export async function HeroServer() {
    const supabase = getAdminClient();

    // Try fetching hero_content first (optional)
    const { data: heroContent, error: heroContentError } = await supabase
        .from('hero_content')
        .select('*')
        .eq('is_active', true)
        .single();

    if (heroContentError && heroContentError.code !== 'PGRST116') {
        console.error('[HeroServer] Error fetching hero_content:', heroContentError);
    }

    // Fetch hero buttons
    // Database has: id, text, url, variant, sort_order, is_active
    // HeroClient expects: id, button_text, button_url, display_order, row_number, is_active
    const { data: heroButtonsData, error: heroButtonsError } = await supabase
        .from('hero_buttons')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (heroButtonsError) {
        console.error('[HeroServer] Error fetching hero_buttons:', heroButtonsError);
    }

    // Map database columns to expected prop names
    const heroButtons = (heroButtonsData || []).map((btn: any) => ({
        id: btn.id,
        button_text: btn.text,
        button_url: btn.url,
        display_order: btn.sort_order,
        row_number: 1, // Default to row 1
        is_active: btn.is_active
    }));

    console.log('[HeroServer] heroContent:', heroContent ? 'found' : 'not found');
    console.log('[HeroServer] heroButtons:', heroButtons?.length || 0);

    return (
        <HeroClient
            heroContent={heroContent || undefined}
            heroButtons={heroButtons}
        />
    );
}
