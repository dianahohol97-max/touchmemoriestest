import { getAdminClient } from '@/lib/supabase/admin';
import { HeroClient } from './HeroClient';

export async function HeroServer() {
    let heroButtons: any[] = [];

    try {
        const supabase = getAdminClient();
        if (!supabase) {
            console.error('[HeroServer] Supabase client is null');
            return <HeroClient heroButtons={[]} />;
        }

        // Fetch hero buttons
        // Database columns: id, text, url, variant, sort_order, is_active
        // HeroClient expects: id, button_text, button_url, display_order, row_number, is_active
        const { data: heroButtonsData, error: heroButtonsError } = await supabase
            .from('hero_buttons')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (heroButtonsError) {
            console.error('[HeroServer] Error fetching hero_buttons:', JSON.stringify(heroButtonsError));
        }

        // Map database columns to expected prop names
        heroButtons = (heroButtonsData || []).map((btn: any) => ({
            id: btn.id,
            button_text: btn.text || btn.button_text,
            button_url: btn.url || btn.button_url,
            display_order: btn.sort_order || btn.display_order || 0,
            row_number: btn.row_number || 1,
            is_active: btn.is_active
        }));

        console.log('[HeroServer] heroButtons:', heroButtons.length);
    } catch (err) {
        console.error('[HeroServer] CAUGHT ERROR:', err);
    }

    return (
        <HeroClient
            heroButtons={heroButtons}
        />
    );
}
