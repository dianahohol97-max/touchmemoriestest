'use client';

export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { motion } from 'framer-motion';
import { Package, Truck, CheckCircle2, Clock, MapPin, ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const getSupabase = () => createClient();

export default function TrackOrderPage() {
    const supabase = getSupabase();
    const params = useParams();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchOrder() {
            const { data } = await supabase
                .from('orders')
                .select('*')
                .eq('id', params.id)
                .single();

            if (data) setOrder(data);
            setLoading(false);
        }
        fetchOrder();

        const channel = supabase
            .channel(`track-${params.id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${params.id}` }, (payload) => {
                setOrder(payload.new);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [params.id]);

    if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Завантаження...</div>;
    if (!order) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Замовлення не знайдено</div>;

    const steps = [
        { status: 'pending', label: 'Прийнято', icon: <Clock size={24} />, desc: 'Очікуємо на оплату або підтвердження' },
        { status: 'confirmed', label: 'Оплачено', icon: <CheckCircle2 size={24} />, desc: 'Замовлення в черзі на виготовлення' },
        { status: 'processing', label: 'Виготовляється', icon: <Package size={24} />, desc: 'Ми друкуємо вашу фотокнигу' },
        { status: 'shipped', label: 'Відправлено', icon: <Truck size={24} />, desc: 'Посилка вже в дорозі до вас' }
    ];

    const currentStepIndex = steps.findIndex(s => s.status === order.order_status) === -1
        ? (order.payment_status === 'paid' ? 1 : 0)
        : steps.findIndex(s => s.status === order.order_status);

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#fcfcfc' }}>
            <Navigation />

            <main style={{ padding: '140px 20px 80px', maxWidth: '800px', margin: '0 auto' }}>
                <header style={{ textAlign: 'center', marginBottom: '60px' }}>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 900, marginBottom: '16px' }}>
                        Відстеження замовлення
                    </h1>
                    <p style={{ color: '#666', fontSize: '18px' }}>
                        Номер замовлення: <strong>#{order.order_number}</strong>
                    </p>
                </header>

                <div style={{ backgroundColor: 'white', padding: '48px', borderRadius: "3px", boxShadow: '0 4px 30px rgba(0,0,0,0.03)', border: '1px solid #f0f0f0' }}>

                    {/* Status Timeline */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '23px', top: '24px', bottom: '24px', width: '2px', backgroundColor: '#f0f0f0', zIndex: 0 }}></div>

                        {steps.map((step, idx) => {
                            const isCompleted = idx < currentStepIndex || (idx === 1 && order.payment_status === 'paid');
                            const isCurrent = idx === currentStepIndex;

                            return (
                                <div key={idx} style={{ display: 'flex', gap: '24px', position: 'relative', zIndex: 1 }}>
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: "3px",
                                        backgroundColor: isCompleted ? '#ECFDF5' : (isCurrent ? 'var(--primary)' : '#f8fafc'),
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: isCompleted ? '#10B981' : (isCurrent ? 'white' : '#cbd5e1'),
                                        border: isCurrent ? 'none' : '2px solid #f1f5f9'
                                    }}>
                                        {step.icon}
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '18px', fontWeight: 800, color: isCurrent ? 'var(--primary)' : '#263A99', marginBottom: '4px' }}>
                                            {step.label}
                                        </h3>
                                        <p style={{ fontSize: '15px', color: '#64748b', margin: 0 }}>
                                            {step.desc}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Delivery Details */}
                    {order.ttn && (
                        <div style={{ marginTop: '60px', padding: '32px', backgroundColor: '#f0f9ff', borderRadius: "3px", border: '1px solid #e0f2fe' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '13px', color: '#263A99', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                        ТТН Нової Пошти
                                    </div>
                                    <div style={{ fontSize: '24px', fontWeight: 900, color: '#263A99' }}>{order.ttn}</div>
                                </div>
                                <a
                                    href={`https://novaposhta.ua/tracking/?cargo_number=${order.ttn}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        backgroundColor: '#263A99',
                                        color: 'white',
                                        padding: '12px 24px',
                                        borderRadius: "3px",
                                        textDecoration: 'none',
                                        fontWeight: 700,
                                        fontSize: '15px'
                                    }}
                                >
                                    Відстежити <ExternalLink size={16} />
                                </a>
                            </div>
                        </div>
                    )}

                    <div style={{ marginTop: '48px', display: 'flex', gap: '16px', alignItems: 'center', color: '#666', fontSize: '15px' }}>
                        <MapPin size={18} />
                        <span>Доставка: {order.delivery_method} • {order.delivery_address?.city || order.delivery_address?.address}</span>
                    </div>

                </div>
            </main>

            <Footer />
        </div>
    );
}
