'use client';
import { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import PromoCodeForm from '@/components/admin/marketing/PromoCodeForm';
import { Loader2 } from 'lucide-react';

export default function EditPromoCodePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const supabase = createClient();
    const [promo, setPromo] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            fetchPromo();
        }
    }, [id]);

    const fetchPromo = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('promo_codes')
            .select('*')
            .eq('id', id)
            .single();

        if (data) setPromo(data);
        setLoading(false);
    };

    if (loading) return <div style={{ padding: '100px', display: 'flex', justifyContent: 'center' }}><Loader2 className="animate-spin" size={32} color="#94a3b8" /></div>;
    if (!promo) return <div style={{ padding: '100px', textAlign: 'center' }}>Промокод не знайдений</div>;

    return (
        <div style={{ padding: '20px 0' }}>
            <PromoCodeForm id={id} initialData={promo} />
        </div>
    );
}
