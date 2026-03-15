'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Package, Truck, CheckCircle2, Clock, MapPin, ExternalLink, ChevronRight, AlertCircle, ShoppingBag } from 'lucide-react';

const STATUS_STEPS = [
    { key: 'pending', label: 'Замовлення прийнято', icon: ShoppingBag },
    { key: 'confirmed', label: 'Оплачено', icon: CheckCircle2 },
    { key: 'in_production', label: 'У виробництві', icon: Clock },
    { key: 'shipped', label: 'Відправлено', icon: Truck },
    { key: 'delivered', label: 'Доставлено', icon: CheckCircle2 },
];

export default function TrackPage() {
    const [orderNumber, setOrderNumber] = useState('');
    const [contact, setContact] = useState('');
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setOrder(null);

        try {
            const res = await fetch('/api/orders/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderNumber, contact })
            });

            const data = await res.json();
            if (res.ok) {
                setOrder(data);
            } else {
                setError(data.error || 'Сталася помилка');
            }
        } catch (err) {
            setError('Помилка з’єднання');
        } finally {
            setLoading(false);
        }
    };

    const getStatusIndex = (status: string) => {
        const order = ['pending', 'confirmed', 'in_production', 'shipped', 'delivered'];
        return order.indexOf(status);
    };

    const getTimestamp = (key: string) => {
        if (!order) return null;
        const fieldMap: any = {
            'pending': order.created_at,
            'confirmed': order.confirmed_at || order.paid_at,
            'in_production': order.production_at,
            'shipped': order.shipped_at,
            'delivered': order.delivered_at
        };
        const val = fieldMap[key];
        return val ? new Date(val).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
    };

    const currentIdx = order ? getStatusIndex(order.order_status) : -1;

    return (
        <main style={mainStyle}>
            <div style={containerStyle}>

                <header style={{ textAlign: 'center', marginBottom: '64px' }}>
                    <div style={badgeStyle}>ДЛЯ КЛІЄНТІВ</div>
                    <h1 style={titleStyle}>Де моє замовлення? 📦</h1>
                    <p style={subtitleStyle}>Введіть номер вашого замовлення та контактні дані, щоб перевірити статус виготовлення.</p>
                </header>

                <div style={searchCardStyle}>
                    <form onSubmit={handleSearch} style={formGridStyle}>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>НОМЕР ЗАМОВЛЕННЯ</label>
                            <input
                                required
                                placeholder="PB-2025-0042"
                                style={inputStyle}
                                value={orderNumber}
                                onChange={e => setOrderNumber(e.target.value)}
                            />
                        </div>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>EMAIL АБО ТЕЛЕФОН</label>
                            <input
                                required
                                placeholder="email@example.com"
                                style={inputStyle}
                                value={contact}
                                onChange={e => setContact(e.target.value)}
                            />
                        </div>
                        <button disabled={loading} style={searchBtnStyle}>
                            {loading ? 'Шукаємо...' : <><Search size={20} /> Знайти замовлення</>}
                        </button>
                    </form>
                    {error && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={errorBoxStyle}>
                            <AlertCircle size={18} /> {error}
                        </motion.div>
                    )}
                </div>

                <AnimatePresence>
                    {order && (
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}
                        >
                            {/* Progress Bar Component */}
                            <div style={resultCardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '48px' }}>
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: 900, color: '#94a3b8', letterSpacing: '0.1em' }}>СТАТУС ЗАМОВЛЕННЯ</div>
                                        <div style={{ fontSize: '24px', fontWeight: 900, color: '#263A99' }}>{order.order_number}</div>
                                    </div>
                                    <div style={liveBadgeStyle}>ЖИВЕ ОНОВЛЕННЯ</div>
                                </div>

                                <div style={progressWrapperStyle}>
                                    <div style={progressLineBackground} />
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(currentIdx / (STATUS_STEPS.length - 1)) * 100}%` }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                        style={progressLineActive}
                                    />
                                    <div style={stepsGrid}>
                                        {STATUS_STEPS.map((step, idx) => {
                                            const isDone = idx <= currentIdx;
                                            const isActive = idx === currentIdx;
                                            const timestamp = getTimestamp(step.key);

                                            return (
                                                <div key={idx} style={stepContainer}>
                                                    <motion.div
                                                        animate={{
                                                            scale: isActive ? [1, 1.2, 1] : 1,
                                                            backgroundColor: isDone ? '#ef4444' : '#fff'
                                                        }}
                                                        transition={{ repeat: isActive ? Infinity : 0, duration: 2 }}
                                                        style={{
                                                            ...stepIconWrapper,
                                                            borderColor: isDone ? '#ef4444' : '#e2e8f0',
                                                            color: isDone ? '#fff' : '#94a3b8'
                                                        }}
                                                    >
                                                        <step.icon size={20} />
                                                    </motion.div>
                                                    <div style={{ ...stepLabelStyle, color: isDone ? '#263A99' : '#94a3b8', fontWeight: isDone ? 800 : 500 }}>
                                                        {step.label}
                                                    </div>
                                                    {timestamp && <div style={stepTimeStyle}>{timestamp}</div>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div style={detailsGridStyle}>
                                {/* Items Summary */}
                                <div style={resultCardStyle}>
                                    <h3 style={sectionTitleStyle}>Склад замовлення</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {order.items?.map((item: any, idx: number) => (
                                            <div key={idx} style={itemRowStyle}>
                                                <img src={item.image} style={itemImageStyle} />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 800, color: '#263A99' }}>{item.name}</div>
                                                    <div style={{ fontSize: '13px', color: '#64748b' }}>{item.qty} шт. • {item.format}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={summaryRowStyle}>
                                        <span>СУМА ДО ОПЛАТИ:</span>
                                        <span style={{ fontSize: '20px', fontWeight: 900, color: '#ef4444' }}>{order.total} ₴</span>
                                    </div>
                                </div>

                                {/* Delivery Info */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                    <div style={resultCardStyle}>
                                        <h3 style={sectionTitleStyle}>Доставка</h3>
                                        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                                            <div style={deliveryIconBox}><Truck size={24} color="#ef4444" /></div>
                                            <div>
                                                <div style={{ fontWeight: 800, color: '#263A99' }}>{order.delivery_method}</div>
                                                <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
                                                    {order.delivery_address?.city}<br />
                                                    {order.delivery_address?.warehouse || order.delivery_address?.address}
                                                </p>
                                            </div>
                                        </div>
                                        {order.ttn && (
                                            <div style={ttnBoxStyle}>
                                                <div style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', marginBottom: '8px' }}>ВІДСТЕЖЕННЯ НОВОЇ ПОШТИ</div>
                                                <div style={{ fontSize: '18px', fontWeight: 900, color: '#263A99', marginBottom: '16px' }}>{order.ttn}</div>
                                                <a
                                                    href={`https://novaposhta.ua/tracking/?cargo_number=${order.ttn}`}
                                                    target="_blank"
                                                    style={ttnBtnStyle}
                                                >
                                                    Перевірити на НП <ExternalLink size={16} />
                                                </a>
                                            </div>
                                        )}
                                    </div>

                                    <div style={resultCardStyle}>
                                        <h3 style={sectionTitleStyle}>Потрібна допомога?</h3>
                                        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>Якщо у вас виникли питання щодо замовлення, зв'яжіться з нами в Telegram.</p>
                                        <a href="https://t.me/touchmemories" target="_blank" style={supportBtnStyle}>Написати менеджеру</a>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </main>
    );
}

const mainStyle = { minHeight: '100vh', backgroundColor: '#fafafa', paddingTop: '100px', paddingBottom: '100px' };
const containerStyle = { maxWidth: '1000px', margin: '0 auto', padding: '0 24px' };
const badgeStyle = { display: 'inline-block', backgroundColor: '#f1f5f9', color: '#64748b', padding: '6px 16px', borderRadius: '100px', fontSize: '12px', fontWeight: 900, marginBottom: '24px', letterSpacing: '0.05em' };
const titleStyle = { fontSize: '48px', fontWeight: 900, color: '#263A99', marginBottom: '20px', letterSpacing: '-0.02em' };
const subtitleStyle = { color: '#64748b', fontSize: '18px', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 };

const searchCardStyle = { backgroundColor: 'white', padding: '48px', borderRadius: '40px', boxShadow: '0 20px 50px rgba(0,0,0,0.05)', marginBottom: '64px' };
const formGridStyle = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr) auto', gap: '24px', alignItems: 'flex-end' };
const inputGroupStyle = { display: 'flex', flexDirection: 'column' as any, gap: '10px' };
const labelStyle = { fontSize: '11px', fontWeight: 900, color: '#94a3b8', letterSpacing: '0.05em' };
const inputStyle = { padding: '16px 20px', borderRadius: '16px', border: '2px solid #f1f5f9', fontSize: '16px', fontWeight: 600, outline: 'none', transition: 'border-color 0.2s', width: '100%' };
const searchBtnStyle = { height: '58px', padding: '0 32px', borderRadius: '16px', backgroundColor: '#263A99', color: 'white', border: 'none', fontWeight: 800, fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 10px 20px rgba(30, 41, 59, 0.15)' };
const errorBoxStyle = { marginTop: '24px', padding: '16px', backgroundColor: '#fff1f2', borderRadius: '12px', color: '#e11d48', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' };

const resultCardStyle = { backgroundColor: 'white', padding: '40px', borderRadius: '32px', border: '1px solid #f1f5f9' };
const liveBadgeStyle = { padding: '6px 12px', backgroundColor: '#f0fdf4', color: '#22c55e', borderRadius: '6px', fontSize: '11px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' };

const progressWrapperStyle = { position: 'relative' as any, padding: '40px 0 20px' };
const progressLineBackground = { position: 'absolute' as any, top: '60px', left: '0', right: '0', height: '4px', backgroundColor: '#f1f5f9', borderRadius: '2px' };
const progressLineActive = { position: 'absolute' as any, top: '60px', left: '0', height: '4px', backgroundColor: '#ef4444', borderRadius: '2px', zIndex: 1 };
const stepsGrid = { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', position: 'relative' as any, zIndex: 2 };
const stepContainer = { display: 'flex', flexDirection: 'column' as any, alignItems: 'center', textAlign: 'center' as any };
const stepIconWrapper = { width: '44px', height: '44px', borderRadius: '14px', border: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', backgroundColor: 'white' };
const stepLabelStyle = { fontSize: '13px', marginBottom: '4px' };
const stepTimeStyle = { fontSize: '11px', color: '#94a3b8', fontWeight: 500 };

const detailsGridStyle = { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' };
const sectionTitleStyle = { fontSize: '18px', fontWeight: 900, color: '#263A99', marginBottom: '24px' };
const itemRowStyle = { display: 'flex', gap: '16px', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid #f8fafc' };
const itemImageStyle = { width: '56px', height: '56px', borderRadius: '10px', objectFit: 'cover' as any, border: '1px solid #f1f5f9' };
const summaryRowStyle = { marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', backgroundColor: '#fafafa', borderRadius: '20px', fontWeight: 900, fontSize: '14px', color: '#64748b' };

const deliveryIconBox = { width: '48px', height: '48px', borderRadius: '14px', backgroundColor: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const ttnBoxStyle = { padding: '24px', backgroundColor: '#f8fafc', borderRadius: '20px', border: '1px solid #f1f5f9' };
const ttnBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', borderRadius: '12px', backgroundColor: '#ef4444', color: 'white', textDecoration: 'none', fontWeight: 800, fontSize: '14px', boxShadow: '0 8px 15px rgba(239, 68, 68, 0.2)' };
const supportBtnStyle = { display: 'block', padding: '14px', textAlign: 'center' as any, borderRadius: '12px', backgroundColor: '#0088cc', color: 'white', textDecoration: 'none', fontWeight: 800, fontSize: '14px' };
