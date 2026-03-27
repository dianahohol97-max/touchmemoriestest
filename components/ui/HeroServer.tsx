import { getAdminClient } from '@/lib/supabase/admin';
import { HeroClient } from './HeroClient';

export async function HeroServer() {
    const supabase = getAdminClient();

    // Fetch hero content
    const { data: heroContent } = await supabase
        .from('hero_content')
        .select('*')
        .eq('is_active', true)
        .single();

    // Fetch hero buttons
    const { data: heroButtons } = await supabase
        .from('hero_buttons')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

    return (
        <HeroClient
            heroContent={heroContent || undefined}
            heroButtons={heroButtons || []}
        />
    );
}
