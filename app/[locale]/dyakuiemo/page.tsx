'use client';
import { useT } from '@/lib/i18n/context';

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2, Clock, XCircle, ShoppingBag, Phone } from 'lucide-react';
import { motion } from 'framer-motion';

function DyakuiemoContent() {
    const searchParams = useSearchParams();
    const t = useT();
    const router = useRouter();
    const orderId = searchParams.get('order');
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!orderId) { setLoading(false); return; }
        const supabase = createClient();
        // Poll order status for up to 10 seconds (webhook may not have arrived yet)
        let attempts = 0;
        const poll = async () => {
            const { data } = await supabase
                .from('orders')
                .select('id, order_number, total, payment_status, customer_name')
                .eq('id', orderId)
                .single();
            if (data) setOrder(data);
            attempts++;
            if (data?.payment_status !== 'paid' && attempts < 5) {
                setTimeout(poll, 2000);
            } else {
                setLoading(false);
            }
        };
        poll();
    }, [orderId]);

    const isPaid = order?.payment_status === 'paid';
    const isPending = !order || order.payment_status === 'pending';

    return (
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '140px 20px 80px' }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ textAlign: 'center', maxWidth: '560px', width: '100%' }}
            >
                {/* Icon */}
                <div style={{
                    width: 96, height: 96, borderRadius: '50%',
                    background: isPaid ? '#dcfce7' : '#fef9c3',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 28px'
                }}>
                    {isPaid
                        ? <CheckCircle2 size={48} color="#16a34a" />
                        : <Clock size={48} color="#ca8a04" />
                    }
                </div>

                {/* Title */}
                <h1 style={{ fontSize: 36, fontWeight: 950, color: '#1e2d7d', marginBottom: 12 }}>
                    {isPaid ? t('thankyou.paid_title') : t('thankyou.pending_title')}
                </h1>

                {/* Order number */}
                {order?.order_number && (
                    <div style={{
                        display: 'inline-block', padding: '8px 20px', background: '#f0f3ff',
                        borderRadius: 8, fontSize: 15, fontWeight: 700, color: '#1e2d7d', marginBottom: 20
                    }}>
                        #{order.order_number}
                    </div>
                )}

                {/* Message */}
                <p style={{ fontSize: 17, color: '#64748b', lineHeight: 1.65, marginBottom: 32 }}>
                    {isPaid
                        ? `Дякуємо, ${order?.customer_name?.split(' ')[0] || ''}! Ваша оплата ${order?.total?.toLocaleString('uk-UA')} ₴ успішно прийнята. Ми вже починаємо виготовлення вашого замовлення.`
                        : 'Ваше замовлення збережено. Якщо оплата пройшла — ми отримали підтвердження і зв\'яжемося з вами найближчим часом.'
                    }
                </p>

                {/* Status badge */}
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '10px 20px', borderRadius: 8,
                    background: isPaid ? '#dcfce7' : '#fef9c3',
                    color: isPaid ? '#15803d' : '#854d0e',
                    fontSize: 14, fontWeight: 700, marginBottom: 36
                }}>
                    {isPaid ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                    {isPaid ? 'Оплачено' : 'Очікує підтвердження'}
                </div>

                {/* What's next */}
                <div style={{
                    background: '#f8fafc', borderRadius: 12, padding: '24px 28px',
                    textAlign: 'left', marginBottom: 36, border: '1px solid #e2e8f0'
                }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
                        Що далі
                    </div>
                    {[
                        { icon: '📞', text: 'Менеджер зв\'яжеться з вами протягом 1-2 годин' },
                        { icon: '🎨', text: 'Ми підготуємо макет та узгодимо деталі' },
                        { icon: '🖨️', text: 'Виготовлення займає від 3 до 7 робочих днів' },
                        { icon: '📦', text: 'Відправлення Новою Поштою по всій Україні' },
                    ].map((step, i) => (
                        <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 18 }}>{step.icon}</span>
                            <span style={{ fontSize: 14, color: '#475569', lineHeight: 1.5 }}>{step.text}</span>
                        </div>
                    ))}
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => router.push('/catalog')}
                        style={{
                            padding: '14px 28px', background: '#1e2d7d', color: '#fff',
                            border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
                        }}
                    >
                        <ShoppingBag size={18} /> {t('thankyou.continue_shopping')}
                    </button>
                    <a
                        href="tel:+380970000000"
                        style={{
                            padding: '14px 28px', background: '#fff', color: '#1e2d7d',
                            border: '1.5px solid #c7d2fe', borderRadius: 10, fontSize: 15, fontWeight: 700,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                            textDecoration: 'none'
                        }}
                    >
                        <Phone size={18} /> {t('thankyou.call_us')}
                    </a>
                </div>
            </motion.div>
        </main>
    );
}

export default function DyakuiemoPage() {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
            <Navigation />
            <Suspense fallback={
                <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', border: '4px solid #e2e8f0', borderTopColor: '#1e2d7d', animation: 'spin 0.8s linear infinite' }} />
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </main>
            }>
                <DyakuiemoContent />
            </Suspense>
            <Footer categories={[]} />
        </div>
    );
}
