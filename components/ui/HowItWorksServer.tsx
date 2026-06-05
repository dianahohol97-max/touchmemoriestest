import { getAdminClient } from '@/lib/supabase/admin';
import { HowItWorksClient } from './HowItWorksClient';

export async function HowItWorksServer({ locale = 'uk' }: { locale?: string } = {}) {
    const supabase = getAdminClient();

    // Fetch feature cards
    const { data: featureCards } = await supabase
        .from('feature_cards')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

    const translatedCards = (featureCards || []).map((card: any) => {
        const trans = card.translations?.[locale];
        if (!trans) return card;
        return { ...card, title: trans.title || card.title, subtitle: trans.subtitle || card.subtitle, description: trans.description || trans.subtitle || card.description };
    });

    // Editable section image (the workshop photo next to "Чому варто обрати нас").
    const { data: section } = await supabase
        .from('section_content')
        .select('image_url')
        .eq('section_name', 'how_it_works')
        .eq('is_active', true)
        .maybeSingle();

    return <HowItWorksClient featureCards={translatedCards} sectionImage={section?.image_url || undefined} />;
}
