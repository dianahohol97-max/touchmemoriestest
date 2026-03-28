import { getAdminClient } from '@/lib/supabase/admin';
import { PhotoboothSectionClient } from './PhotoboothSectionClient';

export async function PhotoboothSectionServer() {
    const supabase = getAdminClient();

    // Fetch section content for photobooth section
    const { data: sectionData } = await supabase
        .from('section_content')
        .select('*')
        .eq('section_name', 'photobooth_promo')
        .eq('is_active', true)
        .maybeSingle();

    return <PhotoboothSectionClient sectionContent={sectionData || undefined} />;
}
