'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Globe, Save, Loader2 } from 'lucide-react';

// Mirrors lib/payment/pricing-region.ts DEFAULT_INTL_SHIPPING.
const DEFAULTS = { free_threshold_eur: 0, flat_fee_eur: 25 };

export default function InternationalDeliveryPage() {
    const supabase = createClient();
    const [flatFee, setFlatFee] = useState<string>(String(DEFAULTS.flat_fee_eur));
    const [eurRate, setEurRate] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            const { data } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'intl_shipping')
                .maybeSingle();
            const v = (data?.value as any) || {};
            if (typeof v.flat_fee_eur === 'number') setFlatFee(String(v.flat_fee_eur));
            try {
                const r = await fetch('/api/exchange-rate').then(res => res.json());
                if (r?.rate) setEurRate(r.rate);
            } catch { /* ignore */ }
            setLoading(false);
        })();
    }, []);

    const save = async () => {
        const ff = Number(flatFee);
        if (Number.isNaN(ff) || ff < 0) {
            toast.error('Введіть коректне невід’ємне число');
            return;
        }
        setSaving(true);
        const { error } = await supabase
            .from('settings')
            .upsert({ key: 'intl_shipping', value: { free_threshold_eur: 0, flat_fee_eur: ff } }, { onConflict: 'key' });
        setSaving(false);
        if (error) {
            toast.error('Помилка збереження');
            return;
        }
        toast.success('Збережено. Зміни застосуються протягом кількох хвилин.');
    };

    const ff = Number(flatFee) || 0;
    // Preview in UAH using the current buffered rate.
    const feeUah = eurRate ? Math.round(ff * eurRate) : null;

    const inputStyle: React.CSSProperties = {
        width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1',
        borderRadius: 8, padding: '10px 12px', fontSize: 15,
    };

    return (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '8px 4px' }}>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#263A99', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Globe size={26} /> Міжнародна доставка
            </h1>
            <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
                Тарифи для замовлень із доставкою за кордон. Вартість задається в євро, а клієнт оплачує
                в гривні за поточним курсом. Націнка +30% до цін для іншомовних відвідувачів із міжнародною
                доставкою діє автоматично (на рівні коду) і тут не налаштовується.
            </p>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: '#94a3b8' }}>
                    <Loader2 size={28} className="animate-spin" />
                </div>
            ) : (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 24 }}>
                    <div style={{ marginBottom: 18 }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                            Фіксована плата за доставку (€)
                        </label>
                        <input
                            type="number" min="0" step="1" value={flatFee}
                            onChange={e => setFlatFee(e.target.value)} style={inputStyle}
                        />
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 5 }}>
                            Стягується на кожне міжнародне замовлення. Безкоштовної доставки немає.
                        </div>
                    </div>

                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', fontSize: 14, color: '#475569', lineHeight: 1.6, marginBottom: 20 }}>
                        <strong style={{ color: '#263A99' }}>Як це виглядатиме для клієнта:</strong>
                        <div style={{ marginTop: 6 }}>
                            {`Плата за доставку — €${ff}${feeUah ? ` (≈ ${feeUah.toLocaleString('uk-UA')} ₴)` : ''} на кожне міжнародне замовлення.`}
                        </div>
                        {eurRate && (
                            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                                Поточний курс: 1 € ≈ {eurRate.toLocaleString('uk-UA')} ₴ (оновлюється автоматично).
                            </div>
                        )}
                    </div>

                    <button
                        onClick={save}
                        disabled={saving}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#263A99', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Зберегти
                    </button>
                </div>
            )}

            <p style={{ color: '#94a3b8', fontSize: 12.5, lineHeight: 1.6, marginTop: 18 }}>
                Зверніть увагу: для міжнародних замовлень накладна Нової Пошти не створюється — відправлення
                й трек-номер додаються вручну. Митні декларації та обмеження за країнами тут не керуються.
            </p>
        </div>
    );
}
