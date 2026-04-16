'use client';
import { useState, useEffect, use } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import DesignerProjectBlock from './DesignerProjectBlock';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDateTime, formatDateOnly } from '@/lib/date-utils';
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
    DollarSign,
    Copy,
    RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_OPTS = [
    { id: 'new', label: 'Нове', color: '#263A99', bg: '#eff6ff' },
    { id: 'confirmed', label: 'Підтверджено', color: '#14b8a6', bg: '#f0fdfa' },
    { id: 'in_production', label: 'У виробництві', color: '#f59e0b', bg: '#fffbeb' },
    { id: 'shipped', label: 'Відправлено', color: '#a855f7', bg: '#f5f3ff' },
    { id: 'delivered', label: 'Виконано', color: '#22c55e', bg: '#f0fdf4' },
    { id: 'cancelled', label: 'Скасовано', color: '#ef4444', bg: '#fef2f2' },
];

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const supabase = createClient();
    const router = useRouter();

    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
    const [saving, setSaving] = useState(false);
    const [notes, setNotes] = useState('');
    const [clientComment, setClientComment] = useState('');
    const [filesUrl, setFilesUrl] = useState('');
    const [history, setHistory] = useState<any[]>([]);
    const [previousOrdersCount, setPreviousOrdersCount] = useState(0);

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

    // Nova Poshta TTN
    const [showTTNModal, setShowTTNModal] = useState(false);
    const [creatingTTN, setCreatingTTN] = useState(false);
    const [trackingTTN, setTrackingTTN] = useState(false);
    const [trackingInfo, setTrackingInfo] = useState<any>(null);
    const [ttnFormData, setTTNFormData] = useState({
        weight: 0.5,
        declaredValue: 0,
        codAmount: 0,
        description: 'Фотокниги та фотовироби'
    });

    // Monobank Payment
    const [creatingPaymentLink, setCreatingPaymentLink] = useState(false);
    const [paymentLink, setPaymentLink] = useState('');

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
        try {
            // Use admin API to bypass RLS — works for both manual and site orders
            const res = await fetch(`/api/admin/orders/${id}`);
            const json = await res.json();
            const data = json.order;
        if (data) {
            setOrder(data);
            setNotes(data.notes || '');
            setClientComment(data.client_comment || '');
            setFilesUrl(data.files_url || '');
            setTtnValue(data.ttn || data.tracking_number || '');
            if (data.print_profile_id) setSelectedPrintProfile(data.print_profile_id);

            // Initialize TTN form with order data
            const paymentIsCOD = data.payment_method === 'Післяплата' || data.payment_method === 'COD';
            setTTNFormData({
                weight: 0.5,
                declaredValue: data.total || 0,
                codAmount: paymentIsCOD ? data.total : 0,
                description: 'Фотокниги та фотовироби'
            });

            // Fetch previous orders count for this customer
            if (data.customer_phone || data.customer_email) {
                const { count } = await supabase
                    .from('orders')
                    .select('*', { count: 'exact', head: true })
                    .or(`customer_phone.eq.${data.customer_phone},customer_email.eq.${data.customer_email}`)
                    .neq('id', id);
                setPreviousOrdersCount(count || 0);
            }
        }

        const { data: historyData } = await supabase
            .from('order_history')
            .select('*')
            .eq('order_id', id)
            .order('created_at', { ascending: false });

        if (historyData) setHistory(historyData);
        } catch (err) {
            console.error('fetchOrder error:', err);
        } finally {
            setLoading(false);
        }
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
            .update({
                notes: notes,
                client_comment: clientComment,
                files_url: filesUrl
            })
            .eq('id', id);

        if (!error) toast.success('Дані збережено');
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

    const openTTNModal = () => {
        setShowTTNModal(true);
    };

    const createTTN = async () => {
        setCreatingTTN(true);
        try {
            const res = await fetch('/api/nova-poshta/create-ttn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: id,
                    recipientName: order.customer_name,
                    recipientPhone: order.customer_phone,
                    recipientCity: order.delivery_city || order.customer_city,
                    recipientWarehouse: order.delivery_warehouse || order.delivery_address,
                    weight: ttnFormData.weight,
                    declaredValue: ttnFormData.declaredValue,
                    paymentMethod: order.payment_method,
                    codAmount: ttnFormData.codAmount,
                    description: ttnFormData.description
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                toast.success(`ТТН створено: ${data.ttn}`);
                setShowTTNModal(false);
                await fetchOrder();
            } else {
                toast.error(data.error || 'Помилка створення ТТН');
                console.error('TTN error:', data.details);
            }
        } catch (error) {
            console.error('TTN creation error:', error);
            toast.error('Помилка створення ТТН');
        } finally {
            setCreatingTTN(false);
        }
    };

    const trackTTN = async () => {
        if (!order.tracking_number && !order.ttn) {
            toast.error('Немає ТТН для відстеження');
            return;
        }

        setTrackingTTN(true);
        try {
            const res = await fetch('/api/nova-poshta/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ttn: order.tracking_number || order.ttn,
                    orderId: id
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setTrackingInfo(data.tracking);
                toast.success('Статус оновлено');
                await fetchOrder(); // Refresh to get updated status
            } else {
                toast.error(data.error || 'Помилка відстеження');
            }
        } catch (error) {
            console.error('Tracking error:', error);
            toast.error('Помилка відстеження');
        } finally {
            setTrackingTTN(false);
        }
    };

    const copyTTN = () => {
        const ttn = order.tracking_number || order.ttn;
        if (ttn) {
            navigator.clipboard.writeText(ttn);
            toast.success('ТТН скопійовано');
        }
    };

    const createMonobankPaymentLink = async () => {
        setCreatingPaymentLink(true);
        try {
            const res = await fetch('/api/monobank/create-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: id })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setPaymentLink(data.pageUrl);
                navigator.clipboard.writeText(data.pageUrl);
                toast.success('Посилання на оплату створено та скопійовано!');
                await fetchOrder(); // Refresh to show updated payment info
            } else {
                toast.error(data.error || 'Помилка створення посилання');
                console.error('Monobank error:', data.details);
            }
        } catch (error) {
            console.error('Payment link creation error:', error);
            toast.error('Помилка створення посилання на оплату');
        } finally {
            setCreatingPaymentLink(false);
        }
    };

    const copyPaymentLink = () => {
        const link = order.monobank_payment_url || paymentLink;
        if (link) {
            navigator.clipboard.writeText(link);
            toast.success('Посилання скопійовано');
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
        <div style={{ maxWidth: '1280px', margin: '0 auto', color: '#263A99' }}>
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
                            <Calendar size={14} /> {formatDateTime(order.created_at)}
                            <span style={{ color: '#cbd5e1' }}>•</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                {order.order_tag_assignments?.map((a: any) => (
                                    <span key={a.order_tags.id} onClick={() => handleRemoveTag(a.order_tags.id)} style={{ cursor: 'pointer', opacity: 0.8 }} title="Натисніть для видалення">
                                        {a.order_tags.icon} {a.order_tags.name}
                                    </span>
                                ))}
                                <button onClick={() => setShowTagDropdown(true)} style={{ border: 'none', background: 'none', color: '#263A99', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>+ Додати тег</button>
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
                                {!(order.tracking_number || order.ttn) && (
                                    <button
                                        onClick={openTTNModal}
                                        style={{
                                            padding: '6px 12px',
                                            backgroundColor: '#22c55e',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: "3px",
                                            fontSize: '13px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <Plus size={14} /> Створити ТТН
                                    </button>
                                )}
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
                                {(order.tracking_number || order.ttn) ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '16px', fontWeight: 700, color: '#263A99' }}>
                                                {order.tracking_number || order.ttn}
                                            </span>
                                            <button
                                                onClick={copyTTN}
                                                style={{
                                                    padding: '4px 8px',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: "3px",
                                                    cursor: 'pointer',
                                                    background: 'white'
                                                }}
                                                title="Копіювати ТТН"
                                            >
                                                <Copy size={14} />
                                            </button>
                                            <button
                                                onClick={trackTTN}
                                                disabled={trackingTTN}
                                                style={{
                                                    padding: '4px 8px',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: "3px",
                                                    cursor: trackingTTN ? 'wait' : 'pointer',
                                                    background: 'white'
                                                }}
                                                title="Оновити статус"
                                            >
                                                {trackingTTN ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                            </button>
                                        </div>
                                        <a
                                            href={`https://novaposhta.ua/tracking/?cargo_number=${order.tracking_number || order.ttn}`}
                                            target="_blank"
                                            style={{
                                                fontSize: '13px',
                                                color: '#263A99',
                                                textDecoration: 'none',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            Відстежити на novaposhta.ua <ExternalLink size={12} />
                                        </a>
                                        {trackingInfo && (
                                            <div style={{
                                                padding: '12px',
                                                backgroundColor: '#f8fafc',
                                                borderRadius: "3px",
                                                fontSize: '13px',
                                                marginTop: '8px'
                                            }}>
                                                <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                                                    Статус: {trackingInfo.status}
                                                </div>
                                                {trackingInfo.estimatedDeliveryDate && (
                                                    <div style={{ color: '#64748b' }}>
                                                        Очікувана дата: {trackingInfo.estimatedDeliveryDate}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ ...infoValueStyle, color: '#94a3b8' }}>—</div>
                                )}
                            </div>
                        </div>

                        <div style={cardStyle}>
                            <div style={cardHeaderStyle}>
                                <h3 style={cardTitleStyle}><CreditCard size={20} /> Оплата</h3>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    {order.fiscal_url && <a href={order.fiscal_url} target="_blank" style={{ color: '#10b981' }} title="Чек"><Receipt size={18} /></a>}
                                    <span style={{
                                        padding: '4px 10px',
                                        borderRadius: "3px",
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        backgroundColor: order.payment_status === 'paid' ? '#f0fdf4' : order.payment_status === 'failed' ? '#fef2f2' : '#fffbeb',
                                        color: order.payment_status === 'paid' ? '#10b981' : order.payment_status === 'failed' ? '#ef4444' : '#f59e0b'
                                    }}>
                                        {order.payment_status === 'paid' ? 'PAID' : order.payment_status === 'failed' ? 'FAILED' : order.payment_status === 'pending' ? 'PENDING' : order.payment_status?.toUpperCase()}
                                    </span>
                                </div>
                            </div>

                            {/* Monobank Payment Link */}
                            {order.payment_status !== 'paid' && (
                                <div style={{ marginBottom: '16px' }}>
                                    {(order.monobank_payment_url || paymentLink) ? (
                                        <div>
                                            <label style={miniLabel}>Посилання на оплату</label>
                                            <div style={{
                                                display: 'flex',
                                                gap: '8px',
                                                padding: '12px',
                                                backgroundColor: '#f8fafc',
                                                borderRadius: "3px",
                                                marginBottom: '8px'
                                            }}>
                                                <input
                                                    type="text"
                                                    value={order.monobank_payment_url || paymentLink}
                                                    readOnly
                                                    style={{
                                                        flex: 1,
                                                        border: 'none',
                                                        background: 'transparent',
                                                        fontSize: '13px',
                                                        color: '#263A99',
                                                        fontWeight: 600,
                                                        outline: 'none'
                                                    }}
                                                />
                                                <button
                                                    onClick={copyPaymentLink}
                                                    style={{
                                                        padding: '4px 12px',
                                                        backgroundColor: '#263A99',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: "3px",
                                                        fontSize: '12px',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    <Copy size={14} /> Копіювати
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={createMonobankPaymentLink}
                                            disabled={creatingPaymentLink}
                                            style={{
                                                width: '100%',
                                                padding: '12px 16px',
                                                backgroundColor: '#22c55e',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: "3px",
                                                fontSize: '14px',
                                                fontWeight: 700,
                                                cursor: creatingPaymentLink ? 'wait' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                marginBottom: '16px'
                                            }}
                                        >
                                            {creatingPaymentLink ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={16} />
                                                    Створення...
                                                </>
                                            ) : (
                                                <>
                                                     Надіслати посилання на оплату
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}

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
                            {order.monobank_invoice_id && (
                                <div style={{
                                    marginTop: '12px',
                                    padding: '8px 12px',
                                    backgroundColor: '#f8fafc',
                                    borderRadius: "3px",
                                    fontSize: '12px',
                                    color: '#64748b'
                                }}>
                                    Invoice ID: {order.monobank_invoice_id}
                                </div>
                            )}
                            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: order.fiscal_id ? '#10b981' : '#64748b' }}>
                                    <ShieldCheck size={16} /> {order.fiscal_id ? 'Фіскалізовано' : 'Не фіскалізовано'}
                                </div>
                                <button onClick={runFiscalization} style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: "3px", fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>Фіскалізувати</button>
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
                                <button onClick={generatePrintFile} disabled={isGenerating} style={{ padding: '12px 24px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: "3px", fontWeight: 700, cursor: 'pointer', display: 'flex', gap: '8px', opacity: isGenerating ? 0.6 : 1 }}>
                                    {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} Згенерувати
                                </button>
                            </div>
                            {isGenerating && <div style={{ width: '100%', height: '4px', background: '#f1f5f9', borderRadius: "3px", marginTop: '12px', overflow: 'hidden' }}><div style={{ width: `${genProgress}%`, height: '100%', background: '#10b981', transition: 'width 0.3s' }} /></div>}
                        </div>
                    )}
                </div>

                {/* Right Side */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    <div style={cardStyle}>
                        <h3 style={cardTitleStyle}><User size={20} /> Клієнт</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                            <div style={avatarStyle}>{order.customer_name?.[0]}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '18px', fontWeight: 900 }}>{order.customer_name}</div>
                                <div style={{ fontSize: '13px', color: '#64748b' }}>{order.customer_phone}</div>
                            </div>
                        </div>
                        {previousOrdersCount > 0 && (
                            <div style={{ padding: '10px 14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: 600, color: '#166534' }}>
                                 Попередніх замовлень: {previousOrdersCount}
                            </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <a href={`mailto:${order.customer_email}`} style={contactLinkStyle}><Mail size={16} /> {order.customer_email}</a>

                            {order.customer_instagram && (
                                <a href={`https://instagram.com/${order.customer_instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={contactLinkStyle}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                                    {order.customer_instagram}
                                </a>
                            )}

                            {order.customer_telegram && (
                                <div style={contactLinkStyle}>
                                    <Send size={16} /> {order.customer_telegram}
                                </div>
                            )}

                            {order.customer_birthday && (
                                <div style={contactLinkStyle}>
                                    <Calendar size={16} /> {formatDateOnly(order.customer_birthday)}
                                </div>
                            )}

                            <button onClick={() => setShowReplyModal(true)} style={{ ...contactLinkStyle, border: 'none', cursor: 'pointer', backgroundColor: '#eff6ff', color: '#263A99', width: '100%', textAlign: 'left' }}><MessageSquare size={16} /> Написати клієнту</button>
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

                    {/*  Designer Project Block  */}
                    <div style={{ marginBottom: 0 }}>
                        {!order.with_designer ? (
                            <div style={{ background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>🎨 Дизайн від дизайнера</div>
                                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Натисніть щоб призначити дизайнера для цього замовлення</div>
                                </div>
                                <button onClick={async () => {
                                    const { error } = await supabase.from('orders').update({ with_designer: true }).eq('id', order.id);
                                    if (!error) { setOrder((o: any) => ({ ...o, with_designer: true })); toast.success('Дизайн увімкнено'); }
                                    else toast.error(error.message);
                                }} style={{ padding: '7px 16px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                                    Увімкнути дизайн
                                </button>
                            </div>
                        ) : (
                            <DesignerProjectBlock order={order} />
                        )}
                    </div>

                    <div style={cardStyle}>
                        <div style={cardHeaderStyle}>
                            <h3 style={cardTitleStyle}><FileText size={20} /> Файли</h3>
                            <button onClick={saveNotes} style={{ border: 'none', background: 'none', color: '#10b981', cursor: 'pointer' }}><Save size={18} /></button>
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={smallLabelStyle}>Посилання на Google Drive/Фото</label>
                            <input
                                type="url"
                                value={filesUrl}
                                onChange={e => setFilesUrl(e.target.value)}
                                placeholder="https://drive.google.com/..."
                                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                            />
                        </div>
                        {filesUrl && (
                            <a
                                href={filesUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 16px',
                                    backgroundColor: '#eff6ff',
                                    color: '#263A99',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    textDecoration: 'none'
                                }}
                            >
                                <ExternalLink size={16} /> Відкрити файли
                            </a>
                        )}
                    </div>

                    <div style={cardStyle}>
                        <div style={cardHeaderStyle}>
                            <h3 style={cardTitleStyle}><Info size={20} /> Нотатки та коментарі</h3>
                            <button onClick={saveNotes} style={{ border: 'none', background: 'none', color: '#10b981', cursor: 'pointer' }}><Save size={18} /></button>
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={smallLabelStyle}>Службові нотатки (менеджер)</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Внутрішні коментарі для команди..."
                                style={notesInputStyle}
                                rows={3}
                            />
                        </div>
                        <div>
                            <label style={smallLabelStyle}>Коментар клієнта</label>
                            <textarea
                                value={clientComment}
                                onChange={e => setClientComment(e.target.value)}
                                placeholder="Побажання та коментарі від клієнта..."
                                style={{ ...notesInputStyle, backgroundColor: '#fffbeb', borderColor: '#fbbf24' }}
                                rows={3}
                            />
                        </div>
                    </div>

                    <div style={cardStyle}>
                        <h3 style={cardTitleStyle}><History size={20} /> Історія</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {history.slice(0, 5).map((h, i) => (
                                <div key={i} style={{ fontSize: '12px', borderLeft: '2px solid #e2e8f0', paddingLeft: '12px' }}>
                                    <div style={{ fontWeight: 700 }}>{h.action}</div>
                                    <div style={{ color: '#94a3b8' }}>{formatDateTime(h.created_at)}</div>
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
            {showReplyModal && mounted && createPortal(
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
                        <button onClick={sendReply} disabled={sendingReply} style={{ width: '100%', padding: '14px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: "3px", fontWeight: 800 }}>
                            {sendingReply ? <Loader2 className="animate-spin" /> : <Send size={18} />} Надіслати
                        </button>
                    </div>
                </div>,
              document.body
            )}

            {/* Nova Poshta TTN Creation Modal */}
            {showTTNModal && mounted && createPortal(
              <div style={overlayStyle} onClick={() => setShowTTNModal(false)}>
                    <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: "3px", padding: '40px', width: '600px', maxWidth: '90vw', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                            <h2 style={{ fontSize: '24px', fontWeight: 900, margin: 0 }}>Створити ТТН Нова Пошта</h2>
                            <button onClick={() => setShowTTNModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={smallLabelStyle}>Отримувач</label>
                            <input
                                type="text"
                                value={order.customer_name}
                                disabled
                                style={{ ...modalInputStyle, width: '100%', backgroundColor: '#f8fafc' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                            <div>
                                <label style={smallLabelStyle}>Телефон</label>
                                <input
                                    type="text"
                                    value={order.customer_phone}
                                    disabled
                                    style={{ ...modalInputStyle, width: '100%', backgroundColor: '#f8fafc' }}
                                />
                            </div>
                            <div>
                                <label style={smallLabelStyle}>Місто</label>
                                <input
                                    type="text"
                                    value={order.delivery_city || order.customer_city || ''}
                                    disabled
                                    style={{ ...modalInputStyle, width: '100%', backgroundColor: '#f8fafc' }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={smallLabelStyle}>Відділення</label>
                            <input
                                type="text"
                                value={order.delivery_warehouse || order.delivery_address || ''}
                                disabled
                                style={{ ...modalInputStyle, width: '100%', backgroundColor: '#f8fafc' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                            <div>
                                <label style={smallLabelStyle}>Вага (кг)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={ttnFormData.weight}
                                    onChange={e => setTTNFormData({ ...ttnFormData, weight: parseFloat(e.target.value) })}
                                    style={{ ...modalInputStyle, width: '100%' }}
                                />
                            </div>
                            <div>
                                <label style={smallLabelStyle}>Оголошена вартість (₴)</label>
                                <input
                                    type="number"
                                    value={ttnFormData.declaredValue}
                                    onChange={e => setTTNFormData({ ...ttnFormData, declaredValue: parseFloat(e.target.value) })}
                                    style={{ ...modalInputStyle, width: '100%' }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={smallLabelStyle}>Тип оплати</label>
                            <div style={{
                                padding: '12px 16px',
                                backgroundColor: '#f8fafc',
                                borderRadius: "3px",
                                fontSize: '14px',
                                fontWeight: 700
                            }}>
                                {order.payment_method || 'Не вказано'}
                            </div>
                        </div>

                        {(order.payment_method === 'Післяплата' || order.payment_method === 'COD') && (
                            <div style={{ marginBottom: '24px' }}>
                                <label style={smallLabelStyle}>Сума післяплати (₴)</label>
                                <input
                                    type="number"
                                    value={ttnFormData.codAmount}
                                    onChange={e => setTTNFormData({ ...ttnFormData, codAmount: parseFloat(e.target.value) })}
                                    style={{ ...modalInputStyle, width: '100%' }}
                                />
                            </div>
                        )}

                        <div style={{ marginBottom: '32px' }}>
                            <label style={smallLabelStyle}>Опис вмісту</label>
                            <input
                                type="text"
                                value={ttnFormData.description}
                                onChange={e => setTTNFormData({ ...ttnFormData, description: e.target.value })}
                                style={{ ...modalInputStyle, width: '100%' }}
                                placeholder="Фотокниги та фотовироби"
                            />
                        </div>

                        <button
                            onClick={createTTN}
                            disabled={creatingTTN}
                            style={{
                                width: '100%',
                                padding: '16px',
                                backgroundColor: '#22c55e',
                                color: 'white',
                                border: 'none',
                                borderRadius: "3px",
                                fontSize: '16px',
                                fontWeight: 800,
                                cursor: creatingTTN ? 'wait' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            {creatingTTN ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Створення ТТН...
                                </>
                            ) : (
                                <>
                                    <Package size={20} />
                                    Створити ТТН
                                </>
                            )}
                        </button>

                        <div style={{
                            marginTop: '16px',
                            padding: '12px',
                            backgroundColor: '#fef3c7',
                            borderRadius: "3px",
                            fontSize: '13px',
                            color: '#92400e'
                        }}>
                            <strong>Увага:</strong> Переконайтесь, що всі дані введено правильно перед створенням ТТН
                        </div>
                    </div>
                </div>,
              document.body
            )}
        </div>
    );
}

// Minimal Premium Styles
const iconButtonStyle = { width: '44px', height: '44px', borderRadius: "3px", border: '1.5px solid #e2e8f0', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' };
const actionBtnStyle = { width: '48px', height: '48px', borderRadius: "3px", border: '1.5px solid #e2e8f0', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' };
const statusBadgeStyle = { padding: '6px 14px', borderRadius: "3px", fontSize: '13px', fontWeight: 800 };
const selectStatusStyle = { padding: '12px 20px', borderRadius: "3px", border: '2px solid', backgroundColor: 'white', fontWeight: 800, cursor: 'pointer', outline: 'none' };
const cardStyle = { backgroundColor: 'white', borderRadius: "3px", border: '1px solid #f1f5f9', padding: '32px', boxShadow: '0 4px 25px rgba(0,0,0,0.02)' };
const cardHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' };
const cardTitleStyle = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px', fontWeight: 900, margin: 0 };
const itemRowStyle = { display: 'flex', gap: '20px', padding: '24px 0', borderBottom: '1px solid #f8fafc' };
const itemThumbStyle = { width: '80px', height: '80px', borderRadius: "3px", backgroundColor: '#f8fafc', overflow: 'hidden', border: '1px solid #f1f5f9', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const itemCommentBoxStyle = { marginTop: '16px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: "3px" };
const itemCommentInputStyle = { width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', fontWeight: 500, color: '#475569', resize: 'none' as any, minHeight: '40px' };
const totalsSectionStyle = { marginTop: '32px' };
const totalRowStyle = { display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 600, color: '#64748b', marginBottom: '8px' };
const infoBlockStyle = { backgroundColor: '#f8fafc', padding: '16px', borderRadius: "3px" };
const infoLabelStyle = { fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as any, marginBottom: '4px' };
const infoValueStyle = { fontSize: '16px', fontWeight: 700, color: '#263A99' };
const financeMetric: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' };
const financeLabel = { fontSize: '11px', fontWeight: 800, color: '#be185d', textTransform: 'uppercase' as any, opacity: 0.7 };
const financeValue = { fontSize: '18px', fontWeight: 950, color: '#263A99' };
const miniLabel = { display: 'block', fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as any, marginBottom: '6px', letterSpacing: '0.05em' };
const avatarStyle = { width: '56px', height: '56px', borderRadius: "3px", backgroundColor: '#eff6ff', color: '#263A99', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 900 };
const contactLinkStyle = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', color: '#263A99', fontWeight: 700, textDecoration: 'none', padding: '16px', borderRadius: "3px", backgroundColor: '#f8fafc' };
const smallLabelStyle = { display: 'block', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as any, marginBottom: '8px' };
const staffSelectStyle = { width: '100%', padding: '12px 16px', borderRadius: "3px", border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '14px', fontWeight: 700, outline: 'none' };
const notesInputStyle = { width: '100%', minHeight: '120px', padding: '16px', borderRadius: "3px", border: '1.5px solid #e2e8f0', backgroundColor: '#fffbeb', fontSize: '14px', fontWeight: 500, outline: 'none', resize: 'none' as any };
const modalInputStyle = { padding: '10px 16px', borderRadius: "3px", border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px' };
const overlayStyle = { position: 'fixed' as any, inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' };
const dropdownStyle = { backgroundColor: 'white', borderRadius: "3px", minWidth: '240px', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', border: '1px solid #f1f5f9', overflow: 'hidden' };
const dropdownOptionStyle = { width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', border: 'none', background: 'none', textAlign: 'left' as any, cursor: 'pointer', fontSize: '14px', fontWeight: 700, transition: 'background 0.2s' };
