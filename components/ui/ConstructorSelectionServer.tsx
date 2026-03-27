import { getAdminClient } from '@/lib/supabase/admin';
import { ConstructorSelectionClient } from './ConstructorSelectionClient';

export async function ConstructorSelectionServer() {
    const supabase = getAdminClient();

    // Fetch section content for constructor selection
    const { data: sectionData } = await supabase
        .from('section_content')
        .select('*')
        .eq('section_name', 'constructor_selection')
        .eq('is_active', true)
        .single();

    return <ConstructorSelectionClient sectionContent={sectionData || undefined} />;
}
