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

    return (
        <GiftIdeasClient
            collections={[]}
            sectionContent={sectionData || undefined}
        />
    );
}
