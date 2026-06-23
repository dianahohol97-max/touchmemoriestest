'use client';
import { useState, useEffect, use } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import DesignerProjectBlock from './DesignerProjectBlock';
import PrintSheetsCard from './PrintSheetsCard';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDateTime, formatDateOnly } from '@/lib/date-utils';
import { transliterateUk } from '@/lib/shipping/transliterate';
import { exportCommercialInvoicePDF, type SellerLegal } from '@/lib/export/invoice';
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

  // Load the customer's uploaded photos (designer orders) so the Files card
  // can show + download them. These live in order_files; the card previously
  // only had a manual Drive-link field, so uploads were invisible to staff.
  useEffect(() => {
    if (!order?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/designer/order-photos?order_id=${order.id}`);
        if (!res.ok) return;
        const { photos } = await res.json();
        if (!cancelled && Array.isArray(photos)) setUploadedFiles(photos);
      } catch { /* non-blocking */ }
    })();
    return () => { cancelled = true; };
  }, [order?.id]);

  // Download every uploaded photo at once as a single ZIP (built client-side
  // from the signed URLs). Cover is prefixed so it sorts first / is obvious.
  const downloadAllAsZip = async () => {
    if (!uploadedFiles.length || downloadingZip) return;
    setDownloadingZip(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const used = new Set<string>();
      let added = 0;
      await Promise.all(uploadedFiles.map(async (f: any) => {
        if (!f.url) return;
        try {
          const resp = await fetch(f.url);
          if (!resp.ok) return;
          const blob = await resp.blob();
          // Keep names unique and put the cover first alphabetically.
          let name = (f.isCover ? '000_ОБКЛАДИНКА_' : '') + (f.name || `photo_${added + 1}`);
          while (used.has(name)) name = `dup_${Math.random().toString(36).slice(2, 6)}_${name}`;
          used.add(name);
          zip.file(name, blob);
          added++;
        } catch { /* skip a single failed file */ }
      }));
      if (added === 0) { toast.error('Не вдалося завантажити файли'); return; }
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${order?.order_number || 'order'}_фото.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success(`Завантажено ${added} фото у ZIP`);
    } catch (e) {
      console.error('zip download failed', e);
      toast.error('Помилка створення ZIP');
    } finally {
      setDownloadingZip(false);
    }
  };
    const [saving, setSaving] = useState(false);
    const [notes, setNotes] = useState('');
    const [clientComment, setClientComment] = useState('');
    const [filesUrl, setFilesUrl] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
    const [downloadingZip, setDownloadingZip] = useState(false);
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
    const [intlTrackingValue, setIntlTrackingValue] = useState('');
    const [savingIntl, setSavingIntl] = useState(false);
    const [sellerLegal, setSellerLegal] = useState<SellerLegal>({});
    const [eurRateFallback, setEurRateFallback] = useState(0);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await supabase.from('settings').select('value').eq('key', 'seller_legal').maybeSingle();
                if (!cancelled && data?.value) setSellerLegal(data.value as SellerLegal);
            } catch { /* non-fatal */ }
            try {
                const r = await fetch('/api/exchange-rate').then(x => x.json());
                if (!cancelled && r?.rate) setEurRateFallback(r.rate);
            } catch { /* non-fatal */ }
        })();
        return () => { cancelled = true; };
    }, []);

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
            // Recognize both legacy payment_method='Післяплата'/'COD' and new payment_type='split'
            const isSplit = data.payment_type === 'split';
            const paymentIsCOD = isSplit
                || data.payment_method === 'Післяплата'
                || data.payment_method === 'COD';
            setTTNFormData({
                weight: 0.5,
                declaredValue: data.total || 0,
                // For split orders, use the server-computed cod_amount (= remaining 50%).
                // For legacy COD, default to full total. For neither, 0.
                codAmount: isSplit
                    ? Number(data.cod_amount || 0)
                    : (paymentIsCOD ? data.total : 0),
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

    const saveIntlTracking = async () => {
        const value = intlTrackingValue.trim();
        if (!value) { toast.error('Введіть міжнародний трек-номер'); return; }
        setSavingIntl(true);
        const { error } = await supabase
            .from('orders')
            .update({
                ttn: value,
                tracking_carrier: 'nova_poshta_intl',
                tracking_url: `https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(value)}`,
                order_status: order.order_status === 'new' || order.order_status === 'processing' ? 'shipped' : order.order_status,
            })
            .eq('id', id);
        if (!error) {
            toast.success('Міжнародний трек-номер збережено');
            fetchOrder();
        } else {
            toast.error('Помилка збереження');
        }
        setSavingIntl(false);
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
        try {
            const res = await fetch(`/api/admin/orders/${id}/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag_id: tagId }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `API ${res.status}`);
            }
            toast.success('Тег додано');
            fetchOrder();
        } catch (err) {
            console.error('Add tag failed:', err);
            toast.error('Помилка');
        }
    };

    const handleRemoveTag = async (tagId: string) => {
        try {
            const res = await fetch(`/api/admin/orders/${id}/tags`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag_id: tagId }),
            });
            if (!res.ok) throw new Error(`API ${res.status}`);
            toast.success('Тег видалено');
            fetchOrder();
        } catch (err) {
            console.error('Remove tag failed:', err);
            toast.error('Помилка');
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
    const isIntl = order.ship_region === 'INTL' || order.delivery_method === 'international';
    const addr = (order.delivery_address || {}) as any;

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
                            {order.items?.map((item: any, idx: number) => {
                                // Книга побажань: page count is a fixed 32. Older orders
                                // saved before this was enforced may carry "20 сторінок"
                                // (or lack the line). Normalise for display so the manager
                                // always sees the correct count.
                                const _isWishbook = /wish|guest|pobazhan/i.test(String(item.slug || '')) || /побажан/i.test(String(item.name || item.product_name || ''));
                                const normalizeOpts = (obj: Record<string, any> | undefined) => {
                                    if (!obj) return obj;
                                    if (!_isWishbook) return obj;
                                    const out: Record<string, any> = { ...obj };
                                    for (const k of Object.keys(out)) {
                                        if (/сторінок|сторінки|page/i.test(k) && !/колір|color/i.test(k)) out[k] = '32 сторінки';
                                    }
                                    return out;
                                };
                                const _selOpts = normalizeOpts(item.selected_options);
                                const _opts = normalizeOpts(item.options);
                                return (
                                <div key={idx} style={itemRowStyle}>
                                    <div style={itemThumbStyle}>
                                        {item.image ? <img src={item.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={24} color="#cbd5e1" />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: '16px' }}>
                                                    {item.name || item.product_name || 'Товар'}
                                                </div>
                                                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                                                    {/* selected_options — human readable */}
                                                    {_selOpts && Object.keys(_selOpts).length > 0
                                                        ? Object.entries(_selOpts).map(([k, v]) => `${k}: ${v}`).join(' • ')
                                                        : item.format
                                                        ? item.format
                                                        : Object.entries(_opts || {})
                                                            .filter(([k]) => !['Tier'].includes(k))
                                                            .map(([k, v]) => `${k}: ${v}`).join(' • ')
                                                    }
                                                </div>
                                                {(item.pages || item.qty > 1) && (
                                                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: 2 }}>
                                                        {item.pages ? `${item.pages} стор.` : ''}{item.pages && item.qty > 1 ? ' · ' : ''}{item.qty > 1 ? `${item.qty} шт` : ''}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: 900, fontSize: '16px' }}>
                                                    {((item.price || item.unit_price || 0) * (item.qty || item.quantity || 1)).toLocaleString()} ₴
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                                                    {item.qty || item.quantity || 1} шт × {item.price || item.unit_price || 0} ₴
                                                </div>
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
                                );
                            })}
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
                                {!(order.tracking_number || order.ttn) && !isIntl && (
                                    <button
                                        onClick={openTTNModal}
                                        style={{
                                            padding: '5px 10px',
                                            backgroundColor: '#22c55e',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 7,
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            flexShrink: 0,
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        <Plus size={12} /> ТТН
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
                                            {!isIntl && (
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
                                            )}
                                        </div>
                                        <a
                                            href={order.tracking_carrier && order.tracking_carrier !== 'nova_poshta'
                                                ? (order.tracking_url || `https://novaposhta.ua/tracking/?cargo_number=${order.ttn}`)
                                                : `https://novaposhta.ua/tracking/?cargo_number=${order.tracking_number || order.ttn}`}
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
                                            {order.tracking_carrier && order.tracking_carrier !== 'nova_poshta'
                                                ? <>Відстежити (міжнародна) <ExternalLink size={12} /></>
                                                : <>Відстежити на novaposhta.ua <ExternalLink size={12} /></>}
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

                            {/* Domestic Nova Poshta — city + branch / address. This was
                                only rendered for international orders before, so for
                                Ukrainian Нова Пошта orders the manager couldn't see where
                                to ship (city + warehouse). */}
                            {!isIntl && (addr.city || addr.branch || addr.warehouse || addr.address) && (
                                <div style={{ marginTop: 16, padding: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Truck size={15} /> Куди доставити
                                    </div>
                                    {(() => {
                                        const rows: [string, string][] = [
                                            ['Отримувач', order.customer_name || ''],
                                            ['Телефон', order.customer_phone || ''],
                                            ['Місто', addr.city || ''],
                                            ['Відділення / адреса', addr.branch || addr.warehouse || addr.address || ''],
                                        ].filter(([, v]) => v) as [string, string][];
                                        const block = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
                                        return (
                                            <div>
                                                {rows.map(([k, v]) => (
                                                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '4px 0', borderBottom: '1px solid #eef2f7' }}>
                                                        <span style={{ color: '#94a3b8' }}>{k}</span>
                                                        <span style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{v || '—'}</span>
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={() => { navigator.clipboard.writeText(block); toast.success('Дані доставки скопійовано'); }}
                                                    style={{ marginTop: 10, padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 7, background: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                                >
                                                    <Copy size={13} /> Скопіювати дані доставки
                                                </button>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {isIntl && (
                                <div style={{ marginTop: 16, padding: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        🌍 Міжнародне відправлення (Нова Пошта)
                                    </div>
                                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
                                        Накладну створюєш у кабінеті/відділенні Нової Пошти (міжнародна доставка). Дані нижче вже транслітеровані — скопіюй у заявку, потім встав отриманий трек-номер.
                                    </div>
                                    {(() => {
                                        const rows: [string, string][] = [
                                            ['Отримувач', transliterateUk(order.customer_name)],
                                            ['Країна', transliterateUk(addr.country)],
                                            ['Місто', transliterateUk(addr.city)],
                                            ['Індекс', addr.postal || ''],
                                            ['Адреса', transliterateUk(addr.address)],
                                            ['Телефон', (order.customer_phone || '').replace(/\s/g, '')],
                                            ['Опис (митниця)', 'Photo products / Photo book'],
                                            ['Вартість, UAH', String(order.total ?? '')],
                                        ];
                                        const block = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
                                        return (
                                            <div style={{ marginBottom: 12 }}>
                                                {rows.map(([k, v]) => (
                                                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, padding: '3px 0', borderBottom: '1px solid #eef2f7' }}>
                                                        <span style={{ color: '#94a3b8' }}>{k}</span>
                                                        <span style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{v || '—'}</span>
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={() => { navigator.clipboard.writeText(block); toast.success('Дані скопійовано'); }}
                                                    style={{ marginTop: 8, padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 7, background: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                                >
                                                    <Copy size={13} /> Скопіювати все
                                                </button>
                                                <button
                                                    onClick={() => { exportCommercialInvoicePDF(order, sellerLegal, eurRateFallback); }}
                                                    style={{ marginTop: 8, marginLeft: 8, padding: '6px 10px', border: 'none', borderRadius: 7, background: '#263A99', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                                >
                                                    <Receipt size={13} /> Інвойс (PDF)
                                                </button>
                                                {!sellerLegal.tax_id && (
                                                    <div style={{ marginTop: 6, fontSize: 11, color: '#b45309' }}>
                                                        ⚠ Додай РНОКПП у Налаштування → seller_legal, щоб інвойс був повним.
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                    {!order.ttn && (
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <input
                                                value={intlTrackingValue}
                                                onChange={e => setIntlTrackingValue(e.target.value)}
                                                placeholder="Міжнародний трек-номер"
                                                style={{ flex: 1, padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none' }}
                                            />
                                            <button
                                                onClick={saveIntlTracking}
                                                disabled={savingIntl}
                                                style={{ padding: '9px 14px', background: '#263A99', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: savingIntl ? 'wait' : 'pointer' }}
                                            >
                                                {savingIntl ? '...' : 'Зберегти'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
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

                            {/* Payment type summary (full vs split) */}
                            {order.payment_type && (
                                <div style={{
                                    marginBottom: 16,
                                    padding: 12,
                                    backgroundColor: order.payment_type === 'split' ? '#fffbeb' : '#f0fdf4',
                                    border: `1px solid ${order.payment_type === 'split' ? '#fde68a' : '#bbf7d0'}`,
                                    borderRadius: 4,
                                    fontSize: 13,
                                    lineHeight: 1.6,
                                }}>
                                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                                        {order.payment_type === 'split' ? '50% передоплата онлайн' : 'Повна оплата онлайн'}
                                    </div>
                                    <div>Передоплачено онлайн: <b>{order.prepaid_amount || 0} ₴</b></div>
                                    {Number(order.cod_amount) > 0 && (
                                        <div>Накладений (Нова Пошта): <b>{order.cod_amount} ₴</b></div>
                                    )}
                                    {Number(order.pickup_unpaid_balance) > 0 && (
                                        <div style={{ color: '#b45309' }}>
                                            При самовивозі взяти готівкою: <b>{order.pickup_unpaid_balance} ₴</b>
                                        </div>
                                    )}
                                    <div style={{ marginTop: 6, color: '#6b7280' }}>
                                        Усього: <b>{order.total} ₴</b>
                                    </div>
                                </div>
                            )}

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
                                                padding: '9px 14px',
                                                backgroundColor: '#22c55e',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: 8,
                                                fontSize: '13px',
                                                fontWeight: 700,
                                                cursor: creatingPaymentLink ? 'wait' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px',
                                                marginBottom: '12px'
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
                    {/* Team assignment first — it's the first action on a new order. */}
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
                            {order.creator && (
                                <div style={{ paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                                    <label style={smallLabelStyle}>Додав замовлення</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: order.creator.color || '#1e2d7d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                                            {order.creator.initials || order.creator.name?.charAt(0)}
                                        </div>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{order.creator.name}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <PrintSheetsCard orderId={order.id} />
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

                            {(order.customer_instagram || order.customers?.instagram) && (
                                <a href={`https://instagram.com/${(order.customer_instagram || order.customers?.instagram || '').replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={contactLinkStyle}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                                    @{(order.customer_instagram || order.customers?.instagram || '').replace('@', '')}
                                </a>
                            )}

                            {(order.customer_telegram || order.customers?.telegram) && (
                                <a href={`https://t.me/${(order.customer_telegram || order.customers?.telegram || '').replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={contactLinkStyle}>
                                    <Send size={16} /> {order.customer_telegram || order.customers?.telegram}
                                </a>
                            )}

                            {order.customer_birthday && (
                                <div style={contactLinkStyle}>
                                    <Calendar size={16} /> {formatDateOnly(order.customer_birthday)}
                                </div>
                            )}

                            <button onClick={() => setShowReplyModal(true)} style={{ ...contactLinkStyle, border: 'none', cursor: 'pointer', backgroundColor: '#eff6ff', color: '#263A99', width: '100%', textAlign: 'left' }}><MessageSquare size={16} /> Написати клієнту</button>
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
                                    const res = await fetch(`/api/admin/orders/${order.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ with_designer: true })
                                    });
                                    if (res.ok) {
                                        setOrder((o: any) => ({ ...o, with_designer: true }));
                                        toast.success('Дизайн увімкнено — замовлення зʼявилось у кабінеті дизайнера');
                                    } else {
                                        const d = await res.json();
                                        toast.error(d.error || 'Помилка');
                                    }
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
                        {uploadedFiles.length > 0 && (() => {
                            const covers = uploadedFiles.filter((f: any) => f.isCover);
                            const photos = uploadedFiles.filter((f: any) => !f.isCover);
                            const thumb = (f: any, big = false) => (
                                <a key={f.id} href={f.url || '#'} target="_blank" rel="noopener noreferrer" download={f.name}
                                    title={f.name}
                                    style={{ position: 'relative', display: 'block', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: big ? '2px solid #7c3aed' : '1px solid #e2e8f0', background: '#f8fafc' }}>
                                    {f.url
                                        ? <img src={f.url} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: '#cbd5e1' }}><FileText size={20} /></div>}
                                </a>
                            );
                            return (
                                <div style={{ marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                                        <label style={{ ...smallLabelStyle, margin: 0 }}>Завантажені клієнтом ({uploadedFiles.length})</label>
                                        <button onClick={downloadAllAsZip} disabled={downloadingZip}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: downloadingZip ? '#c4b5fd' : '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: downloadingZip ? 'default' : 'pointer' }}>
                                            {downloadingZip ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                            {downloadingZip ? 'Збираю ZIP…' : 'Завантажити всі (ZIP)'}
                                        </button>
                                    </div>

                                    {covers.length > 0 && (
                                        <div style={{ marginBottom: 12 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Обкладинка</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '8px' }}>
                                                {covers.map((f: any) => thumb(f, true))}
                                            </div>
                                        </div>
                                    )}

                                    {photos.length > 0 && (
                                        <div>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Фото клієнта ({photos.length})</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: '8px' }}>
                                                {photos.map((f: any) => thumb(f))}
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>Клік по фото — відкрити/завантажити оригінал. Ці фото також автоматично підтягуються в конструктор.</div>
                                </div>
                            );
                        })()}
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

                    {/* ===== TEXT BRIEF / MAGAZINE QUESTIONNAIRE ===== */}
                    {order?.text_brief && (
                        <div style={cardStyle}>
                            <div style={cardHeaderStyle}>
                                <h3 style={cardTitleStyle}><FileText size={20} /> Анкета журналу</h3>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: order.text_brief.package === 'premium' ? '#7c3aed22' : '#1e2d7d22', color: order.text_brief.package === 'premium' ? '#7c3aed' : '#1e2d7d' }}>
                                    {order.text_brief.package === 'premium' ? 'Преміум пакет' : 'Базовий пакет'}
                                </span>
                            </div>

                            {/* Cover photo */}
                            {order.text_brief.cover?.photo_path && (() => {
                                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yivfsicvaoewxrtkrfxr.supabase.co';
                                const photoUrl = `${supabaseUrl}/storage/v1/object/public/order-files/${order.text_brief.cover.photo_path}`;
                                return (
                                    <div style={{ marginBottom: 16 }}>
                                        <label style={smallLabelStyle}>Фото на обкладинку</label>
                                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 6 }}>
                                            <a href={photoUrl} target="_blank" rel="noopener noreferrer"
                                                style={{ display: 'block', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: '2px solid #7c3aed', flexShrink: 0 }}>
                                                <img src={photoUrl} alt="Фото на обкладинку" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </a>
                                            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                                                <div><b>Ім'я:</b> {order.text_brief.cover.name}</div>
                                                <div><b>Дата:</b> {order.text_brief.cover.date}</div>
                                                <div><b>Стиль:</b> {order.text_brief.cover.style}</div>
                                                {order.text_brief.cover.inscription && <div><b>Надпис:</b> {order.text_brief.cover.inscription}</div>}
                                                {order.text_brief.cover.era && <div><b>Епоха/настрій:</b> {order.text_brief.cover.era}</div>}
                                                {order.text_brief.cover.photo_note && <div style={{ color: '#f59e0b', fontWeight: 600 }}><b>Примітка до фото:</b> {order.text_brief.cover.photo_note}</div>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Cover data without photo */}
                            {!order.text_brief.cover?.photo_path && order.text_brief.cover && (
                                <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 12 }}>
                                    <label style={{ ...smallLabelStyle, marginBottom: 6 }}>Обкладинка</label>
                                    {order.text_brief.cover.name && <div><b>Ім'я:</b> {order.text_brief.cover.name}</div>}
                                    {order.text_brief.cover.date && <div><b>Дата:</b> {order.text_brief.cover.date}</div>}
                                    {order.text_brief.cover.style && <div><b>Стиль:</b> {order.text_brief.cover.style}</div>}
                                    {order.text_brief.cover.inscription && <div><b>Надпис:</b> {order.text_brief.cover.inscription}</div>}
                                    {order.text_brief.cover.era && <div><b>Епоха:</b> {order.text_brief.cover.era}</div>}
                                </div>
                            )}

                            {/* Questionnaire answers */}
                            {order.text_brief.answers && Object.keys(order.text_brief.answers).length > 0 && (
                                <div>
                                    <label style={{ ...smallLabelStyle, marginBottom: 8 }}>Відповіді на анкету</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {Object.entries(order.text_brief.answers).map(([key, value]: [string, any]) => {
                                            if (!value) return null;
                                            const labels: Record<string, string> = {
                                                recipient_name: "Ім'я отримувача",
                                                from: 'Від кого',
                                                birth_date: 'Дата народження',
                                                birth_place: 'Місце народження',
                                                sections: 'Розділи',
                                                habit: 'Звичка/риса',
                                                things_list: 'Список речей/спогадів',
                                                favourite_things: 'Улюблені речі',
                                                superpower_basic: 'Суперсила',
                                                superpower_premium: 'Суперсила (преміум)',
                                                childhood: 'Дитинство',
                                                values: 'Цінності',
                                                dreams: 'Мрії',
                                                fun_facts: 'Цікаві факти',
                                                love_story: 'Романтична історія',
                                            };
                                            return (
                                                <div key={key} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 12 }}>
                                                    <div style={{ fontWeight: 700, color: '#1e2d7d', marginBottom: 2, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        {labels[key] || key}
                                                    </div>
                                                    <div style={{ color: '#374151', lineHeight: 1.5 }}>{String(value)}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

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
                        <button onClick={sendReply} disabled={sendingReply} style={{ width: '100%', padding: '14px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: "3px", fontWeight: 800 }}>
                            {sendingReply ? <Loader2 className="animate-spin" /> : <Send size={18} />} Надіслати
                        </button>
                    </div>
                </div>
            )}

            {/* Nova Poshta TTN Creation Modal */}
            {showTTNModal && (
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

                        {(order.payment_type === 'split' || order.payment_method === 'Післяплата' || order.payment_method === 'COD') && (
                            <div style={{ marginBottom: '24px' }}>
                                <label style={smallLabelStyle}>Сума післяплати — накладений платіж (₴)</label>
                                <input
                                    type="number"
                                    value={ttnFormData.codAmount}
                                    onChange={e => setTTNFormData({ ...ttnFormData, codAmount: parseFloat(e.target.value) })}
                                    style={{ ...modalInputStyle, width: '100%' }}
                                />
                                {order.payment_type === 'split' && (
                                    <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                                        Клієнт обрав 50% передоплату. Сума накладеного платежу = решта 50% від замовлення.
                                        За замовчуванням підставлено {order.cod_amount} ₴ із замовлення.
                                    </p>
                                )}
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
                </div>
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
