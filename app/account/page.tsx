'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ShoppingBag, Package, Calendar, Tag, ChevronRight, ExternalLink } from 'lucide-react';
import { formatDate } from '@/lib/utils'; // Assuming this utility exists or I'll provide a fallback

export default function OrdersPage() {
    const supabase = createClient();
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data, error } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('customer_email', user.email) // Linking by email for now as a fallback
                    .order('created_at', { ascending: false });

                if (data) setOrders(data);
            }
            setIsLoading(false);
        };
        fetchOrders();
    }, [supabase]);

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
                <div className="animate-pulse text-slate-300">Завантаження замовлень...</div>
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <div style={{ width: '64px', height: '64px', backgroundColor: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                    <ShoppingBag size={32} color="#94a3b8" />
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>У вас ще немає замовлень</h2>
                <p style={{ color: '#64748b', marginBottom: '32px' }}>Зробіть ваше перше замовлення, щоб воно з'явилося тут.</p>
                <a
                    href="/catalog"
                    style={{
                        display: 'inline-block',
                        padding: '12px 24px',
                        backgroundColor: 'var(--primary)',
                        color: 'white',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        fontWeight: 700
                    }}
                >
                    Перейти до каталогу
                </a>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#1e293b' }}>Мої замовлення</h1>
                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>
                    Всього замовлень: <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{orders.length}</span>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {orders.map((order) => (
                    <div
                        key={order.id}
                        style={{
                            border: '1px solid #f1f5f9',
                            borderRadius: '20px',
                            padding: '24px',
                            transition: 'all 0.2s',
                            cursor: 'pointer'
                        }}
                        className="hover:border-blue-100 hover:shadow-sm"
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }} className="order-header">
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>Замовлення #{order.order_number}</span>
                                    <OrderStatusChip status={order.order_status} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: '#64748b' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Calendar size={14} />
                                        {new Date(order.created_at).toLocaleDateString('uk-UA')}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Tag size={14} />
                                        {order.items?.length || 0} товарів
                                    </div>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--primary)' }}>{order.total} ₴</div>
                                <div style={{ fontSize: '12px', color: order.payment_status === 'paid' ? '#16a34a' : '#f59e0b', fontWeight: 700, textTransform: 'uppercase', marginTop: '4px' }}>
                                    {order.payment_status === 'paid' ? 'Оплачено' : 'Очікує оплати'}
                                </div>
                            </div>
                        </div>

                        {/* Quick Items Preview */}
                        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', marginBottom: '20px' }} className="no-scrollbar">
                            {order.items?.slice(0, 5).map((item: any, idx: number) => (
                                <div key={idx} style={{ width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #f1f5f9', flexShrink: 0 }}>
                                    <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            ))}
                            {order.items?.length > 5 && (
                                <div style={{ width: '48px', height: '48px', borderRadius: '8px', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#64748b' }}>
                                    +{order.items.length - 5}
                                </div>
                            )}
                        </div>

                        {order.ttn && (
                            <div style={{
                                backgroundColor: '#f0f9ff',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Package size={18} color="#0369a1" />
                                    <div style={{ fontSize: '13px', color: '#0369a1' }}>
                                        ТТН: <span style={{ fontWeight: 800 }}>{order.ttn}</span>
                                    </div>
                                </div>
                                <a href={`https://novaposhta.ua/tracking/?cargo_number=${order.ttn}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                                    Відстежити <ExternalLink size={12} />
                                </a>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <style jsx>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                @media (max-width: 600px) {
                    .order-header { flex-direction: column; gap: 16px; align-items: flex-start !important; }
                    .order-header > div:last-child { text-align: left !important; }
                }
            `}</style>
        </div>
    );
}

function OrderStatusChip({ status }: { status: string }) {
    const configs: Record<string, { label: string, color: string, bg: string }> = {
        'new': { label: 'Нове', color: '#3b82f6', bg: '#eff6ff' },
        'processing': { label: 'В роботі', color: '#8b5cf6', bg: '#f5f3ff' },
        'shipped': { label: 'Відправлено', color: '#10b981', bg: '#ecfdf5' },
        'delivered': { label: 'Доставлено', color: '#059669', bg: '#f0fdf4' },
        'cancelled': { label: 'Скасовано', color: '#ef4444', bg: '#fef2f2' },
    };

    const config = configs[status] || configs['new'];

    return (
        <span style={{
            fontSize: '11px',
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: '20px',
            backgroundColor: config.bg,
            color: config.color,
            textTransform: 'uppercase',
            letterSpacing: '0.02em'
        }}>
            {config.label}
        </span>
    );
}
