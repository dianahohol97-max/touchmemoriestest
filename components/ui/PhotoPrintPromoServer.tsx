import { getAdminClient } from '@/lib/supabase/admin';
import { PhotoPrintPromoClient } from './PhotoPrintPromoClient';

export async function PhotoPrintPromoServer() {
    const supabase = getAdminClient();

    // Fetch section content
    const { data: sectionData } = await supabase
        .from('section_content')
        .select('*')
        .eq('section_name', 'photo_print_promo')
        .eq('is_active', true)
        .single();

    return <PhotoPrintPromoClient sectionContent={sectionData || undefined} />;
}
