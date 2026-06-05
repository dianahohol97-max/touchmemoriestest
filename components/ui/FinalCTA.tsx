import { getAdminClient } from '@/lib/supabase/admin';
import { FinalCTAClient } from './FinalCTAClient';

// Server wrapper: the 9 guest-book showcase tiles are editable in admin →
// Контент → секція "final_cta" (metadata.tiles[0..8]). Empty slots fall back
// to the on-brand gradient tile (no broken images).
export async function FinalCTA() {
    const supabase = getAdminClient();
    const { data: section } = await supabase
        .from('section_content')
        .select('metadata')
        .eq('section_name', 'final_cta')
        .eq('is_active', true)
        .maybeSingle();

    const tiles: string[] = Array.isArray((section?.metadata as any)?.tiles)
        ? (section!.metadata as any).tiles
        : [];
    return <FinalCTAClient tiles={tiles} />;
}
