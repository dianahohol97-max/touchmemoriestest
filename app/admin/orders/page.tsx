'use client';

export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { formatDateTime, formatDateOnly } from '@/lib/date-utils';
import {
    Search,
    Filter,
    Download,
    MoreVertical,
    Eye,
    Clock,
    CheckCircle2,
    Package,
    Truck,
    CheckCheck,
    XCircle,
    User,
    Phone,
    Calendar,
    FileText,
    MessageSquare,
    Plus
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_LABEL_MAP: Record<string, string> = {
    pending: 'Нові', new: 'Нові', confirmed: 'Підтверджені',
    in_production: 'У виробництві', shipped: 'Відправлені',
    delivered: 'Виконані', cancelled: 'Скасовані',
};

const STATUS_TABS = [
    { id: 'all', label: 'Всі', color: '#64748b' },
    { id: 'new', label: 'Нові', color: '#263A99' },
    { id: 'confirmed', label: 'Підтверджені', color: '#14b8a6' },
    { id: 'in_production', label: 'У виробництві', color: '#f59e0b' },
    { id: 'shipped', label: 'Відправлені', color: '#a855f7' },
    { id: 'delivered', label: 'Виконані', color: '#22c55e' },
    { id: 'cancelled', label: 'Скасовані', color: '#ef4444' },
];

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

    // Quick order-comment editor (opened from the list, saved to orders.notes)
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
            // reflect locally
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

        // Real-time subscription
        const channel = supabase
            .channel('orders-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchOrders();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
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

    // Assign manager/designer straight from the list. The assign API rewrites
    // both fields, so we send the current value for the field we're NOT
    // changing to avoid wiping it. We optimistically patch local state so the
    // row updates instantly without a full refetch.
    const assignRole = async (order: any, role: 'manager' | 'designer', staffId: string) => {
        const payload = {
            manager_id: role === 'manager' ? (staffId || null) : (order.manager_id || null),
            designer_id: role === 'designer' ? (staffId || null) : (order.designer_id || null),
        };
        // Optimistic update
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

    const getDeliveryStatusColor = (status: string) => {
        const statusColors: Record<string, { bg: string, text: string }> = {
            'Відправлено': { bg: '#dbeafe', text: '#1e40af' },
            'У дорозі': { bg: '#ddd6fe', text: '#5b21b6' },
            'Прибув у місто': { bg: '#fef3c7', text: '#92400e' },
            'Прибув на відділення': { bg: '#fed7aa', text: '#9a3412' },
            'Вручено': { bg: '#dcfce7', text: '#15803d' },
            'Отримано': { bg: '#dcfce7', text: '#15803d' },
        };
        return statusColors[status] || { bg: '#f1f5f9', text: '#64748b' };
    };

    const getStatusStyle = (status: string) => {
        const tab = STATUS_TABS.find(t => t.id === status) || STATUS_TABS[0];
        return {
            backgroundColor: `${tab.color}15`,
            color: tab.color,
            border: `1px solid ${tab.color}30`
        };
    };

    const filteredOrders = orders.filter(order => {
        const matchesStatus = activeTab === 'all' || order.order_status === activeTab || (activeTab === 'new' && order.order_status === 'pending');
        const query = searchQuery.toLowerCase();
        const matchesSearch =
            order.order_number?.toLowerCase().includes(query) ||
            order.customer_name?.toLowerCase().includes(query) ||
            order.customer_phone?.includes(query) ||
            order.ttn?.includes(query);

        const orderDate = new Date(order.created_at).toISOString().split('T')[0];
        const matchesDate =
            (!dateRange.start || orderDate >= dateRange.start) &&
            (!dateRange.end || orderDate <= dateRange.end);

        const matchesManager = managerFilter === 'all' || order.manager_id === managerFilter;
        const matchesDesigner = designerFilter === 'all' || order.designer_id === designerFilter;
        const matchesTag = tagFilter === 'all' || order.order_tag_assignments?.some((a: any) => a.order_tags?.id === tagFilter);

        return matchesStatus && matchesSearch && matchesDate && matchesManager && matchesDesigner && matchesTag;
    });

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
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `orders_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('CSV-файл згенеровано');
    };

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 900, color: '#263A99', marginBottom: '8px' }}>Замовлення</h1>
                    <p style={{ color: '#64748b' }}>Повний список транзакцій та статусів у реальному часі.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Link href="/admin/orders/new" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: "3px", fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}>
                        <Plus size={20} /> Створити замовлення
                    </Link>
                    <button onClick={async () => {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                            // Find matching staff by email
                            const me = staff.find(s => s.email === user.email);
                            if (me) {
                                if (me.role === 'manager' || me.role === 'admin') setManagerFilter(me.id);
                                if (me.role === 'designer') setDesignerFilter(me.id);
                                toast.success('Фільтр "Мої замовлення" застосовано');
                            } else {
                                toast.error('Вашого облікового запису немає в спиsku Команди');
                            }
                        }
                    }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: '#f1f5f9', border: 'none', color: '#475569', borderRadius: "3px", fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}>
                        <User size={20} /> Мої замовлення
                    </button>
                    <button onClick={exportToExcel} style={exportBtnStyle}>
                        <Download size={20} />
                        Експорт (Excel)
                    </button>
                </div>
            </div>

            {/* Status Tabs */}
            <div style={tabsWrapperStyle}>
                {STATUS_TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            ...tabButtonStyle,
                            color: activeTab === tab.id ? 'white' : '#64748b',
                            backgroundColor: activeTab === tab.id ? tab.color : 'transparent',
                            borderColor: activeTab === tab.id ? tab.color : 'transparent',
                        }}
                    >
                        {tab.label}
                        <span style={countBadgeStyle}>
                            {orders.filter(o => tab.id === 'all' || o.order_status === tab.id || (tab.id === 'new' && o.order_status === 'pending')).length}
                        </span>
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div style={filtersGridStyle}>
                <div style={searchWrapperStyle}>
                    <Search size={18} color="#94a3b8" />
                    <input
                        placeholder="Пошук за №, ім'ям, телефоном..."
                        style={searchInputStyle}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        value={tagFilter}
                        onChange={(e) => setTagFilter(e.target.value)}
                        style={selectInputStyle}
                    >
                        <option value="all">Усі Теги</option>
                        {availableTags.map(t => (
                            <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                        ))}
                    </select>

                    <select
                        value={managerFilter}
                        onChange={(e) => setManagerFilter(e.target.value)}
                        style={selectInputStyle}
                    >
                        <option value="all">Усі Менеджери</option>
                        {staff.filter(s => s.role === 'manager' || s.role === 'admin').map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>

                    <select
                        value={designerFilter}
                        onChange={(e) => setDesignerFilter(e.target.value)}
                        style={selectInputStyle}
                    >
                        <option value="all">Усі Дизайнери</option>
                        {staff.filter(s => s.role === 'designer' || s.role === 'admin').map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div style={tableCardStyle}>
                <table style={{ width: '100%', minWidth: 1200, borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1.5px solid #f1f5f9' }}>
                            <th style={thStyle}>№ Замовлення</th>
                            <th style={thStyle}>Теги</th>
                            <th style={thStyle}>Клієнт</th>
                            <th style={thStyle}>Коментар</th>
                            <th style={thStyle}>Менеджер</th>
                            <th style={thStyle}>Відповідальні</th>
                            <th style={thStyle}>Товари</th>
                            <th style={thStyle}>Оплата</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Дії</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '100px', color: '#94a3b8' }}>Завантаження...</td></tr>
                        ) : authError ? (
                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '100px', color: '#dc2626' }}>
                                Сесія завершилася. <a href="/admin/login" style={{ color: '#1e2d7d', fontWeight: 700, textDecoration: 'underline' }}>Увійдіть знову</a>, щоб побачити замовлення.
                            </td></tr>
                        ) : filteredOrders.length === 0 ? (
                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '100px', color: '#94a3b8' }}>Замовлень не знайдено</td></tr>
                        ) : filteredOrders.map(order => (
                            <tr key={order.id}
                                style={{ ...trStyle, cursor: 'pointer' }}
                                onClick={() => window.location.href = `/admin/orders/${order.id}`}>
                                <td style={tdStyle}>
                                    <div style={{ fontWeight: 800, color: '#263A99' }}>{order.order_number}</div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>{formatDateTime(order.created_at)}</div>
                                    <div style={{ ...statusBadgeStyle, ...getStatusStyle(order.order_status) }}>
                                        {STATUS_TABS.find(t => t.id === order.order_status)?.label}
                                    </div>
                                    {order.delivery_status && order.tracking_number && (
                                        <div style={{ ...statusBadgeStyle, backgroundColor: getDeliveryStatusColor(order.delivery_status).bg, color: getDeliveryStatusColor(order.delivery_status).text, border: 'none', marginTop: '6px', fontSize: '10px' }}>
                                             {order.delivery_status}
                                        </div>
                                    )}
                                </td>
                                {/* Tags — names + icons */}
                                <td style={{ ...tdStyle, maxWidth: 160 }}>
                                    {order.order_tag_assignments?.length > 0 ? (
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                            {order.order_tag_assignments.map((assignment: any) => {
                                                const tag = assignment.order_tags;
                                                if (!tag) return null;
                                                return (
                                                    <span key={tag.id} title={tag.name}
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 12, backgroundColor: `${tag.color}15`, border: `1px solid ${tag.color}40`, fontSize: 11, fontWeight: 700, color: tag.color || '#475569', whiteSpace: 'nowrap' }}>
                                                        {tag.icon && <span>{tag.icon}</span>}{tag.name}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <span style={{ fontSize: 12, color: '#cbd5e1' }}>—</span>
                                    )}
                                </td>
                                <td style={tdStyle}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={avatarStyle}>{order.customer_name?.[0]}</div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {order.customer_name}

                                            </div>
                                            <div style={{ fontSize: '12px', color: '#64748b' }}>{order.customer_phone}</div>
                                        </div>
                                    </div>
                                </td>
                                {/* Comment — inline preview + click to edit */}
                                <td style={{ ...tdStyle, maxWidth: 200 }} onClick={e => e.stopPropagation()}>
                                    {(() => {
                                        const isPrintWarning = (order.notes || '').includes('файли для друку не завантажились');
                                        return (
                                    <button onClick={() => openCommentModal(order)}
                                        title={order.notes ? 'Редагувати коментар' : 'Додати коментар'}
                                        style={{ width: '100%', textAlign: 'left', background: isPrintWarning ? '#fef2f2' : (order.notes ? '#f8fafc' : 'transparent'), border: isPrintWarning ? '1px solid #fca5a5' : (order.notes ? '1px solid #e2e8f0' : '1px dashed #e2e8f0'), borderRadius: 8, padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                        <MessageSquare size={13} style={{ flexShrink: 0, marginTop: 2, color: isPrintWarning ? '#dc2626' : (order.notes ? '#263A99' : '#cbd5e1') }} />
                                        <span style={{ fontSize: 12, color: isPrintWarning ? '#b91c1c' : (order.notes ? '#475569' : '#cbd5e1'), fontWeight: isPrintWarning ? 600 : 400, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {order.notes || 'Додати коментар'}
                                        </span>
                                    </button>
                                        );
                                    })()}
                                </td>
                                {/* Manager — inline assign */}
                                <td style={{ ...tdStyle, width: '150px' }} onClick={e => e.stopPropagation()}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                                        <div style={{ width: '24px', height: '24px', borderRadius: "3px", backgroundColor: order.manager?.color || '#f1f5f9', color: order.manager ? 'white' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '10px', flexShrink: 0 }}>
                                            {order.manager?.initials || <User size={12} />}
                                        </div>
                                        <select
                                            value={order.manager_id || ''}
                                            onChange={e => assignRole(order, 'manager', e.target.value)}
                                            style={{ flex: 1, minWidth: 0, border: '1px solid transparent', borderRadius: 6, padding: '3px 4px', fontSize: 12, fontWeight: 600, color: order.manager ? '#475569' : '#94a3b8', background: 'transparent', cursor: 'pointer' }}
                                            onMouseEnter={e => (e.currentTarget.style.border = '1px solid #e2e8f0')}
                                            onMouseLeave={e => (e.currentTarget.style.border = '1px solid transparent')}
                                        >
                                            <option value="">Не призначено</option>
                                            {staff.filter(s => s.role === 'manager' || s.role === 'admin').map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </td>
                                {/* Designer / responsible — inline assign */}
                                <td style={{ ...tdStyle, width: '150px' }} onClick={e => e.stopPropagation()}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                                        <div style={{ width: '24px', height: '24px', borderRadius: "3px", backgroundColor: order.designer?.color || '#f1f5f9', color: order.designer ? 'white' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '10px', flexShrink: 0 }}>
                                            {order.designer?.initials || <User size={12} />}
                                        </div>
                                        <select
                                            value={order.designer_id || ''}
                                            onChange={e => assignRole(order, 'designer', e.target.value)}
                                            style={{ flex: 1, minWidth: 0, border: '1px solid transparent', borderRadius: 6, padding: '3px 4px', fontSize: 12, fontWeight: 600, color: order.designer ? '#475569' : '#94a3b8', background: 'transparent', cursor: 'pointer' }}
                                            onMouseEnter={e => (e.currentTarget.style.border = '1px solid #e2e8f0')}
                                            onMouseLeave={e => (e.currentTarget.style.border = '1px solid transparent')}
                                        >
                                            <option value="">Не призначено</option>
                                            {staff.filter(s => s.role === 'designer' || s.role === 'admin').map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </td>
                                <td style={tdStyle}>
                                    <div style={{ fontSize: '13px', color: '#475569', fontWeight: 700, marginBottom: '4px' }}>
                                        {order.total} ₴
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                                        {Array.isArray(order.items) ? (
                                            order.items.length === 1 ? order.items[0].name : `${order.items[0].name} +${order.items.length - 1}`
                                        ) : 'Замовлення без товарів'}
                                    </div>
                                </td>
                                <td style={tdStyle}>
                                    <div style={{
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        color: order.payment_status === 'paid' ? '#16a34a' : '#f59e0b',
                                        backgroundColor: order.payment_status === 'paid' ? '#f0fdf4' : '#fffbeb',
                                        padding: '4px 8px',
                                        borderRadius: "3px",
                                        display: 'inline-block'
                                    }}>
                                        {order.payment_status === 'paid' ? 'ОПЛАЧЕНО' : 'ОЧІКУЄ'}
                                    </div>
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right' }}>
                                    <Link
                                        href={`/admin/orders/${order.id}`}
                                        onClick={e => e.stopPropagation()}
                                        style={{ ...actionBtnStyle, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#1e2d7d', color: '#fff', borderRadius: 6, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                                        <Eye size={15} /> Відкрити
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Quick comment modal */}
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
        </div >
    );
}

const exportBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: 'white', border: '1.5px solid #e2e8f0', color: '#475569', borderRadius: "3px", fontWeight: 700, fontSize: '15px', cursor: 'pointer' };
const tabsWrapperStyle = { display: 'flex', gap: '12px', marginBottom: '32px', overflowX: 'auto' as any, paddingBottom: '8px' };
const tabButtonStyle = { padding: '10px 20px', borderRadius: "3px", border: '1.5px solid #e2e8f0', fontSize: '14px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' as any };
const countBadgeStyle = { padding: '2px 8px', borderRadius: "3px", backgroundColor: 'rgba(255,255,255,0.2)', fontSize: '10px', fontWeight: 900 };
const filtersGridStyle = { display: 'grid', gridTemplateColumns: '1fr auto', gap: '24px', marginBottom: '32px', alignItems: 'center' };
const searchWrapperStyle = { position: 'relative' as any, display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'white', border: '1.5px solid #e2e8f0', borderRadius: "3px", padding: '0 16px', flex: 1 };
const searchInputStyle = { border: 'none', padding: '12px 0', outline: 'none', width: '100%', fontSize: '14px', fontWeight: 500 };
const dateInputStyle = { border: '1.5px solid #e2e8f0', borderRadius: "3px", padding: '8px 12px', fontSize: '13px', color: '#475569', outline: 'none', backgroundColor: 'white' };
const selectInputStyle = { border: '1.5px solid #e2e8f0', borderRadius: "3px", padding: '10px 12px', fontSize: '13px', color: '#475569', outline: 'none', backgroundColor: 'white', fontWeight: 600, cursor: 'pointer' };
const tableCardStyle = { backgroundColor: 'white', borderRadius: "3px", boxShadow: '0 4px 25px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9', overflowX: 'auto' as any, overflowY: 'visible' as any };
const thStyle = { textAlign: 'left' as any, padding: '20px', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' as any, letterSpacing: '0.05em', fontWeight: 800 };
const tdStyle = { padding: '20px', verticalAlign: 'middle' };
const trStyle = { borderBottom: '1px solid #f8fafc', transition: 'background 0.1s' };
const avatarStyle = { width: '32px', height: '32px', borderRadius: "3px", backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 900, color: '#64748b' };
const statusBadgeStyle = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: "3px", fontSize: '11px', fontWeight: 800 };
const actionBtnStyle = { width: '36px', height: '36px', borderRadius: "3px", backgroundColor: '#f8fafc', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', transition: 'all 0.2s', textDecoration: 'none' };
