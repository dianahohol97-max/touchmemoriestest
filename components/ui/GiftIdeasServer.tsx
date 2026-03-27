import { getAdminClient } from '@/lib/supabase/admin';
import { GiftIdeasClient } from './GiftIdeasClient';

export async function GiftIdeasServer() {
    const supabase = getAdminClient();

    // Fetch gift collections
    const { data: collections } = await supabase
        .from('gift_collections')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

    // Fetch section content
    const { data: sectionData } = await supabase
        .from('section_content')
        .select('*')
        .eq('section_name', 'gift_ideas_main')
        .eq('is_active', true)
        .single();

    return (
        <GiftIdeasClient
            collections={collections || []}
            sectionContent={sectionData || undefined}
        />
    );
}
