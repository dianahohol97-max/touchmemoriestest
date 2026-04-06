import { getAdminClient } from '@/lib/supabase/admin';
import { GiftIdeasClient } from './GiftIdeasClient';

export async function GiftIdeasServer({ locale = "uk" }: { locale?: string } = {}) {
    const supabase = getAdminClient();

    // Fetch section content
    const { data: sectionData } = await supabase
        .from('section_content')
        .select('*')
        .eq('section_name', 'gift_ideas')
        .eq('is_active', true)
        .maybeSingle();

    // Apply locale translations
    if (sectionData && locale !== 'uk') {
        const trans = (sectionData as any).translations?.[locale];
        if (trans) {
            if (trans.heading) (sectionData as any).heading = trans.heading;
            if (trans.subheading || trans.body) (sectionData as any).subheading = trans.subheading || trans.body;
            if (trans.cta_text) (sectionData as any).cta_text = trans.cta_text;
        }
    }

    return (
        <GiftIdeasClient
            collections={[]}
            sectionContent={sectionData || undefined}
        />
    );
}
