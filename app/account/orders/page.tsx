'use client';
import { useState, useEffect } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { motion } from 'framer-motion';
import { Package, RotateCw, ShoppingCart, Loader2, ArrowRight } from 'lucide-react';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function AccountOrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [repeatingOrderId, setRepeatingOrderId] = useState<string | null>(null);
    const addItemsToCart = useCartStore(state => state.addItems);
    const router = useRouter();

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/account/orders');
            if (res.status === 401) {
                // If not logged in, they shouldn't be here, but just in case
                router.push('/');
                return;
            }
            const data = await res.json();
            if (data.orders) setOrders(data.orders);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleRepeatOrder = async (order: any) => {
        setRepeatingOrderId(order.id);

        // Check if any items are from the constructor
        const hasPhotobook = order.items?.some((item: any) => item.product_id && item.pages);

        if (hasPhotobook) {
            // Need to prompt user about design
            const reuseDesign = confirm('Бажаєте використати збережений дизайн фотокниги (якщо він ще доступний), чи створити новий дизайн?\n\nOK: Використати старий дизайн\nCancel: Буду створювати новий');

            // Note: In a fully fleshed out constructor, we would duplicate the konva canvas data row here.
            // For now, we will add the items to cart natively. 
            // In a real flow if they click Cancel we might redirect them to the constructor page.
            if (!reuseDesign) {
                toast.info('Будь ласка, перейдіть до каталогу щоб створити новий дизайн.');
                setRepeatingOrderId(null);
                router.push('/catalog/photobooks');
                return;
            }
        }

        // Push all items to Zustand cart
        if (order.items && order.items.length > 0) {
            // Map the old order items to the cart item structure
            const newCartItems = order.items.map((item: any) => ({
                id: item.product_id || Math.random().toString(), // fallback if product_id is missing in old rows
                name: item.name,
                price: item.price,
                qty: item.qty || 1,
                image: item.image || '',
            }));

            addItemsToCart(newCartItems);

            toast.success('Товари додано в кошик! Перейти до оформлення →', {
                action: {
                    label: 'Кошик',
                    onClick: () => router.push('/cart')
                },
                duration: 5000,
            });
            router.push('/cart');
        } else {
            toast.error('Немає товарів для повторення');
        }

        setRepeatingOrderId(null);
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' as const, backgroundColor: '#f8fafc' }}>
            <Navigation />

            <main style={{ flex: 1, padding: '120px 20px 80px' }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                        <div>
                            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 900, color: '#1e293b', marginBottom: '8px' }}>
                                Мої замовлення
                            </h1>
                            <p style={{ color: '#64748b', fontSize: '16px' }}>Історія ваших покупок</p>
                        </div>
                        <button
                            onClick={() => router.push('/catalog')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        >
                            <ShoppingCart size={18} /> Створити нове замовлення
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ padding: '100px', textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
                            <Loader2 size={32} className="spin" color="var(--primary)" />
                        </div>
                    ) : orders.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '80px 20px', backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                            <Package size={48} color="#cbd5e1" style={{ margin: '0 auto 20px' }} />
                            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b', marginBottom: '12px' }}>У вас ще немає замовлень</h2>
                            <p style={{ color: '#64748b', marginBottom: '24px' }}>Після оформлення першого замовлення, воно з'явиться тут.</p>
                            <button
                                onClick={() => router.push('/catalog')}
                                style={{ padding: '12px 24px', backgroundColor: '#1e293b', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}
                            >
                                Перейти до каталогу
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '24px' }}>
                            {orders.map((order) => (
                                <motion.div
                                    key={order.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    style={{ backgroundColor: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px', marginBottom: '20px' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', margin: 0 }}>Замовлення {order.order_number}</h3>
                                                <span style={{ padding: '4px 10px', backgroundColor: order.order_status === 'delivered' ? '#dcfce7' : '#f1f5f9', color: order.order_status === 'delivered' ? '#166534' : '#475569', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                                                    {order.order_status === 'delivered' ? 'Виконано' : 'В процесі'}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '14px', color: '#64748b' }}>
                                                {new Date(order.created_at).toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' })}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--primary)' }}>{order.total} ₴</div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                                        {order.items?.map((item: any, idx: number) => (
                                            <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                <div style={{ width: '48px', height: '48px', backgroundColor: '#f8fafc', borderRadius: '8px', flexShrink: 0, overflow: 'hidden' }}>
                                                    {item.image && <img src={item.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                                                    <div style={{ fontSize: '13px', color: '#64748b' }}>{item.qty} шт. × {item.price} ₴</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                                        <button
                                            onClick={() => handleRepeatOrder(order)}
                                            disabled={repeatingOrderId === order.id}
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: 'white', border: '1.5px solid var(--primary)', color: 'var(--primary)', borderRadius: '10px', fontWeight: 700, fontSize: '14px', cursor: repeatingOrderId === order.id ? 'not-allowed' : 'pointer', opacity: repeatingOrderId === order.id ? 0.7 : 1, transition: 'all 0.2s' }}
                                        >
                                            {repeatingOrderId === order.id ? <Loader2 size={16} className="spin" /> : <RotateCw size={16} />}
                                            Замовити знову
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
            <Footer />
            <style jsx>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

