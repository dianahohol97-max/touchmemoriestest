'use client';

export const dynamic = 'force-dynamic';
import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { motion } from 'framer-motion';
import { CheckCircle, FileText, Package, Truck } from 'lucide-react';
import { trackPurchase } from '@/components/providers/AnalyticsProvider';
import { createClient } from '@/lib/supabase/client';

const getSupabase = () => createClient();

export default function OrderSuccessPage() {
    const supabase = getSupabase();
    const params = useParams();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const trackedRef = useRef(false);

    useEffect(() => {
        async function fetchOrder() {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('id', params.id)
                .single();

            if (data) setOrder(data);
            setLoading(false);
        }
        fetchOrder();

        // Set up realtime listener for payment sync
        const channel = supabase
            .channel(`order-${params.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders',
                filter: `id=eq.${params.id}`
            }, (payload) => {
                setOrder(payload.new);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [params.id]);

    if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Завантаження...</div>;
    if (!order) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Замовлення не знайдено</div>;

    const isPaid = order.payment_status === 'paid';

    useEffect(() => {
        if (!loading && order && isPaid && !trackedRef.current) {
            trackPurchase(order.order_number || order.id, order.items || [], order.total);
            trackedRef.current = true;
        }
    }, [loading, order, isPaid]);

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#fcfcfc' }}>
            <Navigation />

            <main style={{ padding: '140px 20px 80px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    style={{ backgroundColor: 'white', padding: '60px 40px', borderRadius: "3px", boxShadow: '0 4px 30px rgba(0,0,0,0.05)' }}
                >
                    <div style={{ display: 'inline-flex', padding: '20px', backgroundColor: isPaid ? '#ECFDF5' : '#FEF3C7', borderRadius: "3px", color: isPaid ? '#10B981' : '#F59E0B', marginBottom: '32px' }}>
                        <CheckCircle size={48} />
                    </div>

                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', marginBottom: '16px' }}>
                        {isPaid ? 'Дякуємо за замовлення!' : 'Очікуємо на оплату...'}
                    </h1>
                    <p style={{ color: '#666', fontSize: '18px', marginBottom: '40px' }}>
                        Номер вашого замовлення: <strong>#{order.order_number}</strong>
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', textAlign: 'left', marginBottom: '40px' }}>
                        <div style={infoBlockStyle}>
                            <div style={iconWrapperStyle}><Package size={20} /></div>
                            <div>
                                <div style={infoLabelStyle}>Статус</div>
                                <div style={infoValueStyle}>{order.order_status === 'confirmed' ? 'Підтверджено' : 'Обробляється'}</div>
                            </div>
                        </div>
                        <div style={infoBlockStyle}>
                            <div style={iconWrapperStyle}><Truck size={20} /></div>
                            <div>
                                <div style={infoLabelStyle}>Доставка</div>
                                <div style={infoValueStyle}>{order.delivery_method}</div>
                            </div>
                        </div>
                    </div>

                    <div style={{ textAlign: 'left', marginBottom: '40px', backgroundColor: '#f9f9f9', padding: '32px', borderRadius: "3px" }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px' }}>Ваше замовлення</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {order.items?.map((item: any, idx: number) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '15px', color: '#333' }}>
                                    <span>{item.name} × {item.qty}</span>
                                    <span style={{ fontWeight: 700 }}>{item.price * item.qty} ₴</span>
                                </div>
                            ))}
                            <div style={{ borderTop: '1px solid #ddd', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 900 }}>
                                <span>Разом:</span>
                                <span>{order.total} ₴</span>
                            </div>
                        </div>
                    </div>

                    {order.ttn && (
                        <a
                            href={`https://novaposhta.ua/tracking/?cargo_number=${order.ttn}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                padding: '20px',
                                backgroundColor: '#EFF6FF',
                                borderRadius: "3px",
                                textDecoration: 'none',
                                color: '#263A99',
                                fontWeight: 600,
                                border: '1px solid #DBEAFE',
                                marginBottom: '16px'
                            }}
                        >
                            <Truck size={20} />
                            Відстежити посилку (ТТН: {order.ttn})
                        </a>
                    )}

                    {order.fiscal_url && (
                        <a
                            href={order.fiscal_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                padding: '20px',
                                backgroundColor: '#F8FAFC',
                                borderRadius: "3px",
                                textDecoration: 'none',
                                color: 'var(--primary)',
                                fontWeight: 600,
                                border: '1px solid #E2E8F0',
                                marginBottom: '32px'
                            }}
                        >
                            <FileText size={20} />
                            Переглянути фіскальний чек
                        </a>
                    )}

                    <div style={{ borderTop: '1px solid #eee', paddingTop: '32px' }}>
                        <a href="/catalog" style={{ color: '#666', textDecoration: 'none', fontSize: '15px' }}>
                            ← Повернутися до магазину
                        </a>
                    </div>
                </motion.div>
            </main>

            <Footer />
        </div>
    );
}

const infoBlockStyle = { backgroundColor: '#f9f9f9', padding: '20px', borderRadius: "3px", display: 'flex', gap: '16px', alignItems: 'center' };
const iconWrapperStyle = { color: 'var(--primary)', opacity: 0.6 };
const infoLabelStyle = { fontSize: '12px', color: '#888', textTransform: 'uppercase' as any, letterSpacing: '0.05em' };
const infoValueStyle = { fontWeight: 600, fontSize: '15px' };
