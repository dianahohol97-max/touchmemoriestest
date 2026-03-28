import { getAdminClient } from '@/lib/supabase/admin';
import { PhotoPrintPromoClient } from './PhotoPrintPromoClient';

export async function PhotoPrintPromoServer() {
    const supabase = getAdminClient();

    // Fetch section content
    const { data: sectionData } = await supabase
        .from('section_content')
        .select('*')
        .eq('section_name', 'photo_print')
        .eq('is_active', true)
        .maybeSingle();

    return <PhotoPrintPromoClient sectionContent={sectionData || undefined} />;
}
