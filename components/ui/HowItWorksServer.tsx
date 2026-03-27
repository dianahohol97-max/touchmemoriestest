import { getAdminClient } from '@/lib/supabase/admin';
import { HowItWorksClient } from './HowItWorksClient';

export async function HowItWorksServer() {
    const supabase = getAdminClient();

    // Fetch feature cards
    const { data: featureCards } = await supabase
        .from('why_choose_us_cards')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

    return <HowItWorksClient featureCards={featureCards || []} />;
}
