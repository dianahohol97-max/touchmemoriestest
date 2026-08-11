'use client';

export const dynamic = 'force-dynamic';
import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { formatDateTime, formatDateOnly } from '@/lib/date-utils';
import { Search, Download, User, Plus, MessageSquare, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Список замовлень (редизайн — Diana, 2026-08-06: «вкладка замовлення дуже не
 * комфортна»).
 *
 * Що було не так: таблиця на девʼять колонок шириною 1200px змушувала
 * скролити вбік навіть на ноутбуці, для мобільного існувала друга, окрема
 * розмітка (і вони вже почали розʼїжджатися), фільтр за датами мав стан, але
 * не мав полів, а підсумку «скільки я зараз бачу і на яку суму» не було
 * взагалі.
 *
 * Що стало: одна адаптивна верстка на картках для всіх екранів — без
 * горизонтального скролу і без другої копії розмітки. Кожна картка — два
 * рядки: перший про замовлення (номер, дата, статуси, теги, оплата, сума),
 * другий про роботу з ним (клієнт, товари, коментар, відповідальні). Над
 * списком — підсумок по відфільтрованому. Вся поведінка збережена: реалтайм,
 * швидкий коментар, призначення менеджера й дизайнера просто зі списку,
 * експорт, «Мої замовлення».
 */

const STATUS_TABS = [
    { id: 'all', label: 'Всі', color: '#64748b' },
    { id: 'new', label: 'Нові', color: '#263A99' },
    { id: 'confirmed', label: 'Підтверджені', color: '#14b8a6' },
    { id: 'in_production', label: 'У виробництві', color: '#f59e0b' },
    { id: 'shipped', label: 'Відправлені', color: '#a855f7' },
    { id: 'delivered', label: 'Виконані', color: '#22c55e' },
    { id: 'cancelled', label: 'Скасовані', color: '#ef4444' },
];

const DELIVERY_COLORS: Record<string, { bg: string; text: string }> = {
    'Відправлено': { bg: '#dbeafe', text: '#1e40af' },
    'У дорозі': { bg: '#ddd6fe', text: '#5b21b6' },
    'Прибув у місто': { bg: '#fef3c7', text: '#92400e' },
    'Прибув на відділення': { bg: '#fed7aa', text: '#9a3412' },
    'Вручено': { bg: '#dcfce7', text: '#15803d' },
    'Отримано': { bg: '#dcfce7', text: '#15803d' },
};

const chip: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
};

export default function OrdersPage() {
    const supabase = createClient();

    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    const [staff, setStaff] = useState<any[]>([]);
    const [managerFilter, setManagerFilter] = useState('all');
    const [designerFilter, setDesignerFilter] = useState('all');

    const [availableTags, setAvailableTags] = useState<any[]>([]);
    const [tagFilter, setTagFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState('all');

    // Замовлення, чиє меню тегів зараз відкрите (одне за раз).
    const [tagMenuOrderId, setTagMenuOrderId] = useState<string | null>(null);

    // Клік будь-де поза меню тегів закриває його.
    useEffect(() => {
        if (!tagMenuOrderId) return;
        const close = () => setTagMenuOrderId(null);
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [tagMenuOrderId]);

    // Швидкий коментар до замовлення — зберігається в orders.notes.
    const [commentOrder, setCommentOrder] = useState<any | null>(null);
    const [commentText, setCommentText] = useState('');
    const [commentSaving, setCommentSaving] = useState(false);

    const openCommentModal = (order: any) => {
        setCommentOrder(order);
        setCommentText(order.notes || '');
    };
    const saveComment = async () => {
        if (!commentOrder) return;
        setCommentSaving(true);
        try {
            const res = await fetch(`/api/admin/orders/${commentOrder.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: commentText }),
            });
            if (!res.ok) throw new Error(`API ${res.status}`);
            setOrders(prev => prev.map(o => o.id === commentOrder.id ? { ...o, notes: commentText } : o));
            toast.success('Коментар збережено');
            setCommentOrder(null);
        } catch (err) {
            console.error('Save comment failed:', err);
            toast.error('Не вдалося зберегти коментар');
        }
        setCommentSaving(false);
    };

    useEffect(() => {
        fetchOrders();
        fetchStaff();
        fetchTags();

        const channel = supabase
            .channel('orders-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchOrders();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchStaff = async () => {
        const res = await fetch('/api/admin/staff');
        if (res.ok) {
            const data = await res.json();
            setStaff(data.filter((s: any) => s.is_active));
        }
    };

    const fetchTags = async () => {
        const res = await fetch('/api/admin/tags');
        if (res.ok) setAvailableTags(await res.json());
    };

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/orders');
            if (res.status === 401 || res.status === 403) {
                setAuthError(true);
                setOrders([]);
                return;
            }
            if (!res.ok) throw new Error(`API ${res.status}`);
            const json = await res.json();
            setAuthError(false);
            if (json.orders) setOrders(json.orders);
        } catch (err) {
            console.error('Failed to fetch orders:', err);
            setOrders([]);
        } finally {
            setLoading(false);
        }
    };

    // Призначення зі списку. API перезаписує обидва поля, тому надсилаємо
    // поточне значення того, яке НЕ змінюємо; локальний стан оновлюємо одразу.
    const assignRole = async (order: any, role: 'manager' | 'designer', staffId: string) => {
        const payload = {
            manager_id: role === 'manager' ? (staffId || null) : (order.manager_id || null),
            designer_id: role === 'designer' ? (staffId || null) : (order.designer_id || null),
        };
        const picked = staff.find(s => s.id === staffId) || null;
        setOrders(prev => prev.map(o => o.id === order.id
            ? { ...o, [`${role}_id`]: staffId || null, [role]: picked }
            : o));
        try {
            const res = await fetch(`/api/admin/orders/${order.id}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(`API ${res.status}`);
            toast.success(role === 'manager' ? 'Менеджера призначено' : 'Дизайнера призначено');
        } catch (err) {
            console.error('Assign failed:', err);
            toast.error('Не вдалося призначити — оновлюю список');
            fetchOrders();
        }
    };

    /**
     * Повісити або зняти тег просто зі списку (Diana, 2026-08-06: «тегів не
     * видно у вкладці замовлення» — не видно їх було тому, що жодне замовлення
     * тегів не мало, а вішалися вони тільки зсередини замовлення). Оптимістично
     * оновлюємо локальний стан, при помилці перезавантажуємо список.
     */
    const toggleTag = async (order: any, tag: any) => {
        const assigned = order.order_tag_assignments?.some((a: any) => a.order_tags?.id === tag.id);
        setOrders(prev => prev.map(o => o.id === order.id
            ? {
                ...o,
                order_tag_assignments: assigned
                    ? (o.order_tag_assignments || []).filter((a: any) => a.order_tags?.id !== tag.id)
                    : [...(o.order_tag_assignments || []), { order_tags: tag }],
            }
            : o));
        try {
            const res = await fetch(`/api/admin/orders/${order.id}/tags`, {
                method: assigned ? 'DELETE' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag_id: tag.id }),
            });
            if (!res.ok) throw new Error(`API ${res.status}`);
        } catch (err) {
            console.error('Toggle tag failed:', err);
            toast.error('Не вдалося змінити тег — оновлюю список');
            fetchOrders();
        }
    };

    const filteredOrders = useMemo(() => orders.filter(order => {
        const matchesStatus = activeTab === 'all' || order.order_status === activeTab || (activeTab === 'new' && order.order_status === 'pending');
        const query = searchQuery.toLowerCase();
        const matchesSearch = !query ||
            order.order_number?.toLowerCase().includes(query) ||
            order.customer_name?.toLowerCase().includes(query) ||
            order.customer_email?.toLowerCase().includes(query) ||
            order.customer_phone?.includes(query) ||
            order.ttn?.includes(query);

        const orderDate = new Date(order.created_at).toISOString().split('T')[0];
        const matchesDate =
            (!dateRange.start || orderDate >= dateRange.start) &&
            (!dateRange.end || orderDate <= dateRange.end);

        const matchesManager = managerFilter === 'all' || order.manager_id === managerFilter;
        const matchesDesigner = designerFilter === 'all' || order.designer_id === designerFilter;
        const matchesTag = tagFilter === 'all' || order.order_tag_assignments?.some((a: any) => a.order_tags?.id === tagFilter);
        // Two intakes: the site's own orders and the Instagram ones mirrored
        // from KeyCRM. 'site' means "not the mirror" rather than literally
        // source='site', so hand-created admin orders stay in the site bucket.
        const matchesSource = sourceFilter === 'all'
            || (sourceFilter === 'keycrm' ? order.source === 'keycrm' : order.source !== 'keycrm');

        return matchesStatus && matchesSearch && matchesDate && matchesManager && matchesDesigner && matchesTag && matchesSource;
    }), [orders, activeTab, searchQuery, dateRange, managerFilter, designerFilter, tagFilter, sourceFilter]);

    // Підсумок по тому, що зараз на екрані — відповідь на «скільки я бачу».
    const summary = useMemo(() => {
        const total = filteredOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
        const unpaid = filteredOrders.filter(o => o.payment_status !== 'paid');
        const unpaidSum = unpaid.reduce((s, o) => s + (Number(o.total) || 0), 0);
        return { count: filteredOrders.length, total: Math.round(total), unpaid: unpaid.length, unpaidSum: Math.round(unpaidSum) };
    }, [filteredOrders]);

    const hasExtraFilters = searchQuery || dateRange.start || dateRange.end || tagFilter !== 'all' || managerFilter !== 'all' || designerFilter !== 'all' || sourceFilter !== 'all';

    const exportToExcel = () => {
        const headers = ['№ Замовлення', 'Дата', 'Клієнт', 'Телефон', 'Email', 'Статус', 'Сума', 'Товари', 'ТТН'];
        const csvRows = filteredOrders.map(o => [
            o.order_number,
            formatDateOnly(o.created_at),
            o.customer_name,
            o.customer_phone,
            o.customer_email,
            STATUS_TABS.find(t => t.id === o.order_status)?.label,
            o.total,
            o.items?.map((i: any) => i.name).join('; '),
            o.ttn || ''
        ].map(val => `"${val}"`).join(','));

        const csvContent = [headers.join(','), ...csvRows].join('\n');
        const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `orders_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('CSV-файл згенеровано');
    };

    const statusOf = (order: any) => STATUS_TABS.find(t => t.id === (order.order_status === 'pending' ? 'new' : order.order_status)) || STATUS_TABS[0];

    const emptyState = (text: React.ReactNode) => (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94a3b8', background: '#fff', border: '1px solid #eef2f7', borderRadius: 14 }}>{text}</div>
    );

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {/* Шапка */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 900, color: '#263A99', margin: 0 }}>Замовлення</h1>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Link href="/admin/orders/new" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', backgroundColor: '#263A99', color: 'white', borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                        <Plus size={17} /> Створити
                    </Link>
                    <button onClick={async () => {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                            const me = staff.find(s => s.email === user.email);
                            if (me) {
                                if (me.role === 'manager' || me.role === 'admin') setManagerFilter(me.id);
                                if (me.role === 'designer') setDesignerFilter(me.id);
                                toast.success('Показую лише ваші замовлення');
                            } else {
                                toast.error('Вашого облікового запису немає в списку команди');
                            }
                        }
                    }} style={ghostBtnStyle}>
                        <User size={16} /> Мої
                    </button>
                    <button onClick={exportToExcel} style={ghostBtnStyle}>
                        <Download size={16} /> Експорт
                    </button>
                </div>
            </div>

            {/* Статуси */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
                {STATUS_TABS.map(tab => {
                    const n = orders.filter(o => tab.id === 'all' || o.order_status === tab.id || (tab.id === 'new' && o.order_status === 'pending')).length;
                    const active = activeTab === tab.id;
                    return (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999,
                                border: `1.5px solid ${active ? tab.color : '#e5eaf2'}`,
                                background: active ? tab.color : '#fff',
                                color: active ? '#fff' : '#475569',
                                fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s',
                            }}>
                            {tab.label}
                            <span style={{
                                padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                                background: active ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                                color: active ? '#fff' : '#64748b',
                            }}>{n}</span>
                        </button>
                    );
                })}
            </div>

            {/* Фільтри одним рядком */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1.5px solid #e5eaf2', borderRadius: 10, padding: '0 12px', flex: '1 1 220px', minWidth: 200 }}>
                    <Search size={16} color="#94a3b8" />
                    <input
                        placeholder="№, імʼя, телефон, email, ТТН…"
                        style={{ border: 'none', padding: '10px 0', outline: 'none', width: '100%', fontSize: 13.5, background: 'transparent' }}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <input type="date" value={dateRange.start} title="Від дати"
                    onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))} style={miniSelectStyle} />
                <input type="date" value={dateRange.end} title="До дати"
                    onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))} style={miniSelectStyle} />
                <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={miniSelectStyle}>
                    <option value="all">Джерело</option>
                    <option value="site">Сайт</option>
                    <option value="keycrm">Instagram (CRM)</option>
                </select>
                <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} style={miniSelectStyle}>
                    <option value="all">Теги</option>
                    {availableTags.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
                </select>
                <select value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)} style={miniSelectStyle}>
                    <option value="all">Менеджер</option>
                    {staff.filter(s => s.role === 'manager' || s.role === 'admin').map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
                <select value={designerFilter} onChange={(e) => setDesignerFilter(e.target.value)} style={miniSelectStyle}>
                    <option value="all">Дизайнер</option>
                    {staff.filter(s => s.role === 'designer' || s.role === 'admin').map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
                {hasExtraFilters && (
                    <button onClick={() => { setSearchQuery(''); setDateRange({ start: '', end: '' }); setTagFilter('all'); setManagerFilter('all'); setDesignerFilter('all'); setSourceFilter('all'); }}
                        style={{ ...ghostBtnStyle, padding: '9px 12px', color: '#b91c1c', borderColor: '#fecaca' }}>
                        <X size={14} /> Скинути
                    </button>
                )}
            </div>

            {/* Підсумок по відфільтрованому */}
            {!loading && !authError && (
                <div style={{ fontSize: 13, color: '#64748b', margin: '0 2px 14px' }}>
                    Показано <b style={{ color: '#0f172a' }}>{summary.count}</b> замовлень на <b style={{ color: '#0f172a' }}>{summary.total.toLocaleString('uk-UA')} ₴</b>
                    {summary.unpaid > 0 && <> · з них не оплачено {summary.unpaid} на {summary.unpaidSum.toLocaleString('uk-UA')} ₴</>}
                </div>
            )}

            {/* Список */}
            {loading ? emptyState('Завантаження…') : authError ? emptyState(
                <>Сесія завершилася. <a href="/admin/login" style={{ color: '#1e2d7d', fontWeight: 700 }}>Увійдіть знову</a>, щоб побачити замовлення.</>
            ) : filteredOrders.length === 0 ? emptyState(
                hasExtraFilters || activeTab !== 'all' ? 'Під ці фільтри нічого не підпадає — спробуйте «Скинути».' : 'Замовлень поки немає.'
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredOrders.map(order => {
                        const st = statusOf(order);
                        const delivery = order.delivery_status && order.tracking_number ? DELIVERY_COLORS[order.delivery_status] || { bg: '#f1f5f9', text: '#64748b' } : null;
                        const isPrintWarning = (order.notes || '').includes('файли для друку не завантажились');
                        const itemsLabel = Array.isArray(order.items) && order.items.length > 0
                            ? (order.items.length === 1 ? order.items[0].name : `${order.items[0].name} +${order.items.length - 1}`)
                            : 'Без товарів';
                        return (
                            <div key={order.id}
                                onClick={() => window.location.href = `/admin/orders/${order.id}`}
                                style={{
                                    background: '#fff', border: `1px solid ${isPrintWarning ? '#fca5a5' : '#e8edf5'}`, borderRadius: 14,
                                    padding: '12px 16px', cursor: 'pointer', transition: 'box-shadow .15s, border-color .15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 18px rgba(30,45,125,0.08)'; }}
                                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                {/* Рядок 1: що це за замовлення і його стан */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 800, color: '#263A99', fontSize: 15 }}>{order.order_number}</span>
                                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{formatDateTime(order.created_at)}</span>
                                    <span style={{ ...chip, background: `${st.color}14`, color: st.color }}>{st.label}</span>
                                    {delivery && (
                                        <span style={{ ...chip, background: delivery.bg, color: delivery.text }}>{order.delivery_status}</span>
                                    )}
                                    {order.order_tag_assignments?.map((a: any) => a.order_tags ? (
                                        <span key={a.order_tags.id}
                                            title="Прибрати тег"
                                            onClick={e => { e.stopPropagation(); toggleTag(order, a.order_tags); }}
                                            style={{ ...chip, background: `${a.order_tags.color || '#64748b'}14`, color: a.order_tags.color || '#475569', cursor: 'pointer' }}>
                                            {a.order_tags.icon && <span>{a.order_tags.icon}</span>}{a.order_tags.name}
                                        </span>
                                    ) : null)}
                                    {availableTags.length > 0 && (
                                        <span style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => setTagMenuOrderId(v => v === order.id ? null : order.id)}
                                                title="Додати тег"
                                                style={{ ...chip, background: '#f1f5f9', color: '#64748b', border: '1px dashed #cbd5e1', cursor: 'pointer' }}>
                                                + тег
                                            </button>
                                            {tagMenuOrderId === order.id && (
                                                <span style={{
                                                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
                                                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                                                    boxShadow: '0 8px 24px rgba(15,23,42,0.12)', padding: 8,
                                                    display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180,
                                                }}>
                                                    {availableTags.map(t => {
                                                        const on = order.order_tag_assignments?.some((a: any) => a.order_tags?.id === t.id);
                                                        return (
                                                            <button key={t.id}
                                                                onClick={() => toggleTag(order, t)}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: 7, padding: '6px 9px',
                                                                    borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left',
                                                                    background: on ? `${t.color || '#64748b'}14` : 'transparent',
                                                                    color: '#334155', fontSize: 12.5, fontWeight: 600,
                                                                }}>
                                                                <span style={{ width: 8, height: 8, borderRadius: 999, background: t.color || '#94a3b8', flexShrink: 0 }} />
                                                                {t.icon && <span>{t.icon}</span>}
                                                                <span style={{ flex: 1 }}>{t.name}</span>
                                                                {on && <span style={{ color: t.color || '#16a34a', fontWeight: 800 }}>✓</span>}
                                                            </button>
                                                        );
                                                    })}
                                                </span>
                                            )}
                                        </span>
                                    )}
                                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                                        {/* For mirrored CRM orders prepaid_amount is money actually
                                            received (the mirror writes the CRM's payments total), so a
                                            partial payment shows as «Передоплата». Site orders keep the
                                            two-state badge: their prepaid_amount is the PLANNED split,
                                            not a receipt. */}
                                        {(() => {
                                            const isPaid = order.payment_status === 'paid';
                                            const prepaid = Number(order.prepaid_amount || 0);
                                            const isPartial = !isPaid && order.source === 'keycrm' && prepaid > 0;
                                            return (
                                                <span style={{
                                                    ...chip,
                                                    background: isPaid ? '#f0fdf4' : isPartial ? '#eff6ff' : '#fffbeb',
                                                    color: isPaid ? '#16a34a' : isPartial ? '#1d4ed8' : '#b45309',
                                                }}>
                                                    {isPaid ? 'Оплачено' : isPartial ? `Передоплата ${prepaid.toLocaleString('uk-UA')} ₴` : 'Очікує оплати'}
                                                </span>
                                            );
                                        })()}
                                        <span style={{ fontWeight: 900, fontSize: 16, color: '#0f172a', whiteSpace: 'nowrap' }}>{Number(order.total || 0).toLocaleString('uk-UA')} ₴</span>
                                        <ChevronRight size={17} color="#cbd5e1" />
                                    </span>
                                </div>

                                {/* Рядок 2: клієнт, товари, коментар, відповідальні */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 9 }}>
                                    <span style={{ fontSize: 13, minWidth: 150 }}>
                                        <b>{order.customer_name || order.customer_email || order.customer_telegram || 'Без імені'}</b>
                                        {order.customer_phone && <span style={{ color: '#64748b' }}> · {order.customer_phone}</span>}
                                    </span>
                                    <span style={{ fontSize: 12.5, color: '#64748b', flex: '1 1 140px', minWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {itemsLabel}
                                    </span>

                                    <button onClick={e => { e.stopPropagation(); openCommentModal(order); }}
                                        title={order.notes ? order.notes : 'Додати коментар'}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: 220,
                                            background: isPrintWarning ? '#fef2f2' : 'transparent',
                                            border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 8,
                                            color: isPrintWarning ? '#b91c1c' : (order.notes ? '#475569' : '#cbd5e1'),
                                            fontSize: 12, fontWeight: isPrintWarning ? 700 : 500,
                                        }}>
                                        <MessageSquare size={13} style={{ flexShrink: 0 }} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {order.notes || 'Коментар'}
                                        </span>
                                    </button>

                                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                        <select
                                            value={order.manager_id || ''}
                                            onChange={e => assignRole(order, 'manager', e.target.value)}
                                            title="Менеджер"
                                            style={{ ...assignSelectStyle, color: order.manager ? '#334155' : '#94a3b8' }}>
                                            <option value="">Менеджер: —</option>
                                            {staff.filter(s => s.role === 'manager' || s.role === 'admin').map(s => (
                                                <option key={s.id} value={s.id}>М: {s.name}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={order.designer_id || ''}
                                            onChange={e => assignRole(order, 'designer', e.target.value)}
                                            title="Дизайнер"
                                            style={{ ...assignSelectStyle, color: order.designer ? '#334155' : '#94a3b8' }}>
                                            <option value="">Дизайнер: —</option>
                                            {staff.filter(s => s.role === 'designer' || s.role === 'admin').map(s => (
                                                <option key={s.id} value={s.id}>Д: {s.name}</option>
                                            ))}
                                        </select>
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Швидкий коментар */}
            {commentOrder && (
                <div onClick={() => !commentSaving && setCommentOrder(null)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
                    <div onClick={e => e.stopPropagation()}
                        style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 460 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e2d7d', margin: 0 }}>Коментар до замовлення</h3>
                            <button onClick={() => setCommentOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 22, lineHeight: 1 }}>×</button>
                        </div>
                        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>{commentOrder.order_number}</div>
                        <textarea
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            placeholder="Внутрішній коментар для команди…"
                            rows={5}
                            autoFocus
                            style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                            <button onClick={() => setCommentOrder(null)} disabled={commentSaving}
                                style={{ padding: '10px 18px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, fontSize: 14, color: '#475569', cursor: 'pointer' }}>
                                Скасувати
                            </button>
                            <button onClick={saveComment} disabled={commentSaving}
                                style={{ padding: '10px 18px', background: '#263A99', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, color: '#fff', cursor: commentSaving ? 'not-allowed' : 'pointer', opacity: commentSaving ? 0.7 : 1 }}>
                                {commentSaving ? 'Збереження…' : 'Зберегти'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const ghostBtnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 7, padding: '10px 14px',
    backgroundColor: '#fff', border: '1.5px solid #e5eaf2', color: '#475569',
    borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
};
const miniSelectStyle: React.CSSProperties = {
    border: '1.5px solid #e5eaf2', borderRadius: 10, padding: '9px 10px',
    fontSize: 13, color: '#475569', outline: 'none', backgroundColor: '#fff', fontWeight: 600, cursor: 'pointer',
};
const assignSelectStyle: React.CSSProperties = {
    border: '1px solid #e5eaf2', borderRadius: 8, padding: '5px 6px',
    fontSize: 12, fontWeight: 600, background: '#f8fafc', cursor: 'pointer', maxWidth: 150,
};
