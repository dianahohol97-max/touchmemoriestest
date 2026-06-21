import { getAdminClient } from '@/lib/supabase/admin';
import CorporateClient from './CorporateClient';

export const metadata = {
    title: 'Корпоративні замовлення — Touch.Memories',
    robots: { index: false, follow: false }, // non-public until launch
};

export const dynamic = 'force-dynamic';

export default async function CorporatePage() {
    const admin = getAdminClient();
    const { data: products } = await admin
        .from('corporate_products')
        .select('id, name, slug, description, image_url, options')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    return <CorporateClient products={products || []} />;
}
