import { getAdminClient } from '@/lib/supabase/admin';
import { HeroClient } from './HeroClient';
import { getLocalized } from '@/lib/i18n/localize';

export async function HeroServer({ locale = 'uk' }: { locale?: string }) {
    let heroButtons: any[] = [];
    let heroContent: any = null;

    try {
        const supabase = getAdminClient();
        if (!supabase) {
            console.error('[HeroServer] Supabase client is null');
            return <HeroClient heroButtons={[]} />;
        }

        // Fetch hero text content (overline, title lines, background image)
        const { data: heroContentData, error: heroContentError } = await supabase
            .from('hero_content')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (heroContentError) {
            console.error('[HeroServer] Error fetching hero_content:', JSON.stringify(heroContentError));
        }
        heroContent = heroContentData || null;

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

        // Map database columns to expected prop names, localised per request
        heroButtons = (heroButtonsData || []).map((btn: any) => ({
            id: btn.id,
            button_text: getLocalized(btn, locale, 'text') || btn.button_text || btn.text,
            button_url: btn.url || btn.button_url,
            display_order: btn.sort_order || btn.display_order || 0,
            row_number: btn.row_number || 1,
            is_active: btn.is_active
        }));

    } catch (err) {
        console.error('[HeroServer] CAUGHT ERROR:', err);
    }

    const localizedContent: any = heroContent ? {
        ...heroContent,
        overline_text: getLocalized(heroContent, locale, 'overline_text'),
        title_line1: getLocalized(heroContent, locale, 'title_line1'),
        title_line2: getLocalized(heroContent, locale, 'title_line2'),
        title: getLocalized(heroContent, locale, 'title'),
        subtitle: getLocalized(heroContent, locale, 'subtitle'),
        cta_primary_text: getLocalized(heroContent, locale, 'cta_primary_text'),
        cta_secondary_text: getLocalized(heroContent, locale, 'cta_secondary_text'),
    } : undefined;

    return (
        <HeroClient
            heroContent={localizedContent}
            heroButtons={heroButtons}
        />
    );
}
