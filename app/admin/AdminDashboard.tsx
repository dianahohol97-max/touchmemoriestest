'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ShoppingBag, Clock, CreditCard, Palette, Plus, RefreshCw, ArrowRight, AlertTriangle, CheckCircle, Users } from 'lucide-react';
import Link from 'next/link';

const supabase = createClient();

// ── helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('uk-UA'); }
function timeAgo(iso: string) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diff < 1) return 'щойно';
    if (diff < 60) return `${diff} хв тому`;
    if (diff < 1440) return `${Math.floor(diff/60)} год тому`;
    return `${Math.floor(diff/1440)} дн тому`;
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
    new:         { label: 'Нове',          color: '#2563eb', bg: '#eff6ff' },
    pending:     { label: 'Очікує',        color: '#d97706', bg: '#fffbeb' },
    in_progress: { label: 'В роботі',      color: '#7c3aed', bg: '#f5f3ff' },
    ready:       { label: 'Готове',        color: '#059669', bg: '#f0fdf4' },
    shipped:     { label: 'Відправлено',   color: '#0891b2', bg: '#ecfeff' },
    completed:   { label: 'Виконано',      color: '#16a34a', bg: '#f0fdf4' },
    cancelled:   { label: 'Скасовано',     color: '#dc2626', bg: '#fef2f2' },
};

const PAY_LABEL: Record<string, { label: string; color: string }> = {
    pending:  { label: 'Очікує оплати', color: '#d97706' },
    paid:     { label: 'Оплачено',      color: '#16a34a' },
    partial:  { label: 'Часткова',      color: '#7c3aed' },
    refunded: { label: 'Повернення',    color: '#dc2626' },
};

// ── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color, href }: any) {
    const card = (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: href ? 'pointer' : 'default', transition: 'box-shadow .15s' }}
            onMouseEnter={e => href && ((e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
            onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.boxShadow = 'none')}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#111827', lineHeight: 1.1 }}>{value}</div>
                {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
            </div>
            {href && <ArrowRight size={16} color="#d1d5db"/>}
        </div>
    );
    return href ? <Link href={href} style={{ textDecoration: 'none' }}>{card}</Link> : card;
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ today: 0, todayRevenue: 0, awaitingPayment: 0, awaitingPaymentSum: 0, inProgress: 0, needDesigner: 0, newClients: 0 });
    const [queue, setQueue] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<{ type: 'warn' | 'ok'; text: string }[]>([]);
    const [lastUpdated, setLastUpdated] = useState('');

    const load = async () => {
        setLoading(true);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const todayIso = today.toISOString();
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

        const [ordersRes, queueRes, clientsRes] = await Promise.all([
            supabase.from('orders').select('id,order_status,payment_status,total,with_designer,created_at'),
            supabase.from('orders')
                .select('id,order_number,customer_name,order_status,payment_status,total,source,created_at,with_designer,items')
                .not('order_status', 'in', '("completed","cancelled")')
                .order('created_at', { ascending: false })
                .limit(20),
            supabase.from('customers').select('id').gte('created_at', weekAgo),
        ]);

        const orders = ordersRes.data || [];
        const todayOrders = orders.filter(o => o.created_at >= todayIso);

        const newStats = {
            today: todayOrders.length,
            todayRevenue: todayOrders.reduce((s, o) => s + Number(o.total || 0), 0),
            awaitingPayment: orders.filter(o => o.payment_status === 'pending' && o.order_status !== 'cancelled').length,
            awaitingPaymentSum: orders.filter(o => o.payment_status === 'pending' && o.order_status !== 'cancelled').reduce((s, o) => s + Number(o.total || 0), 0),
            inProgress: orders.filter(o => ['new','pending','in_progress'].includes(o.order_status)).length,
            needDesigner: orders.filter(o => o.with_designer && !['completed','cancelled'].includes(o.order_status)).length,
            newClients: (clientsRes.data || []).length,
        };

        setStats(newStats);
        setQueue(queueRes.data || []);

        // Alerts
        const a: { type: 'warn' | 'ok'; text: string }[] = [];
        if (newStats.awaitingPayment > 0) a.push({ type: 'warn', text: `${newStats.awaitingPayment} замовлень очікують оплати на суму ${fmt(newStats.awaitingPaymentSum)} ₴` });
        if (newStats.needDesigner > 0) a.push({ type: 'warn', text: `${newStats.needDesigner} замовлень потребують роботи дизайнера` });
        if (newStats.today === 0) a.push({ type: 'warn', text: 'Сьогодні ще немає нових замовлень' });
        if (a.length === 0) a.push({ type: 'ok', text: 'Всі показники в нормі' });
        setAlerts(a);
        setLastUpdated(new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }));
        setLoading(false);
    };

    useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <RefreshCw size={32} color="#1e2d7d" className="animate-spin"/>
        </div>
    );

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1e2d7d', margin: 0 }}>Огляд</h1>
                    <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 3 }}>Оновлено о {lastUpdated} · автооновлення кожну хвилину</div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}>
                        <RefreshCw size={14}/> Оновити
                    </button>
                    <Link href="/admin/orders/new" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#1e2d7d', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                        <Plus size={14}/> Нове замовлення
                    </Link>
                </div>
            </div>

            {/* Alerts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {alerts.map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: a.type === 'warn' ? '#fffbeb' : '#f0fdf4', border: `1px solid ${a.type === 'warn' ? '#fde68a' : '#bbf7d0'}` }}>
                        {a.type === 'warn'
                            ? <AlertTriangle size={15} color="#d97706"/>
                            : <CheckCircle size={15} color="#16a34a"/>}
                        <span style={{ fontSize: 13, fontWeight: 600, color: a.type === 'warn' ? '#92400e' : '#166534' }}>{a.text}</span>
                    </div>
                ))}
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                <StatCard icon={<ShoppingBag size={20} color="#1e2d7d"/>} color="#1e2d7d"
                    label="Сьогодні замовлень" value={stats.today}
                    sub={stats.todayRevenue > 0 ? `${fmt(stats.todayRevenue)} ₴` : 'ще немає'}
                    href="/admin/orders"/>
                <StatCard icon={<CreditCard size={20} color="#d97706"/>} color="#d97706"
                    label="Очікують оплати" value={stats.awaitingPayment}
                    sub={`${fmt(stats.awaitingPaymentSum)} ₴`}
                    href="/admin/orders"/>
                <StatCard icon={<Clock size={20} color="#7c3aed"/>} color="#7c3aed"
                    label="В черзі (активні)" value={stats.inProgress}
                    sub="не завершені"
                    href="/admin/orders"/>
                <StatCard icon={<Palette size={20} color="#ec4899"/>} color="#ec4899"
                    label="Потребують дизайну" value={stats.needDesigner}
                    sub="з дизайнером"
                    href="/admin/orders"/>
            </div>

            {/* Quick actions */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 20px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Швидкі дії</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {[
                        { label: '+ Замовлення', href: '/admin/orders/new', color: '#1e2d7d' },
                        { label: '+ Товар', href: '/admin/products', color: '#059669' },
                        { label: 'Всі замовлення', href: '/admin/orders', color: '#374151' },
                        { label: 'Клієнти', href: '/admin/clients', color: '#374151' },
                        { label: 'Кабінет дизайнера', href: '/admin/designer', color: '#7c3aed' },
                        { label: 'Аналітика', href: '/admin/analytics', color: '#374151' },
                    ].map(a => (
                        <Link key={a.href} href={a.href} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${a.color === '#374151' ? '#e5e7eb' : a.color}`, background: a.color === '#374151' ? '#fff' : `${a.color}10`, color: a.color, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                            {a.label}
                        </Link>
                    ))}
                </div>
            </div>

            {/* Queue */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#1e2d7d' }}>Черга замовлень</div>
                    <Link href="/admin/orders" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        Всі <ArrowRight size={13}/>
                    </Link>
                </div>
                {queue.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                        <CheckCircle size={32} style={{ margin: '0 auto 10px', display: 'block', opacity: .4 }}/>
                        Черга порожня — всі замовлення виконані!
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc' }}>
                                {['Замовлення', 'Клієнт', 'Товари', 'Сума', 'Статус', 'Оплата', 'Час'].map(h => (
                                    <th key={h} style={{ padding: '9px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {queue.map((o, idx) => {
                                const st = STATUS_LABEL[o.order_status] || { label: o.order_status, color: '#374151', bg: '#f9fafb' };
                                const pay = PAY_LABEL[o.payment_status] || { label: o.payment_status, color: '#6b7280' };
                                return (
                                    <tr key={o.id}
                                        style={{ borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9', cursor: 'pointer' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                                        onClick={() => window.location.href = `/admin/orders/${o.id}`}>
                                        <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, color: '#1e2d7d', whiteSpace: 'nowrap' }}>
                                            #{o.order_number}
                                            {o.with_designer && <span title="Потрібен дизайнер" style={{ marginLeft: 6, fontSize: 11 }}>🎨</span>}
                                        </td>
                                        <td style={{ padding: '10px 14px', fontSize: 13, color: '#374151' }}>{o.customer_name}</td>
                                        <td style={{ padding: '10px 14px', fontSize: 13, color: '#6b7280' }}>{Array.isArray(o.items) ? o.items.length : 0} шт</td>
                                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>{fmt(Number(o.total || 0))} ₴</td>
                                        <td style={{ padding: '10px 14px' }}>
                                            <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>
                                                {st.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: pay.color, whiteSpace: 'nowrap' }}>
                                            {pay.label}
                                        </td>
                                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>{timeAgo(o.created_at)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Bottom row — new clients this week */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={18} color="#16a34a"/>
                </div>
                <div>
                    <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>Нових клієнтів за тиждень</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#111827' }}>{stats.newClients}</div>
                </div>
                <Link href="/admin/clients" style={{ marginLeft: 'auto', fontSize: 13, color: '#6b7280', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    CRM <ArrowRight size={13}/>
                </Link>
            </div>

        </div>
    );
}
