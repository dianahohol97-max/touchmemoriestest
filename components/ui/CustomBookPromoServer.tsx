import { getAdminClient } from '@/lib/supabase/admin';
import { CustomBookPromoClient } from './CustomBookPromoClient';

export async function CustomBookPromoServer({ locale = "uk" }: { locale?: string } = {}) {
    const supabase = getAdminClient();

    // Fetch section content
    const { data: sectionData } = await supabase
        .from('section_content')
        .select('*')
        .eq('section_name', 'custom_book')
        .eq('is_active', true)
        .maybeSingle();

    if (sectionData && locale !== 'uk') {
        const trans = (sectionData as any).translations?.[locale];
        if (trans) {
            if (trans.heading) (sectionData as any).heading = trans.heading;
            if (trans.subheading) (sectionData as any).subheading = trans.subheading;
            if (trans.body) (sectionData as any).body_text = trans.body;
            if (trans.cta_text) (sectionData as any).cta_text = trans.cta_text;
        }
    }
    return <CustomBookPromoClient sectionContent={sectionData || undefined} />;
}
