import { getAdminClient } from '@/lib/supabase/admin';
import { WeddingSectionClient, type WeddingImages } from './WeddingSectionClient';

// Server wrapper: card images are editable in admin → Контент → секція "wedding"
// (metadata.images.{guestbook,newspaper,photobook,magazine}). Falls back to the
// bundled /images/wedding/*.png when a slot is empty.
export async function WeddingSection() {
    const supabase = getAdminClient();
    const { data: section } = await supabase
        .from('section_content')
        .select('metadata')
        .eq('section_name', 'wedding')
        .eq('is_active', true)
        .maybeSingle();

    const images: WeddingImages = (section?.metadata as any)?.images || {};
    return <WeddingSectionClient weddingImages={images} />;
}
