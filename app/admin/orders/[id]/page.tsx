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
    RefreshCw,
    Palette
, Image as ImageIcon } from 'lucide-react';
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

  // Load the handwriting/display fonts used for cover inscriptions, so the
  // inscription preview in each order item renders in the real font (Marck
  // Script, Lobster, etc.) rather than a system fallback. One-time link inject.
  useEffect(() => {
    const id = 'inscription-fonts-admin';
    if (document.getElementById(id)) return;
    const fams = ['Marck Script', 'Montserrat', 'Philosopher', 'Lobster', 'Pacifico', 'Rubik', 'Nunito', 'Ubuntu']
      .map(f => `family=${f.replace(/ /g, '+')}:wght@400;600;700`).join('&');
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${fams}&display=swap`;
    document.head.appendChild(link);
  }, []);

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
  const downloadAllAsZip = async (subset?: any[], zipLabel?: string) => {
    const files = (subset && subset.length) ? subset : uploadedFiles;
    if (!files.length || downloadingZip) return;
    setDownloadingZip(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const used = new Set<string>();
      let added = 0;
      await Promise.all(files.map(async (f: any) => {
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
      a.download = `${order?.order_number || 'order'}_${zipLabel || 'фото'}.zip`;
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
    const [attachingOriginals, setAttachingOriginals] = useState(false);
    const [rerendering, setRerendering] = useState(false);
    const [checkingPayment, setCheckingPayment] = useState(false);
    const [cloningProject, setCloningProject] = useState(false);
    const [sendingPayLink, setSendingPayLink] = useState(false);
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
    const [isGenCover, setIsGenCover] = useState(false);

    // Generate (or regenerate) the wishbook cover.jpg fully server-side from the
    // order options. Lets staff produce/fix the print cover for a книга побажань
    // without depending on the customer's browser export.
    const generateWishbookCover = async (force = false) => {
        if (!order?.id) return;
        setIsGenCover(true);
        try {
            const res = await fetch(`/api/orders/${order.id}/generate-wishbook-cover${force ? '?force=1' : ''}`, { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.ok) {
                toast.success(data.skipped ? 'Обкладинка вже існує' : 'Обкладинку згенеровано');
                const pr = await fetch(`/api/designer/order-photos?order_id=${order.id}`);
                if (pr.ok) { const { photos } = await pr.json(); if (Array.isArray(photos)) setUploadedFiles(photos); }
                fetchOrder();
            } else {
                toast.error(`Не вдалося: ${data.error || res.status}${data.detail ? ` (${data.detail})` : ''}`);
            }
        } catch (e: any) {
            toast.error(`Помилка: ${e?.message || e}`);
        } finally {
            setIsGenCover(false);
        }
    };
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
            const resp = await fetch(`/api/admin/orders/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_status: newStatus, updated_at: new Date().toISOString() }),
            });
            if (!resp.ok) throw new Error((await resp.json().catch(() => ({})))?.error || 'Не вдалося оновити статус');

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
            const patch: Record<string, any> = { [role]: staffId || null };
            // Keep the two paths in sync: the designer cabinet only lists orders
            // where with_designer = true AND designer_id = me. So when a manager
            // assigns a designer here, also mark the order as a designer order —
            // otherwise the assigned designer would never see it in their
            // cabinet. (We don't clear with_designer when un-assigning, since the
            // order may have been a designer order from the start.)
            if (role === 'designer_id' && staffId) {
                patch.with_designer = true;
            }
            const { error } = await supabase
                .from('orders')
                .update(patch)
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

    // Production artwork for the inscription: black text on a white background,
    // high-res, for engraving / hot-stamping. The colour swatch preview is for
    // the customer; the workshop needs a clean B/W master to burn or press.
    const downloadInscriptionArtwork = (text: string, font: string, baseName: string, sizeLabel: string, format: 'png' | 'jpg' = 'png') => {
        try {
            // Square canvas matching the real 25×25 cm cover. 2500px = 250 DPI.
            const SIZE = 2500;
            const canvas = document.createElement('canvas');
            canvas.width = SIZE;
            canvas.height = SIZE;
            const ctx = canvas.getContext('2d');
            if (!ctx) { toast.error('Не вдалося створити макет'); return; }
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, SIZE, SIZE);
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // Font size must reflect the size the CUSTOMER chose (Малий /
            // Середній / Великий), as a fraction of the 25 cm cover — not just
            // the biggest that fits. We only shrink below the target if a long
            // text would overflow the safe width.
            const sizeFraction = /велик/i.test(sizeLabel) ? 0.16 : /мал/i.test(sizeLabel) ? 0.085 : 0.12; // середній default
            const safeWidth = SIZE * 0.86;
            let fontSize = Math.round(SIZE * sizeFraction);
            const setF = (s: number) => { ctx.font = `${s}px '${font || 'Marck Script'}', cursive`; };
            setF(fontSize);
            while (ctx.measureText(text).width > safeWidth && fontSize > 24) {
                fontSize -= 6; setF(fontSize);
            }
            ctx.fillText(text, SIZE / 2, SIZE / 2);
            const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
            canvas.toBlob((blob) => {
                if (!blob) { toast.error('Не вдалося створити макет'); return; }
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${baseName}.${format}`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            }, mime, format === 'jpg' ? 0.95 : undefined);
        } catch (e) {
            console.error('inscription artwork error', e);
            toast.error('Не вдалося створити макет');
        }
    };

    const saveNotes = async () => {
        setSaving(true);
        const resp = await fetch(`/api/admin/orders/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes, client_comment: clientComment }),
        });
        if (resp.ok) toast.success('Дані збережено');
        else toast.error('НЕ збережено — спробуйте ще раз');
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
            // Show the server's reason instead of a bare 'Помилка надсилання' —
            // an empty subject or a Brevo rejection used to look identical.
            const d = await res.json().catch(() => ({} as any));
            toast.error(d?.error ? `Не надіслано: ${d.error}` : 'Помилка надсилання');
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
        <div style={{ maxWidth: '1280px', margin: '0 auto', color: '#263A99', overflowX: 'clip' }}>
            {/* Top Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    <button onClick={() => router.back()} style={iconButtonStyle}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <h1 style={{ fontSize: 'clamp(20px, 5vw, 32px)', fontWeight: 900, fontFamily: 'var(--font-heading)' }}>Замовлення {order.order_number}</h1>
                            <span style={{ ...statusBadgeStyle, color: currentStatus.color, backgroundColor: currentStatus.bg }}>
                                {currentStatus.label}
                            </span>
                            {/* Design-flow badge: designer-made vs the customer's own
                                constructor layout — previously not shown anywhere, so
                                staff couldn't tell which flow an order came from. */}
                            <span style={{
                                ...statusBadgeStyle,
                                color: order.with_designer ? '#7c3aed' : '#0e7490',
                                backgroundColor: order.with_designer ? '#f5f3ff' : '#ecfeff',
                            }}>
                                {order.with_designer ? 'З дизайнером' : 'Самостійний макет'}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>

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
                                    const out: Record<string, any> = { ...obj };
                                    if (_isWishbook) {
                                        for (const k of Object.keys(out)) {
                                            if (/сторінок|сторінки|page/i.test(k) && !/колір|color/i.test(k)) out[k] = '32 сторінки';
                                        }
                                    }
                                    // Decoration sub-variants (acrylic size / photo-insert size) only make
                                    // sense for their matching decoration. When "Оздоблення" is
                                    // "Без оздоблення" (or another type), these carry stale default values
                                    // — that's the "Без оздоблення + Варіант акрилу + Варіант фотовставки"
                                    // contradiction. Hide the lines that don't match the chosen decoration.
                                    const decoKey = Object.keys(out).find(k => /оздоблен/i.test(k));
                                    const deco = decoKey ? String(out[decoKey]) : '';
                                    const isAcrylic = /акрил/i.test(deco);
                                    const isPhotoInsert = /фото|вставк/i.test(deco);
                                    for (const k of Object.keys(out)) {
                                        if (/варіант\s*акрил/i.test(k) && !isAcrylic) delete out[k];
                                        if (/варіант\s*фото/i.test(k) && !isPhotoInsert) delete out[k];
                                    }
                                    return out;
                                };
                                const _selOpts = normalizeOpts(item.selected_options);
                                const _opts = normalizeOpts(item.options);
                                // Pull inscription params out of the options so we can render a
                                // visual preview of the engraved/printed cover text — the manager
                                // and the workshop see roughly how "Щасливі моменти" will look
                                // (font, colour, size, on the chosen cover colour) instead of
                                // reading five separate parameter lines.
                                const allOpts = { ..._opts, ..._selOpts };
                                const findOpt = (re: RegExp) => {
                                    const k = Object.keys(allOpts).find(key => re.test(key));
                                    return k ? String(allOpts[k]) : '';
                                };
                                const inscrText = findOpt(/текст напису/i);
                                const inscrColorLabel = findOpt(/колір напису/i);
                                const inscrFont = findOpt(/шрифт напису/i);
                                const inscrSizeLabel = findOpt(/розмір напису/i);
                                const coverColorLabel = findOpt(/колір обкладинки/i);
                                const inscrColorHex = ({
                                    'золотий': '#C9A24B', 'срібний': '#C7CBD1', 'білий': '#FFFFFF', 'чорний': '#1A1A1A',
                                }[inscrColorLabel.toLowerCase()] || '#C9A24B');
                                const coverColorHex = ({
                                    'зелений': '#3f5e50', 'чорний': '#1A1A1A', 'синій': '#26364f', 'бордовий': '#5e2a30',
                                    'сірий': '#6b6f76', 'бежевий': '#c9b79c', 'рожевий': '#c98a95', 'білий': '#e8e6e1',
                                    'коричневий': '#5a4634', 'фіолетовий': '#4a3a5c',
                                }[coverColorLabel.toLowerCase()] || '#6f675c');
                                const inscrSizePx = /велик/i.test(inscrSizeLabel) ? 34 : /мал/i.test(inscrSizeLabel) ? 20 : 26;
                                return (
                                <div key={idx} style={itemRowStyle}>
                                    <div style={itemThumbStyle}>
                                        {item.image ? <img src={item.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={24} color="#cbd5e1" />}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                                            <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
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
                                                {Array.isArray(item.price_breakdown) && item.price_breakdown.length > 0 && (
                                                    <div style={{ fontSize: 12, color: '#475569', marginTop: 6, background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 8, padding: '6px 10px', display: 'inline-block' }}>
                                                        {item.price_breakdown.map((b: any, bi: number) => (
                                                            <div key={bi} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                                                                <span>{b.label}</span>
                                                                <span style={{ fontWeight: 700 }}>{bi === 0 ? '' : '+'}{Number(b.amount).toLocaleString()} ₴</span>
                                                            </div>
                                                        ))}
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

                                        {inscrText && (
                                            <div style={{ marginTop: 12 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                                                    <Palette size={12} /> Напис на обкладинці
                                                </div>
                                                {/* Two side-by-side previews: colour (what the customer sees)
                                                    and the B/W production master (what the workshop needs). */}
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                                                    <div>
                                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>Як бачить клієнт</div>
                                                        <div style={{
                                                            width: '100%', minHeight: 92, borderRadius: 10,
                                                            background: coverColorHex,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            padding: '18px 16px', boxShadow: 'inset 0 0 30px rgba(0,0,0,0.28)',
                                                        }}>
                                                            <span style={{
                                                                fontFamily: `'${inscrFont || 'Marck Script'}', cursive`,
                                                                fontSize: inscrSizePx, color: inscrColorHex, lineHeight: 1.2,
                                                                textAlign: 'center', wordBreak: 'break-word',
                                                                textShadow: inscrColorHex.toLowerCase() === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
                                                            }}>
                                                                {inscrText}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>Макет для нанесення · 25×25 см</div>
                                                        <div style={{
                                                            width: '100%', aspectRatio: '1 / 1', borderRadius: 10,
                                                            background: '#ffffff', border: '1px solid #e2e8f0',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            padding: '10px', overflow: 'hidden',
                                                        }}>
                                                            <span style={{
                                                                fontFamily: `'${inscrFont || 'Marck Script'}', cursive`,
                                                                fontSize: inscrSizePx, color: '#000000', lineHeight: 1.2,
                                                                textAlign: 'center', whiteSpace: 'nowrap',
                                                            }}>
                                                                {inscrText}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, flexWrap: 'wrap', gap: 8 }}>
                                                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                                                        {inscrFont && `${inscrFont}`}{inscrColorLabel && ` · ${inscrColorLabel}`}{inscrSizeLabel && ` · ${inscrSizeLabel}`}{coverColorLabel && ` · обкладинка ${coverColorLabel.toLowerCase()}`}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                        <button
                                                            onClick={() => downloadInscriptionArtwork(inscrText, inscrFont, `napys_${order.order_number || 'order'}_poz${idx + 1}`, inscrSizeLabel, 'png')}
                                                            style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                                                fontSize: 12, fontWeight: 700, color: '#1e2d7d',
                                                                padding: '6px 12px', background: '#eef2ff', border: 'none',
                                                                borderRadius: 8, cursor: 'pointer',
                                                            }}
                                                        >
                                                            <Download size={13} /> PNG
                                                        </button>
                                                        <button
                                                            onClick={() => downloadInscriptionArtwork(inscrText, inscrFont, `napys_${order.order_number || 'order'}_poz${idx + 1}`, inscrSizeLabel, 'jpg')}
                                                            style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                                                fontSize: 12, fontWeight: 700, color: '#1e2d7d',
                                                                padding: '6px 12px', background: '#eef2ff', border: 'none',
                                                                borderRadius: 8, cursor: 'pointer',
                                                            }}
                                                        >
                                                            <Download size={13} /> JPG
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

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
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
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
                                         Міжнародне відправлення (Нова Пошта)
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
                                    <div>{order.payment_status === 'paid' ? 'Передоплачено онлайн' : 'До передоплати онлайн (не сплачено)'}: <b>{order.prepaid_amount || 0} ₴</b></div>
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
                                            {order.payment_status !== 'paid' && (
                                                <button
                                                    onClick={async () => {
                                                        setSendingPayLink(true);
                                                        try {
                                                            const r = await fetch(`/api/admin/orders/${id}/send-payment-link`, { method: 'POST' });
                                                            const j = await r.json();
                                                            if (r.ok) toast.success(j.message || 'Лист надіслано');
                                                            else toast.error(j.error || 'Не вдалося надіслати');
                                                        } catch { toast.error('Не вдалося надіслати'); }
                                                        setSendingPayLink(false);
                                                    }}
                                                    disabled={sendingPayLink}
                                                    title="Надішле клієнту лист із кнопкою «Оплатити замовлення»"
                                                    style={{ marginTop: 8, width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                        padding: '9px 12px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 8,
                                                        fontSize: 13, fontWeight: 700, cursor: sendingPayLink ? 'default' : 'pointer' }}>
                                                    {sendingPayLink ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                                    Надіслати посилання клієнту
                                                </button>
                                            )}
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
                                    padding: '12px',
                                    backgroundColor: '#f8fafc',
                                    borderRadius: 6,
                                    fontSize: '12px',
                                    color: '#475569',
                                    border: '1px solid #e2e8f0',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <span style={{ fontWeight: 800, color: '#0f172a' }}>Monobank</span>
                                        {order.monobank_invoice_status && (
                                            <span style={{
                                                fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                                                backgroundColor: order.monobank_invoice_status === 'success' ? '#f0fdf4' : '#fffbeb',
                                                color: order.monobank_invoice_status === 'success' ? '#16a34a' : '#d97706',
                                            }}>
                                                {order.monobank_invoice_status.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                        <span style={{ color: '#94a3b8' }}>Invoice ID:</span>
                                        <code style={{ fontSize: 11, background: '#fff', padding: '2px 6px', borderRadius: 4, border: '1px solid #e2e8f0', wordBreak: 'break-all' }}>{order.monobank_invoice_id}</code>
                                        <button
                                            onClick={() => { navigator.clipboard?.writeText(order.monobank_invoice_id); }}
                                            title="Копіювати Invoice ID"
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 2, display: 'flex' }}
                                        ><Copy size={13} /></button>
                                    </div>
                                    {order.paid_at && (
                                        <div style={{ marginBottom: 8 }}>
                                            <span style={{ color: '#94a3b8' }}>Оплачено:</span>{' '}
                                            <b>{new Date(order.paid_at).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</b> (Київ)
                                        </div>
                                    )}
                                    <a
                                        href="https://web.monobank.ua/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                            fontSize: 12, fontWeight: 700, color: '#1e2d7d', textDecoration: 'none',
                                            padding: '6px 10px', background: '#eef2ff', borderRadius: 6,
                                        }}
                                    >
                                        <ExternalLink size={13} /> Перевірити в кабінеті Monobank
                                    </a>
                                    {order.payment_status !== 'paid' && (
                                        <button
                                            onClick={async () => {
                                                setCheckingPayment(true);
                                                try {
                                                    const r = await fetch(`/api/admin/orders/${id}/check-payment`, { method: 'POST' });
                                                    const j = await r.json();
                                                    if (j.status === 'paid') { toast.success(j.message); fetchOrder(); }
                                                    else toast.info(j.message || j.error || 'Не вдалося перевірити');
                                                } catch { toast.error('Помилка перевірки'); }
                                                setCheckingPayment(false);
                                            }}
                                            disabled={checkingPayment}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 8,
                                                fontSize: 12, fontWeight: 700, color: '#fff', border: 'none', cursor: checkingPayment ? 'default' : 'pointer',
                                                padding: '6px 10px', background: '#16a34a', borderRadius: 6,
                                            }}
                                        >
                                            {checkingPayment ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Перевірити оплату зараз
                                        </button>
                                    )}
                                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, lineHeight: 1.5 }}>
                                        «Success» означає що банк підтвердив оплату. Кошти на розрахунковий рахунок Monobank зазвичай зараховує наступного банківського дня — знайдіть транзакцію за Invoice ID або сумою/часом у кабінеті.
                                    </div>
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
                                    <div style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>Дизайн від дизайнера</div>
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
                        {(() => {
                            const orderIsWishbook = Array.isArray(order?.items) && order.items.some((it: any) =>
                                /wish|guest|pobazhan/i.test(String(it.slug || '')) || /побажан/i.test(String(it.name || it.product_name || '')));
                            if (!orderIsWishbook) return null;
                            const hasCover = uploadedFiles.some((f: any) => f.isCover || /cover\.jpg/i.test(String(f.name || '')));
                            return (
                                <div style={{ marginBottom: '12px', padding: '12px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '12px', color: '#6b21a8', marginBottom: '8px', fontWeight: 600 }}>
                                        Обкладинка книги побажань генерується на сервері з параметрів замовлення.
                                    </div>
                                    <button onClick={() => generateWishbookCover(hasCover)} disabled={isGenCover}
                                        style={{ padding: '10px 18px', backgroundColor: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center', opacity: isGenCover ? 0.6 : 1, fontSize: '13px' }}>
                                        {isGenCover ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                        {hasCover ? 'Перегенерувати обкладинку' : 'Згенерувати обкладинку'}
                                    </button>
                                </div>
                            );
                        })()}
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
                            const exportFiles = uploadedFiles.filter((f: any) => f.isExport);
                            const covers = uploadedFiles.filter((f: any) => !f.isExport && f.isCover);
                            const isOriginal = (f: any) => (f.category || '').toLowerCase() === 'original';
                            const originals = uploadedFiles.filter((f: any) => !f.isExport && !f.isCover && isOriginal(f));
                            const photos = uploadedFiles.filter((f: any) => !f.isExport && !f.isCover && !isOriginal(f));
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
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                                        <label style={{ ...smallLabelStyle, margin: 0 }}>Файли замовлення ({uploadedFiles.length})</label>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        <button
                                            onClick={async () => {
                                                setCloningProject(true);
                                                try {
                                                    const r = await fetch(`/api/admin/orders/${id}/clone-project-to-me`, { method: 'POST' });
                                                    const j = await r.json();
                                                    if (r.ok) toast.success(j.message || 'Скопійовано у ваші чернетки');
                                                    else toast.info(j.error || 'Макет не знайдено');
                                                } catch { toast.error('Не вдалося скопіювати'); }
                                                setCloningProject(false);
                                            }}
                                            disabled={cloningProject}
                                            title="Скопіює макет клієнта (розстановку і фото) у ВАШІ чернетки конструктора — для переекспорту без участі клієнта"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#fff', color: '#0891b2', border: '1.5px solid #0891b2', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: cloningProject ? 'default' : 'pointer' }}>
                                            {cloningProject ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                                            Макет → мої чернетки
                                        </button>
                                        <button
                                            onClick={async () => {
                                                setAttachingOriginals(true);
                                                try {
                                                    const r = await fetch(`/api/admin/orders/${id}/attach-originals`, { method: 'POST' });
                                                    const j = await r.json();
                                                    if (r.ok && j.attached > 0) { toast.success(`Додано оригіналів: ${j.attached}`); fetchOrder(); }
                                                    else toast.info(j.message || j.error || 'Оригінали не знайдено');
                                                } catch { toast.error('Не вдалося підтягнути оригінали'); }
                                                setAttachingOriginals(false);
                                            }}
                                            disabled={attachingOriginals}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#fff', color: '#7c3aed', border: '1.5px solid #7c3aed', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: attachingOriginals ? 'default' : 'pointer' }}>
                                            {attachingOriginals ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                                            Підтягнути оригінали
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (!confirm('Перегенерувати макет для друку через Railway? Це створить різкі файли з повних оригіналів (без тех-знаків). Може зайняти 1–2 хв.')) return;
                                                setRerendering(true);
                                                try {
                                                    const r = await fetch(`/api/admin/orders/${id}/rerender`, { method: 'POST' });
                                                    const j = await r.json();
                                                    if (r.ok) {
                                                        toast.success('Рендер запущено — файли оновляться за 1–2 хв');
                                                        setTimeout(() => fetchOrder(), 90000);
                                                    }
                                                    else toast.error(j.error || 'Не вдалося перегенерувати');
                                                } catch { toast.error('Не вдалося перегенерувати'); }
                                                setRerendering(false);
                                            }}
                                            disabled={rerendering}
                                            title="Серверний рендер через Railway: повні оригінали, 300 DPI, без редакторських тех-знаків. Не потребує участі клієнта."
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#fff', color: '#ea580c', border: '1.5px solid #ea580c', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: rerendering ? 'default' : 'pointer' }}>
                                            {rerendering ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                            {rerendering ? 'Рендериться…' : 'Перегенерувати макет (Railway)'}
                                        </button>
                                        <button onClick={() => downloadAllAsZip()} disabled={downloadingZip}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: downloadingZip ? '#c4b5fd' : '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: downloadingZip ? 'default' : 'pointer' }}>
                                            {downloadingZip ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                            {downloadingZip ? 'Збираю ZIP…' : 'Завантажити всі (ZIP)'}
                                        </button>
                                        </div>
                                    </div>

                                    {exportFiles.length > 0 && (
                                        <div style={{ marginBottom: 12, padding: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                                                <Printer size={13} /> Макет для друку ({exportFiles.length}) · готовий
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '8px' }}>
                                                {exportFiles.map((f: any) => thumb(f, true))}
                                            </div>
                                        </div>
                                    )}

                                    {originals.length > 0 && (
                                        <div style={{ marginBottom: 12, padding: 10, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 5 }}>
                                                    <ImageIcon size={13} /> Оригінали фото клієнта ({originals.length})
                                                </div>
                                                <button onClick={() => downloadAllAsZip(originals, 'оригінали')} disabled={downloadingZip}
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: downloadingZip ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: downloadingZip ? 'default' : 'pointer' }}>
                                                    {downloadingZip ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                                                    Оригінали (ZIP)
                                                </button>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: '8px' }}>
                                                {originals.map((f: any) => thumb(f))}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>Повнорозмірні оригінали, завантажені клієнтом. Клік по фото — завантажити оригінал.</div>
                                        </div>
                                    )}

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

                                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>Клік по файлу — відкрити/завантажити оригінал. Фото клієнта також підтягуються в конструктор.</div>
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

                            {/* Cover photo — order-files is a PRIVATE bucket, so a
                                /object/public/ URL returns 400 and the thumbnail broke
                                (TM-001037). Sign the path instead. */}
                            {order.text_brief.cover?.photo_path && (
                                <BriefCoverPhoto photoPath={order.text_brief.cover.photo_path} cover={order.text_brief.cover} smallLabelStyle={smallLabelStyle} supabase={supabase} />
                            )}

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
                                                fullname: "Ім'я та прізвище",
                                                birth_full: 'Дата, час і місто народження',
                                                work: 'Робота',
                                                hobbies: 'Хобі та захоплення',
                                                travel: 'Подорожі',
                                                character: 'Характер',
                                                style: 'Стиль одягу',
                                                facts: 'Цікаві факти',
                                                associations: 'Асоціації',
                                                dream: 'Про що мріє',
                                                food: 'Їжа та напої',
                                                superpower_prem: 'У чому сила',
                                                extra_article: 'Персоналізована стаття',
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
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

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
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

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
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

// Brief cover photo with a SIGNED url — order-files is a private bucket, so
// the old hard-coded /object/public/ link 400'd and the thumbnail was broken.
function BriefCoverPhoto({ photoPath, cover, smallLabelStyle, supabase }: { photoPath: string; cover: any; smallLabelStyle: any; supabase: any }) {
    const [url, setUrl] = useState<string>('');
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await supabase.storage.from('order-files').createSignedUrl(photoPath, 60 * 60);
                if (!cancelled && data?.signedUrl) setUrl(data.signedUrl);
            } catch { /* keep placeholder */ }
        })();
        return () => { cancelled = true; };
    }, [photoPath]); // eslint-disable-line react-hooks/exhaustive-deps
    return (
        <div style={{ marginBottom: 16 }}>
            <label style={smallLabelStyle}>Фото на обкладинку</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 6 }}>
                {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'block', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: '2px solid #7c3aed', flexShrink: 0 }}>
                        <img src={url} alt="Фото на обкладинку" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </a>
                ) : (
                    <div style={{ width: 80, height: 80, borderRadius: 8, border: '2px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }} />
                )}
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                    <div><b>Ім'я:</b> {cover.name}</div>
                    <div><b>Дата:</b> {cover.date}</div>
                    <div><b>Стиль:</b> {cover.style}</div>
                    {cover.inscription && <div><b>Надпис:</b> {cover.inscription}</div>}
                    {cover.era && <div><b>Епоха/настрій:</b> {cover.era}</div>}
                    {cover.photo_note && <div style={{ color: '#f59e0b', fontWeight: 600 }}><b>Примітка до фото:</b> {cover.photo_note}</div>}
                </div>
            </div>
        </div>
    );
}
