import { getAdminClient } from '@/lib/supabase/admin';
import { CustomBookPromoClient } from './CustomBookPromoClient';

export async function CustomBookPromoServer() {
    const supabase = getAdminClient();

    // Fetch section content
    const { data: sectionData } = await supabase
        .from('section_content')
        .select('*')
        .eq('section_name', 'custom_book')
        .eq('is_active', true)
        .maybeSingle();

    return <CustomBookPromoClient sectionContent={sectionData || undefined} />;
}
