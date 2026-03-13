'use client';
import { useState, useEffect, use } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    User,
    Phone,
    Mail,
    MapPin,
    CreditCard,
    FileText,
    Truck,
    Receipt,
    Check,
    ChevronRight,
    ExternalLink,
    Clock,
    Save,
    Plus,
    History,
    Loader2,
    Send,
    X,
    MessageSquare,
    CopyPlus,
    Tag,
    Printer,
    CheckCircle,
    Info,
    Calendar,
    Settings,
    Download,
    Trash2,
    Edit2,
    AlertCircle,
    Package,
    ShieldCheck,
    DollarSign
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_OPTS = [
    { id: 'new', label: 'Нове', color: '#3b82f6', bg: '#eff6ff' },
    { id: 'confirmed', label: 'Підтверджено', color: '#14b8a6', bg: '#f0fdfa' },
    { id: 'in_production', label: 'У виробництві', color: '#f59e0b', bg: '#fffbeb' },
    { id: 'shipped', label: 'Відправлено', color: '#a855f7', bg: '#f5f3ff' },
    { id: 'delivered', label: 'Виконано', color: '#22c55e', bg: '#f0fdf4' },
    { id: 'cancelled', label: 'Скасовано', color: '#ef4444', bg: '#fef2f2' },
];

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const router = useRouter();

    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notes, setNotes] = useState('');
    const [history, setHistory] = useState<any[]>([]);

    // Tags
    const [availableTags, setAvailableTags] = useState<any[]>([]);
    const [showTagDropdown, setShowTagDropdown] = useState(false);

    // Staff
    const [staff, setStaff] = useState<any[]>([]);
    const [updatingAssignment, setUpdatingAssignment] = useState(false);

    // Modal forms
    const [showReplyModal, setShowReplyModal] = useState(false);
    const [replySubject, setReplySubject] = useState('');
    const [replyBody, setReplyBody] = useState('');
    const [sendingReply, setSendingReply] = useState(false);
    const [duplicating, setDuplicating] = useState(false);

    const [isEditingTTN, setIsEditingTTN] = useState(false);
    const [ttnValue, setTtnValue] = useState('');

    // Print
    const [printProfiles, setPrintProfiles] = useState<any[]>([]);
    const [selectedPrintProfile, setSelectedPrintProfile] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [genProgress, setGenProgress] = useState(0);

    // Templates
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState('');

    // Finance & Delivery Accounts
    const [bankAccounts, setBankAccounts] = useState<any[]>([]);
    const [npAccounts, setNpAccounts] = useState<any[]>([]);

    useEffect(() => {
        fetchOrder();
        fetchStaff();
        fetchTags();
        fetchPrintProfiles();
        fetchTemplates();
        fetchIntegrations();
    }, [id]);

    const fetchIntegrations = async () => {
        const [banksRes, npRes] = await Promise.all([
            supabase.from('bank_accounts').select('*').eq('is_active', true),
            supabase.from('np_accounts').select('*').eq('is_active', true)
        ]);
        if (banksRes.data) setBankAccounts(banksRes.data);
        if (npRes.data) setNpAccounts(npRes.data);
    };

    const fetchTags = async () => {
        const { data } = await supabase.from('order_tags').select('*');
        if (data) setAvailableTags(data);
    };

    const fetchStaff = async () => {
        const { data } = await supabase.from('staff').select('*').eq('is_active', true);
        if (data) setStaff(data);
    };

    const fetchPrintProfiles = async () => {
        const { data } = await supabase.from('print_profiles').select('*');
        if (data) setPrintProfiles(data);
    };

    const fetchTemplates = async () => {
        const { data } = await supabase.from('reply_templates').select('*');
        if (data) setTemplates(data);
    };

    const fetchOrder = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *, 
                customers(name, email, phone, notes), 
                manager:staff!orders_manager_id_fkey(id, name, initials, color),
                designer:staff!orders_designer_id_fkey(id, name, initials, color),
                order_tag_assignments(order_tags(*))
            `)
            .eq('id', id)
            .single();

        if (data) {
            setOrder(data);
            setNotes(data.notes || '');
            setTtnValue(data.ttn || '');
            if (data.print_profile_id) setSelectedPrintProfile(data.print_profile_id);
        }

        const { data: historyData } = await supabase
            .from('order_history')
            .select('*')
            .eq('order_id', id)
            .order('created_at', { ascending: false });

        if (historyData) setHistory(historyData);
        setLoading(false);
    };

    const updateStatus = async (newStatus: string) => {
        const loadingToast = toast.loading('Оновлення статусу...');
        try {
            const { error } = await supabase
                .from('orders')
                .update({
                    order_status: newStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;

            await supabase.from('order_history').insert({
                order_id: id,
                action: `Зміна статусу: ${order.order_status} → ${newStatus}`,
                details: { old: order.order_status, new: newStatus }
            });

            toast.dismiss(loadingToast);
            toast.success('Статус оновлено');
            fetchOrder();
        } catch (e: any) {
            toast.dismiss(loadingToast);
            toast.error(e.message || 'Помилка');
        }
    };

    const saveTTN = async () => {
        setSaving(true);
        const { error } = await supabase
            .from('orders')
            .update({ ttn: ttnValue })
            .eq('id', id);

        if (!error) {
            toast.success('ТТН збережено');
            setIsEditingTTN(false);
            fetchOrder();
        } else {
            toast.error('Помилка збереження');
        }
        setSaving(false);
    };

    const handleAssign = async (role: 'manager_id' | 'designer_id', staffId: string) => {
        setUpdatingAssignment(true);
        try {
            const { error } = await supabase
                .from('orders')
                .update({ [role]: staffId || null })
                .eq('id', id);

            if (error) throw error;
            toast.success('Відповідального призначено');
            fetchOrder();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setUpdatingAssignment(false);
        }
    };

    const handleAddTag = async (tagId: string) => {
        setShowTagDropdown(false);
        const { error } = await supabase
            .from('order_tag_assignments')
            .insert({ order_id: id, tag_id: tagId });

        if (!error) {
            toast.success('Тег додано');
            fetchOrder();
        } else toast.error('Помилка');
    };

    const handleRemoveTag = async (tagId: string) => {
        const { error } = await supabase
            .from('order_tag_assignments')
            .delete()
            .eq('order_id', id)
            .eq('tag_id', tagId);

        if (!error) {
            toast.success('Тег видалено');
            fetchOrder();
        }
    };

    const updateItemComment = async (index: number, comment: string) => {
        const newItems = [...order.items];
        newItems[index] = { ...newItems[index], comment };

        const { error } = await supabase
            .from('orders')
            .update({ items: newItems })
            .eq('id', id);

        if (!error) {
            setOrder({ ...order, items: newItems });
            toast.success('Коментар збережено');
        }
    };

    const saveNotes = async () => {
        setSaving(true);
        const { error } = await supabase
            .from('orders')
            .update({ notes: notes })
            .eq('id', id);

        if (!error) toast.success('Нотатки збережено');
        setSaving(false);
    };

    const updateOrderAccount = async (field: 'bank_account_id' | 'np_account_id', value: string) => {
        const { error } = await supabase
            .from('orders')
            .update({ [field]: value || null })
            .eq('id', id);

        if (!error) {
            setOrder({ ...order, [field]: value });
            toast.success('Дані оновлено');
            fetchOrder();
        } else {
            toast.error('Помилка оновлення');
        }
    };

    const runFiscalization = async () => {
        toast.info('Початок фіскалізації...');
        // Mocking Edge Function call
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/fiscalize-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: id })
        });
        if (res.ok) {
            toast.success('Чек згенеровано');
            fetchOrder();
        } else {
            toast.error('Помилка фіскалізації');
        }
    };

    const createTTN = async () => {
        toast.info('Створення ТТН...');
        // Mocking logic or connecting as per previous code
        const res = await fetch(`/api/orders/${id}/create-ttn`, { method: 'POST' });
        if (res.ok) {
            toast.success('ТТН створено');
            fetchOrder();
        } else {
            toast.error('Помилка створення ТТН');
        }
    };

    const duplicateOrder = async () => {
        if (!confirm('Дублювати замовлення?')) return;
        setDuplicating(true);
        const res = await fetch(`/api/orders/${id}/duplicate`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            router.push(`/admin/orders/${data.newOrderId}`);
            toast.success('Замовлення дубльовано');
        } else {
            toast.error('Помилка дублювання');
        }
        setDuplicating(false);
    };

    const generatePrintFile = async () => {
        if (!selectedPrintProfile) return toast.error('Оберіть профіль');
        setIsGenerating(true);
        setGenProgress(20);
        // Mock progress
        const timer = setInterval(() => setGenProgress(p => p < 90 ? p + 10 : p), 500);

        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/print-generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: id, print_profile_id: selectedPrintProfile })
        });

        clearInterval(timer);
        setGenProgress(100);
        if (res.ok) {
            toast.success('Файл згенеровано');
            fetchOrder();
        } else {
            toast.error('Помилка генерації');
        }
        setIsGenerating(false);
    };

    const handleTemplateChange = (templateId: string) => {
        setSelectedTemplate(templateId);
        const tmpl = templates.find(t => t.id === templateId);
        if (tmpl) {
            setReplySubject(tmpl.subject || '');
            setReplyBody(tmpl.body || '');
        }
    };

    const sendReply = async () => {
        setSendingReply(true);
        const res = await fetch(`/api/orders/${id}/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject: replySubject, body: replyBody })
        });
        if (res.ok) {
            toast.success('Лист надіслано');
            setShowReplyModal(false);
        } else {
            toast.error('Помилка надсилання');
        }
        setSendingReply(false);
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
            <Loader2 className="animate-spin" size={48} color="#cbd5e1" />
        </div>
    );

    if (!order) return <div style={{ padding: '100px', textAlign: 'center' }}>Замовлення не знайдено</div>;

    const currentStatus = STATUS_OPTS.find(s => s.id === order.order_status) || STATUS_OPTS[0];

    return (
        <div style={{ maxWidth: '1280px', margin: '0 auto', color: '#0f172a' }}>
            {/* Top Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <button onClick={() => router.back()} style={iconButtonStyle}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h1 style={{ fontSize: '32px', fontWeight: 900, fontFamily: 'var(--font-heading)' }}>Замовлення {order.order_number}</h1>
                            <span style={{ ...statusBadgeStyle, color: currentStatus.color, backgroundColor: currentStatus.bg }}>
                                {currentStatus.label}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
                            <Calendar size={14} /> {new Date(order.created_at).toLocaleString('uk-UA')}
                            <span style={{ color: '#cbd5e1' }}>•</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                {order.order_tag_assignments?.map((a: any) => (
                                    <span key={a.order_tags.id} onClick={() => handleRemoveTag(a.order_tags.id)} style={{ cursor: 'pointer', opacity: 0.8 }} title="Натисніть для видалення">
                                        {a.order_tags.icon} {a.order_tags.name}
                                    </span>
                                ))}
                                <button onClick={() => setShowTagDropdown(true)} style={{ border: 'none', background: 'none', color: '#3b82f6', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>+ Додати тег</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ position: 'relative' }}>
                        <select
                            value={order.order_status}
                            onChange={(e) => updateStatus(e.target.value)}
                            style={{ ...selectStatusStyle, color: currentStatus.color, borderColor: currentStatus.color }}
                        >
                            {STATUS_OPTS.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                    <button onClick={() => window.print()} style={actionBtnStyle} title="Друк"><Printer size={20} /></button>
                    <button onClick={duplicateOrder} disabled={duplicating} style={actionBtnStyle} title="Копіювати">
                        {duplicating ? <Loader2 size={20} className="animate-spin" /> : <CopyPlus size={20} />}
                    </button>
                </div>
            </div>

            {/* Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '32px' }}>

                {/* Left Side */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                    {/* Items Card */}
                    <div style={cardStyle}>
                        <div style={cardHeaderStyle}>
                            <h3 style={cardTitleStyle}><FileText size={20} /> Склад замовлення</h3>
                            <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>{order.items?.length || 0} позицій</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {order.items?.map((item: any, idx: number) => (
                                <div key={idx} style={itemRowStyle}>
                                    <div style={itemThumbStyle}>
                                        {item.image ? <img src={item.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={24} color="#cbd5e1" />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: '16px' }}>{item.name}</div>
                                                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                                                    {Object.entries(item.options || {}).map(([key, val]) => `${key}: ${val}`).join(' • ')}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: 900, fontSize: '16px' }}>{(item.price * item.qty).toLocaleString()} ₴</div>
                                                <div style={{ fontSize: '12px', color: '#94a3b8' }}>{item.qty} шт × {item.price} ₴</div>
                                            </div>
                                        </div>

                                        <div style={itemCommentBoxStyle}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                                                <MessageSquare size={12} /> Коментар до позиції
                                            </div>
                                            <textarea
                                                placeholder="Додати коментар..."
                                                defaultValue={item.comment || ''}
                                                onBlur={(e) => updateItemComment(idx, e.target.value)}
                                                style={itemCommentInputStyle}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={totalsSectionStyle}>
                            <div style={totalRowStyle}>
                                <span>Проміжний підсумок</span>
                                <span>{order.subtotal?.toLocaleString()} ₴</span>
                            </div>
                            <div style={totalRowStyle}>
                                <span>Доставка</span>
                                <span>{order.delivery_cost?.toLocaleString()} ₴</span>
                            </div>
                            <div style={{ ...totalRowStyle, borderTop: '2px solid #f1f5f9', marginTop: '16px', paddingTop: '16px', fontSize: '24px', fontWeight: 950 }}>
                                <span>Загалом</span>
                                <span style={{ color: '#10b981' }}>{order.total?.toLocaleString()} ₴</span>
                            </div>
                        </div>
                    </div>

                    {/* Financial Summary Card */}
                    {(() => {
                        const totalCost = order.items?.reduce((acc: number, item: any) => acc + ((item.cost_price || 0) * (item.qty || 1)), 0) || 0;
                        const totalRevenue = order.subtotal || 0;
                        const profit = totalRevenue - totalCost;
                        const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

                        return (
                            <div style={{ ...cardStyle, backgroundColor: '#fdf2f8', borderColor: '#fbcfe8' }}>
                                <div style={cardHeaderStyle}>
                                    <h3 style={{ ...cardTitleStyle, color: '#be185d' }}><DollarSign size={20} /> Фінансовий аналіз</h3>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                                    <div style={financeMetric}>
                                        <div style={financeLabel}>Дохід</div>
                                        <div style={financeValue}>{totalRevenue.toLocaleString()} ₴</div>
                                    </div>
                                    <div style={financeMetric}>
                                        <div style={financeLabel}>Собівартість</div>
                                        <div style={financeValue}>{totalCost.toLocaleString()} ₴</div>
                                    </div>
                                    <div style={financeMetric}>
                                        <div style={financeLabel}>Прибуток</div>
                                        <div style={{ ...financeValue, color: profit > 0 ? '#10b981' : '#f43f5e' }}>{profit.toLocaleString()} ₴</div>
                                    </div>
                                    <div style={financeMetric}>
                                        <div style={financeLabel}>Маржа</div>
                                        <div style={{ ...financeValue, color: margin > 20 ? '#10b981' : '#f59e0b' }}>{margin.toFixed(1)}%</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Delivery & Payment */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                        <div style={cardStyle}>
                            <div style={cardHeaderStyle}>
                                <h3 style={cardTitleStyle}><Truck size={20} /> Доставка</h3>
                                <button onClick={() => setIsEditingTTN(!isEditingTTN)} style={{ border: 'none', background: 'none', color: '#3b82f6', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>
                                    {isEditingTTN ? 'Скасувати' : 'Змінити ТТН'}
                                </button>
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={miniLabel}>Рахунок відправки</label>
                                <select
                                    style={staffSelectStyle}
                                    value={order.np_account_id || ''}
                                    onChange={e => updateOrderAccount('np_account_id', e.target.value)}
                                >
                                    <option value="">Автоматично (Default)</option>
                                    {npAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.label}</option>)}
                                </select>
                            </div>
                            <div style={infoBlockStyle}>
                                <div style={infoLabelStyle}>Спосіб</div>
                                <div style={infoValueStyle}>{order.delivery_method}</div>
                            </div>
                            <div style={{ height: '12px' }} />
                            <div style={infoBlockStyle}>
                                <div style={infoLabelStyle}>ТТН</div>
                                {isEditingTTN ? (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input value={ttnValue} onChange={e => setTtnValue(e.target.value)} style={modalInputStyle} />
                                        <button onClick={saveTTN} style={{ padding: '0 16px', backgroundColor: '#1e293b', color: 'white', border: 'none', borderRadius: '12px' }}>ОК</button>
                                    </div>
                                ) : (
                                    <div style={{ ...infoValueStyle, color: '#ef4444' }}>{order.ttn || '—'}</div>
                                )}
                            </div>
                        </div>

                        <div style={cardStyle}>
                            <div style={cardHeaderStyle}>
                                <h3 style={cardTitleStyle}><CreditCard size={20} /> Оплата</h3>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {order.fiscal_url && <a href={order.fiscal_url} target="_blank" style={{ color: '#10b981' }} title="Чек"><Receipt size={18} /></a>}
                                    <span style={{ padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 800, backgroundColor: order.payment_status === 'paid' ? '#f0fdf4' : '#fffbeb', color: order.payment_status === 'paid' ? '#10b981' : '#f59e0b' }}>
                                        {order.payment_status?.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={miniLabel}>Рахунок отримувача</label>
                                <select
                                    style={staffSelectStyle}
                                    value={order.bank_account_id || ''}
                                    onChange={e => updateOrderAccount('bank_account_id', e.target.value)}
                                >
                                    <option value="">Не обрано</option>
                                    {bankAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.label} ({acc.bank_name})</option>)}
                                </select>
                            </div>
                            <div style={infoBlockStyle}>
                                <div style={infoLabelStyle}>Сума</div>
                                <div style={{ fontSize: '20px', fontWeight: 950 }}>{order.total?.toLocaleString()} ₴</div>
                            </div>
                            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: order.fiscal_id ? '#10b981' : '#64748b' }}>
                                    <ShieldCheck size={16} /> {order.fiscal_id ? 'Фіскалізовано' : 'Не фіскалізовано'}
                                </div>
                                <button onClick={runFiscalization} style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>Фіскалізувати</button>
                            </div>
                        </div>
                    </div>

                    {/* Print Files */}
                    {order.constructor_project_id && (
                        <div style={cardStyle}>
                            <h3 style={cardTitleStyle}><Printer size={20} /> Файли для друку</h3>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginTop: '20px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={smallLabelStyle}>Профіль друку</label>
                                    <select value={selectedPrintProfile} onChange={e => setSelectedPrintProfile(e.target.value)} style={staffSelectStyle}>
                                        <option value="">Оберіть профіль...</option>
                                        {printProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <button onClick={generatePrintFile} disabled={isGenerating} style={{ padding: '12px 24px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', gap: '8px', opacity: isGenerating ? 0.6 : 1 }}>
                                    {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} Згенерувати
                                </button>
                            </div>
                            {isGenerating && <div style={{ width: '100%', height: '4px', background: '#f1f5f9', borderRadius: '2px', marginTop: '12px', overflow: 'hidden' }}><div style={{ width: `${genProgress}%`, height: '100%', background: '#10b981', transition: 'width 0.3s' }} /></div>}
                        </div>
                    )}
                </div>

                {/* Right Side */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    <div style={cardStyle}>
                        <h3 style={cardTitleStyle}><User size={20} /> Клієнт</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                            <div style={avatarStyle}>{order.customer_name?.[0]}</div>
                            <div>
                                <div style={{ fontSize: '18px', fontWeight: 900 }}>{order.customer_name}</div>
                                <div style={{ fontSize: '13px', color: '#64748b' }}>{order.customer_phone}</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <a href={`mailto:${order.customer_email}`} style={contactLinkStyle}><Mail size={16} /> {order.customer_email}</a>

                            {order.customer_telegram && (
                                <div style={contactLinkStyle}>
                                    <Send size={16} /> {order.customer_telegram}
                                </div>
                            )}

                            {order.customer_birthday && (
                                <div style={contactLinkStyle}>
                                    <Calendar size={16} /> {new Date(order.customer_birthday).toLocaleDateString('uk-UA')}
                                </div>
                            )}

                            <button onClick={() => setShowReplyModal(true)} style={{ ...contactLinkStyle, border: 'none', cursor: 'pointer', backgroundColor: '#eff6ff', color: '#3b82f6', width: '100%', textAlign: 'left' }}><MessageSquare size={16} /> Написати клієнту</button>
                        </div>
                    </div>

                    <div style={cardStyle}>
                        <h3 style={cardTitleStyle}><Settings size={20} /> Відповідальні</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={smallLabelStyle}>Менеджер</label>
                                <select value={order.manager_id || ''} onChange={e => handleAssign('manager_id', e.target.value)} style={staffSelectStyle}>
                                    <option value="">Не призначено</option>
                                    {staff.filter(s => s.role === 'manager' || s.role === 'admin').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={smallLabelStyle}>Дизайнер</label>
                                <select value={order.designer_id || ''} onChange={e => handleAssign('designer_id', e.target.value)} style={staffSelectStyle}>
                                    <option value="">Не призначено</option>
                                    {staff.filter(s => s.role === 'designer' || s.role === 'admin').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div style={cardStyle}>
                        <div style={cardHeaderStyle}>
                            <h3 style={cardTitleStyle}><Info size={20} /> Нотатки</h3>
                            <button onClick={saveNotes} style={{ border: 'none', background: 'none', color: '#10b981', cursor: 'pointer' }}><Save size={18} /></button>
                        </div>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Службові коментарі..." style={notesInputStyle} />
                    </div>

                    <div style={cardStyle}>
                        <h3 style={cardTitleStyle}><History size={20} /> Історія</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {history.slice(0, 5).map((h, i) => (
                                <div key={i} style={{ fontSize: '12px', borderLeft: '2px solid #e2e8f0', paddingLeft: '12px' }}>
                                    <div style={{ fontWeight: 700 }}>{h.action}</div>
                                    <div style={{ color: '#94a3b8' }}>{new Date(h.created_at).toLocaleString('uk-UA')}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tag Dropdown Overlay */}
            {showTagDropdown && (
                <div style={overlayStyle} onClick={() => setShowTagDropdown(false)}>
                    <div style={dropdownStyle} onClick={e => e.stopPropagation()}>
                        <div style={{ fontWeight: 800, fontSize: '14px', padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>Оберіть тег</div>
                        {availableTags.map(tag => (
                            <button key={tag.id} onClick={() => handleAddTag(tag.id)} style={dropdownOptionStyle}>
                                <span>{tag.icon}</span> {tag.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Reply Modal */}
            {showReplyModal && (
                <div style={overlayStyle} onClick={() => setShowReplyModal(false)}>
                    <div style={{ ...cardStyle, width: '600px' }} onClick={e => e.stopPropagation()}>
                        <div style={cardHeaderStyle}>
                            <h3 style={cardTitleStyle}>Відповідь клієнту</h3>
                            <button onClick={() => setShowReplyModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={smallLabelStyle}>Шаблон</label>
                            <select value={selectedTemplate} onChange={e => handleTemplateChange(e.target.value)} style={staffSelectStyle}>
                                <option value="">Оберіть шаблон...</option>
                                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <input value={replySubject} onChange={e => setReplySubject(e.target.value)} placeholder="Тема листа" style={{ ...modalInputStyle, width: '100%', marginBottom: '12px' }} />
                        <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} placeholder="Текст листа..." style={{ ...notesInputStyle, width: '100%', height: '200px', marginBottom: '20px' }} />
                        <button onClick={sendReply} disabled={sendingReply} style={{ width: '100%', padding: '14px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 800 }}>
                            {sendingReply ? <Loader2 className="animate-spin" /> : <Send size={18} />} Надіслати
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// Minimal Premium Styles
const iconButtonStyle = { width: '44px', height: '44px', borderRadius: '14px', border: '1.5px solid #e2e8f0', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' };
const actionBtnStyle = { width: '48px', height: '48px', borderRadius: '16px', border: '1.5px solid #e2e8f0', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' };
const statusBadgeStyle = { padding: '6px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 800 };
const selectStatusStyle = { padding: '12px 20px', borderRadius: '16px', border: '2px solid', backgroundColor: 'white', fontWeight: 800, cursor: 'pointer', outline: 'none' };
const cardStyle = { backgroundColor: 'white', borderRadius: '32px', border: '1px solid #f1f5f9', padding: '32px', boxShadow: '0 4px 25px rgba(0,0,0,0.02)' };
const cardHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' };
const cardTitleStyle = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px', fontWeight: 900, margin: 0 };
const itemRowStyle = { display: 'flex', gap: '20px', padding: '24px 0', borderBottom: '1px solid #f8fafc' };
const itemThumbStyle = { width: '80px', height: '80px', borderRadius: '16px', backgroundColor: '#f8fafc', overflow: 'hidden', border: '1px solid #f1f5f9', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const itemCommentBoxStyle = { marginTop: '16px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px' };
const itemCommentInputStyle = { width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', fontWeight: 500, color: '#475569', resize: 'none' as any, minHeight: '40px' };
const totalsSectionStyle = { marginTop: '32px' };
const totalRowStyle = { display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 600, color: '#64748b', marginBottom: '8px' };
const infoBlockStyle = { backgroundColor: '#f8fafc', padding: '16px', borderRadius: '20px' };
const infoLabelStyle = { fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as any, marginBottom: '4px' };
const infoValueStyle = { fontSize: '16px', fontWeight: 700, color: '#1e293b' };
const financeMetric: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' };
const financeLabel = { fontSize: '11px', fontWeight: 800, color: '#be185d', textTransform: 'uppercase' as any, opacity: 0.7 };
const financeValue = { fontSize: '18px', fontWeight: 950, color: '#0f172a' };
const miniLabel = { display: 'block', fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as any, marginBottom: '6px', letterSpacing: '0.05em' };
const avatarStyle = { width: '56px', height: '56px', borderRadius: '20px', backgroundColor: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 900 };
const contactLinkStyle = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', color: '#1e293b', fontWeight: 700, textDecoration: 'none', padding: '16px', borderRadius: '16px', backgroundColor: '#f8fafc' };
const smallLabelStyle = { display: 'block', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as any, marginBottom: '8px' };
const staffSelectStyle = { width: '100%', padding: '12px 16px', borderRadius: '14px', border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '14px', fontWeight: 700, outline: 'none' };
const notesInputStyle = { width: '100%', minHeight: '120px', padding: '16px', borderRadius: '16px', border: '1.5px solid #e2e8f0', backgroundColor: '#fffbeb', fontSize: '14px', fontWeight: 500, outline: 'none', resize: 'none' as any };
const modalInputStyle = { padding: '10px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px' };
const overlayStyle = { position: 'fixed' as any, inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' };
const dropdownStyle = { backgroundColor: 'white', borderRadius: '20px', minWidth: '240px', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', border: '1px solid #f1f5f9', overflow: 'hidden' };
const dropdownOptionStyle = { width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', border: 'none', background: 'none', textAlign: 'left' as any, cursor: 'pointer', fontSize: '14px', fontWeight: 700, transition: 'background 0.2s' };
