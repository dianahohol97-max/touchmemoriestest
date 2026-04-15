'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import Link from 'next/link';
import {
    ShoppingBag, Heart, BookOpen, User, LogOut, Save,
    Trash2, Package, ChevronRight, RotateCw, Pencil,
    ExternalLink, Clock, CheckCircle2, Truck, Star,
    MapPin, Phone, Mail, Calendar, FileText, Layers,
    ShoppingCart, AlertCircle, XCircle, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/context';
import { useCartStore } from '@/store/cart-store';

//  Types 

type Tab = 'orders' | 'designs' | 'wishlist' | 'profile';

interface Order {
    id: string;
    order_number: string;
    order_status: string;
    payment_status: string;
    total: number;
    created_at: string;
    items: any[];
    customer_name?: string;
    delivery_address?: string;
    tracking_number?: string;
}

interface Design {
    id: string;
    title?: string;
    name?: string;
    product_type?: string;
    format?: string;
    status: string;
    updated_at: string;
    thumbnail_url?: string;
    source: 'editor' | 'designer';
}

//  Status config 

const ORDER_STATUSES = [
    { key: 'pending',       label: 'Нове',           icon: Clock,         color: '#3b82f6', bg: '#eff6ff',   step: 0 },
    { key: 'confirmed',     label: 'Підтверджено',   icon: CheckCircle2,  color: '#14b8a6', bg: '#f0fdfa',   step: 1 },
    { key: 'in_production', label: 'У виробництві',  icon: Layers,        color: '#f59e0b', bg: '#fffbeb',   step: 2 },
    { key: 'shipped',       label: 'Відправлено',    icon: Truck,         color: '#8b5cf6', bg: '#f5f3ff',   step: 3 },
    { key: 'delivered',     label: 'Доставлено',     icon: Star,          color: '#10b981', bg: '#ecfdf5',   step: 4 },
    { key: 'cancelled',     label: 'Скасовано',      icon: XCircle,       color: '#ef4444', bg: '#fef2f2',   step: -1 },
    { key: 'new',           label: 'Нове',           icon: Clock,         color: '#3b82f6', bg: '#eff6ff',   step: 0 },
];

const DESIGN_STATUSES: Record<string, { label: string; color: string; bg: string }> = {
    draft:       { label: 'Чернетка',        color: '#64748b', bg: '#f1f5f9' },
    in_review:   { label: 'На розгляді',     color: '#f59e0b', bg: '#fffbeb' },
    approved:    { label: 'Затверджено',     color: '#10b981', bg: '#ecfdf5' },
    rejected:    { label: 'На доопрацюванні',color: '#ef4444', bg: '#fef2f2' },
};

function getOrderStatus(key: string) {
    return ORDER_STATUSES.find(s => s.key === key) || ORDER_STATUSES[0];
}

//  Component 

export default function AccountPage() {
    const supabase = createClient();
    const router = useRouter();
    const t = useT();
    const addItems = useCartStore(s => s.addItems);

    const [tab, setTab] = useState<Tab>('orders');
    const [user, setUser] = useState<any>(null);
    const [customer, setCustomer] = useState<any>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [designs, setDesigns] = useState<Design[]>([]);
    const [wishlist, setWishlist] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [repeatingId, setRepeatingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        first_name: '', last_name: '', phone: '', birthday: '', email_subscribed: false
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/login'); return; }
            setUser(session.user);

            const email = session.user.email!;
            const uid = session.user.id;

            // Fetch all data in parallel
            const [custRes, ordersRes, wishRes, editorRes, designerRes] = await Promise.all([
                supabase.from('customers').select('*').eq('email', email).single(),
                supabase.from('orders')
                    .select('id,order_number,order_status,payment_status,total,created_at,items,customer_name,delivery_address,tracking_number')
                    .or(`customer_email.eq.${email},customer_id.eq.${uid}`)
                    .order('created_at', { ascending: false }),
                supabase.from('wishlists').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
                supabase.from('projects').select('id,name,product_type,format,status,updated_at').eq('user_id', uid).order('updated_at', { ascending: false }).limit(20),
                supabase.from('customer_projects').select('id,title,product_type,status,updated_at,thumbnail_url')
                    .in('customer_id', (await supabase.from('customers').select('id').eq('email', email)).data?.map((c: any) => c.id) || [])
                    .order('updated_at', { ascending: false }).limit(20),
            ]);

            if (custRes.data) {
                setCustomer(custRes.data);
                setFormData({
                    first_name: custRes.data.first_name || '',
                    last_name:  custRes.data.last_name  || '',
                    phone:      custRes.data.phone      || '',
                    birthday:   custRes.data.birthday   || '',
                    email_subscribed: custRes.data.email_subscribed || false,
                });
            }

            if (ordersRes.data) setOrders(ordersRes.data);
            if (wishRes.data) setWishlist(wishRes.data);

            // Merge editor + designer projects
            const editorDesigns: Design[] = (editorRes.data || []).map((p: any) => ({
                id: p.id, name: p.name, product_type: p.product_type, format: p.format,
                status: p.status || 'draft', updated_at: p.updated_at, source: 'editor' as const,
            }));
            const designerDesigns: Design[] = (designerRes.data || []).map((p: any) => ({
                id: p.id, title: p.title, product_type: p.product_type,
                status: p.status || 'draft', updated_at: p.updated_at,
                thumbnail_url: p.thumbnail_url, source: 'designer' as const,
            }));
            setDesigns([...editorDesigns, ...designerDesigns].sort((a, b) =>
                new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            ));

            setIsLoading(false);
        };
        init();
    }, []);

    const logout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    const removeWishlist = async (id: string) => {
        await supabase.from('wishlists').delete().eq('id', id);
        setWishlist(prev => prev.filter(w => w.id !== id));
        toast.success('Видалено зі списку бажань');
    };

    const saveProfile = async () => {
        setIsSaving(true);
        try {
            await supabase.from('customers').update(formData).eq('email', user.email);
            toast.success('Зміни збережено ');
        } catch { toast.error('Помилка збереження'); }
        setIsSaving(false);
    };

    const repeatOrder = async (order: Order) => {
        if (!order.items?.length) { toast.error('Немає товарів для повторення'); return; }
        setRepeatingId(order.id);
        addItems(order.items.map((item: any) => ({
            id: item.product_id || String(Math.random()),
            name: item.name, price: item.price,
            qty: item.qty || 1, image: item.image || '',
        })));
        toast.success('Товари додано до кошика →');
        router.push('/cart');
        setRepeatingId(null);
    };

    //  Loading 
    if (isLoading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
            <Loader2 size={36} color="#263a99" style={{ animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    const displayName = formData.first_name || user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'Друже';
    const initials = (displayName[0] || 'U').toUpperCase();
    const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;

    const TABS: { id: Tab; icon: React.ReactNode; label: string; count?: number }[] = [
        { id: 'orders',  icon: <ShoppingBag size={17}/>, label: 'Замовлення', count: orders.length },
        { id: 'designs', icon: <FileText size={17}/>,    label: 'Мої дизайни', count: designs.length },
        { id: 'wishlist',icon: <Heart size={17}/>,       label: 'Вішлист',    count: wishlist.length },
        { id: 'profile', icon: <User size={17}/>,        label: 'Профіль' },
    ];

    //  Render 
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f1f5f9' }}>
            <Navigation />
            <main style={{ flex: 1, paddingTop: 100, paddingBottom: 80 }}>
                <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 20px', display: 'flex', gap: 28, alignItems: 'flex-start' }}>

                    {/*  SIDEBAR  */}
                    <aside style={{ width: 260, flexShrink: 0, position: 'sticky', top: 112 }}>

                        {/* User card */}
                        <div style={{ background: 'linear-gradient(135deg, #1e2d7d 0%, #263a99 100%)', borderRadius: 16, padding: '28px 24px', marginBottom: 12, color: 'white', boxShadow: '0 8px 32px rgba(30,45,125,0.22)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt={displayName} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)' }} />
                                ) : (
                                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>
                                        {initials}
                                    </div>
                                )}
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 2 }}>Привіт, {displayName}! </div>
                                    <div style={{ fontSize: 12, opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
                                </div>
                            </div>

                            {/* Mini stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                {[
                                    { label: 'Замовлень', value: orders.length },
                                    { label: 'Дизайнів',  value: designs.length },
                                ].map(stat => (
                                    <div key={stat.label} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                                        <div style={{ fontSize: 22, fontWeight: 900 }}>{stat.value}</div>
                                        <div style={{ fontSize: 11, opacity: 0.8, marginTop: 1 }}>{stat.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Nav */}
                        <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e9edf5' }}>
                            {TABS.map((item, i) => (
                                <button key={item.id}
                                    onClick={() => setTab(item.id)}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
                                        background: tab === item.id ? '#eff3ff' : 'transparent',
                                        color: tab === item.id ? '#263a99' : '#475569',
                                        border: 'none', borderTop: i > 0 ? '1px solid #f1f5f9' : 'none',
                                        cursor: 'pointer', fontWeight: tab === item.id ? 800 : 600,
                                        fontSize: 14, transition: 'all 0.15s', textAlign: 'left',
                                        borderLeft: tab === item.id ? '3px solid #263a99' : '3px solid transparent',
                                    }}>
                                    {item.icon}
                                    <span style={{ flex: 1 }}>{item.label}</span>
                                    {item.count !== undefined && (
                                        <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                            background: tab === item.id ? '#263a99' : '#e2e8f0',
                                            color: tab === item.id ? 'white' : '#64748b' }}>
                                            {item.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                            <button onClick={logout}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', background: 'transparent', color: '#ef4444', border: 'none', borderTop: '1px solid #f1f5f9', cursor: 'pointer', fontWeight: 600, fontSize: 14, textAlign: 'left', borderLeft: '3px solid transparent' }}>
                                <LogOut size={17} /> Вийти
                            </button>
                        </div>
                    </aside>

                    {/*  MAIN CONTENT  */}
                    <div style={{ flex: 1, minWidth: 0 }}>

                        {/*  ORDERS  */}
                        {tab === 'orders' && (
                            <div>
                                <SectionHeader icon={<ShoppingBag size={20}/>} title="Мої замовлення" sub={`${orders.length} замовлень`} />
                                {orders.length === 0 ? (
                                    <Empty icon={<ShoppingBag size={40} color="#94a3b8"/>} title="Замовлень ще немає" sub="Після першого замовлення все відображатиметься тут" cta="До каталогу" href="/catalog" />
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        {orders.map(order => {
                                            const st = getOrderStatus(order.order_status);
                                            const StatusIcon = st.icon;
                                            const isExpanded = expandedOrder === order.id;
                                            const itemCount = Array.isArray(order.items) ? order.items.reduce((a: number, i: any) => a + (i.qty || 1), 0) : 0;

                                            return (
                                                <div key={order.id} style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e9edf5' }}>
                                                    {/* Header row */}
                                                    <div style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                                                        onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                                                        {/* Status icon */}
                                                        <div style={{ width: 42, height: 42, borderRadius: '50%', background: st.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            <StatusIcon size={20} color={st.color} />
                                                        </div>

                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                                                                <span style={{ fontWeight: 800, color: '#263a99', fontSize: 15 }}>№{order.order_number}</span>
                                                                <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: st.bg, color: st.color }}>
                                                                    {st.label}
                                                                </span>
                                                                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                                                                    background: order.payment_status === 'paid' ? '#ecfdf5' : '#fffbeb',
                                                                    color: order.payment_status === 'paid' ? '#10b981' : '#f59e0b' }}>
                                                                    {order.payment_status === 'paid' ? ' Оплачено' : '⏳ Очікує оплати'}
                                                                </span>
                                                            </div>
                                                            <div style={{ fontSize: 12, color: '#94a3b8' }}>
                                                                {new Date(order.created_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                                {itemCount > 0 && ` · ${itemCount} ${itemCount === 1 ? 'товар' : 'товари'}`}
                                                            </div>
                                                        </div>

                                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                            <div style={{ fontWeight: 900, color: '#263a99', fontSize: 20 }}>{order.total} ₴</div>
                                                            <ChevronRight size={16} color="#94a3b8" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: '0.2s', marginTop: 2 }} />
                                                        </div>
                                                    </div>

                                                    {/* Status progress bar */}
                                                    {order.order_status !== 'cancelled' && (
                                                        <div style={{ padding: '0 22px 18px' }}>
                                                            <StatusProgress currentStep={st.step} />
                                                        </div>
                                                    )}

                                                    {/* Expanded details */}
                                                    {isExpanded && (
                                                        <div style={{ borderTop: '1px solid #f1f5f9', padding: '18px 22px' }}>
                                                            {/* Items */}
                                                            {Array.isArray(order.items) && order.items.length > 0 && (
                                                                <div style={{ marginBottom: 16 }}>
                                                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Склад замовлення</div>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                                        {order.items.map((item: any, idx: number) => (
                                                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 10 }}>
                                                                                <div style={{ width: 44, height: 44, borderRadius: 8, background: '#e9edf5', flexShrink: 0, overflow: 'hidden' }}>
                                                                                    {item.image ? <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <Package size={20} color="#94a3b8" style={{ margin: 12 }}/>}
                                                                                </div>
                                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                                                                                    {item.options && Object.keys(item.options).length > 0 && (
                                                                                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                                                                                            {Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                                                    <div style={{ fontWeight: 800, fontSize: 14, color: '#263a99' }}>{item.price} ₴</div>
                                                                                    <div style={{ fontSize: 11, color: '#94a3b8' }}>×{item.qty || 1}</div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Tracking */}
                                                            {order.tracking_number && (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f0f4ff', borderRadius: 10, marginBottom: 12 }}>
                                                                    <Truck size={16} color="#263a99"/>
                                                                    <span style={{ fontSize: 13, color: '#263a99', fontWeight: 700 }}>ТТН: {order.tracking_number}</span>
                                                                </div>
                                                            )}

                                                            {/* Actions */}
                                                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                                                <Link href={`/track?order=${order.order_number}`}
                                                                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', border: '1.5px solid #263a99', borderRadius: 8, color: '#263a99', textDecoration: 'none', fontWeight: 700, fontSize: 13, background: 'white' }}>
                                                                    <MapPin size={14}/> Відстежити
                                                                </Link>
                                                                <button onClick={() => repeatOrder(order)} disabled={repeatingId === order.id}
                                                                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', border: '1.5px solid #e2e8f0', borderRadius: 8, color: '#475569', fontWeight: 700, fontSize: 13, background: 'white', cursor: 'pointer', opacity: repeatingId === order.id ? 0.6 : 1 }}>
                                                                    {repeatingId === order.id ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }}/> : <RotateCw size={14}/>} Замовити знову
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/*  DESIGNS  */}
                        {tab === 'designs' && (
                            <div>
                                <SectionHeader icon={<FileText size={20}/>} title="Мої дизайни" sub={`${designs.length} збережених проєктів`} />
                                {designs.length === 0 ? (
                                    <Empty icon={<BookOpen size={40} color="#94a3b8"/>} title="Дизайнів ще немає" sub="Збережені конструктори та замовлення дизайнера з'являться тут" cta="До каталогу" href="/catalog" />
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16 }}>
                                        {designs.map(d => {
                                            const dSt = DESIGN_STATUSES[d.status] || DESIGN_STATUSES.draft;
                                            const label = d.title || d.name || (d.product_type ? `${d.product_type}${d.format ? ' ' + d.format : ''}` : 'Дизайн');
                                            const editUrl = d.source === 'editor' ? `/editor/${d.id}` : `/review/${d.id}`;
                                            const editLabel = d.source === 'editor' ? 'Продовжити редагування' : 'Переглянути';

                                            return (
                                                <div key={d.id} style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e9edf5', display: 'flex', flexDirection: 'column' }}>
                                                    {/* Thumbnail */}
                                                    <div style={{ height: 140, background: 'linear-gradient(135deg, #f0f4ff, #e9edf5)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                                                        {d.thumbnail_url ? (
                                                            <img src={d.thumbnail_url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                                                        ) : (
                                                            <div style={{ textAlign: 'center' }}>
                                                                <BookOpen size={36} color="#263a99" opacity={0.4}/>
                                                            </div>
                                                        )}
                                                        {/* Source badge */}
                                                        <div style={{ position: 'absolute', top: 10, left: 10, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: d.source === 'editor' ? '#eff6ff' : '#f5f3ff', color: d.source === 'editor' ? '#3b82f6' : '#8b5cf6', border: `1px solid ${d.source === 'editor' ? '#bfdbfe' : '#ddd6fe'}` }}>
                                                            {d.source === 'editor' ? 'Редактор' : 'Дизайнер'}
                                                        </div>
                                                    </div>

                                                    <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: dSt.bg, color: dSt.color }}>
                                                                {dSt.label}
                                                            </span>
                                                            <span style={{ fontSize: 11, color: '#94a3b8' }}>
                                                                {new Date(d.updated_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
                                                            </span>
                                                        </div>
                                                        <Link href={editUrl}
                                                            style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px', background: '#263a99', color: 'white', borderRadius: 8, textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>
                                                            <Pencil size={13}/> {editLabel}
                                                        </Link>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/*  WISHLIST  */}
                        {tab === 'wishlist' && (
                            <div>
                                <SectionHeader icon={<Heart size={20}/>} title="Список бажань" sub={`${wishlist.length} товарів`} />
                                {wishlist.length === 0 ? (
                                    <Empty icon={<Heart size={40} color="#94a3b8"/>} title="Вішлист порожній" sub="Натискай  на товарах, щоб зберігати їх тут" cta="До каталогу" href="/catalog" />
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 }}>
                                        {wishlist.map(w => (
                                            <div key={w.id} style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e9edf5', display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ position: 'relative' }}>
                                                    {w.product_image ? (
                                                        <img src={w.product_image} alt={w.product_name} style={{ width: '100%', height: 160, objectFit: 'cover' }}/>
                                                    ) : (
                                                        <div style={{ height: 160, background: 'linear-gradient(135deg, #f0f4ff, #e9edf5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Package size={40} color="#94a3b8"/>
                                                        </div>
                                                    )}
                                                    <button onClick={() => removeWishlist(w.id)}
                                                        style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: '50%', background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                                                        <Trash2 size={13} color="#ef4444"/>
                                                    </button>
                                                </div>
                                                <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                                                        {w.product_name}
                                                    </div>
                                                    <div style={{ fontWeight: 900, color: '#263a99', fontSize: 18 }}>{w.product_price} ₴</div>
                                                    {w.product_slug && (
                                                        <Link href={`/catalog/${w.product_slug}`}
                                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px', background: '#263a99', color: 'white', borderRadius: 8, textDecoration: 'none', fontSize: 12, fontWeight: 700, marginTop: 'auto' }}>
                                                            <ExternalLink size={13}/> Переглянути
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/*  PROFILE  */}
                        {tab === 'profile' && (
                            <div>
                                <SectionHeader icon={<User size={20}/>} title="Мій профіль" sub="Особисті дані та налаштування" />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                                    {/* Personal info card */}
                                    <div style={{ background: 'white', borderRadius: 14, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e9edf5' }}>
                                        <div style={{ fontSize: 13, fontWeight: 800, color: '#263a99', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 20 }}>Особисті дані</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                                <FormField label="Ім'я" icon={<User size={14}/>} value={formData.first_name} onChange={v => setFormData({...formData, first_name: v})}/>
                                                <FormField label="Прізвище" value={formData.last_name} onChange={v => setFormData({...formData, last_name: v})}/>
                                            </div>
                                            <FormField label="Телефон" icon={<Phone size={14}/>} value={formData.phone} type="tel" placeholder="+380..." onChange={v => setFormData({...formData, phone: v})}/>
                                            <FormField label="Email" icon={<Mail size={14}/>} value={user?.email || ''} onChange={() => {}} readOnly/>
                                            <FormField label="Дата народження" icon={<Calendar size={14}/>} value={formData.birthday} type="date" onChange={v => setFormData({...formData, birthday: v})}/>

                                            <button onClick={saveProfile} disabled={isSaving}
                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 24px', background: '#263a99', color: 'white', borderRadius: 10, border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: 14, opacity: isSaving ? 0.7 : 1, marginTop: 4 }}>
                                                {isSaving ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }}/> : <Save size={16}/>}
                                                {isSaving ? 'Збереження...' : 'Зберегти зміни'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Settings card */}
                                    <div style={{ background: 'white', borderRadius: 14, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e9edf5', display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        <div style={{ fontSize: 13, fontWeight: 800, color: '#263a99', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Налаштування</div>

                                        {/* Email subscriptions */}
                                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 18px', background: '#f8fafc', borderRadius: 12, cursor: 'pointer', border: '1px solid #e9edf5' }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 2 }}>Email-розсилка</div>
                                                <div style={{ fontSize: 12, color: '#64748b' }}>Дізнавайтесь першими про акції та новинки</div>
                                            </div>
                                            <div style={{ position: 'relative', width: 44, height: 24, flexShrink: 0 }}>
                                                <input type="checkbox" checked={formData.email_subscribed}
                                                    onChange={e => setFormData({...formData, email_subscribed: e.target.checked})}
                                                    style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}/>
                                                <div onClick={() => setFormData({...formData, email_subscribed: !formData.email_subscribed})}
                                                    style={{ width: 44, height: 24, borderRadius: 12, background: formData.email_subscribed ? '#263a99' : '#e2e8f0', cursor: 'pointer', transition: 'background 0.2s', position: 'relative' }}>
                                                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: formData.email_subscribed ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}/>
                                                </div>
                                            </div>
                                        </label>

                                        {/* Account info */}
                                        <div style={{ padding: '16px 18px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e9edf5' }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Обліковий запис</div>
                                            <div style={{ fontSize: 13, color: '#475569', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                <div><span style={{ color: '#94a3b8' }}>Email: </span>{user?.email}</div>
                                                <div><span style={{ color: '#94a3b8' }}>ID: </span><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{user?.id?.slice(0, 12)}…</span></div>
                                                <div><span style={{ color: '#94a3b8' }}>Реєстрація: </span>{user?.created_at ? new Date(user.created_at).toLocaleDateString('uk-UA') : '—'}</div>
                                            </div>
                                        </div>

                                        <button onClick={logout}
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 24px', background: '#fef2f2', color: '#ef4444', borderRadius: 10, border: '1px solid #fecaca', fontWeight: 700, cursor: 'pointer', fontSize: 14, marginTop: 'auto' }}>
                                            <LogOut size={16}/> Вийти з акаунту
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
            <Footer />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );
}

//  Sub-components 

function SectionHeader({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eff3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#263a99' }}>{icon}</div>
            <div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: 0 }}>{title}</h1>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{sub}</div>
            </div>
        </div>
    );
}

function StatusProgress({ currentStep }: { currentStep: number }) {
    const steps = ['Нове', 'Підтверджено', 'Виробництво', 'Відправлено', 'Доставлено'];
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {steps.map((label, i) => {
                const done = i <= currentStep;
                const active = i === currentStep;
                return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: done ? '#263a99' : '#e2e8f0', border: active ? '3px solid #263a99' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', flexShrink: 0 }}>
                                {done && <CheckCircle2 size={12} color="white"/>}
                            </div>
                            <span style={{ fontSize: 9, fontWeight: done ? 700 : 500, color: done ? '#263a99' : '#94a3b8', whiteSpace: 'nowrap', textAlign: 'center' }}>{label}</span>
                        </div>
                        {i < steps.length - 1 && (
                            <div style={{ flex: 1, height: 3, borderRadius: 2, background: i < currentStep ? '#263a99' : '#e2e8f0', margin: '0 4px', marginBottom: 16, transition: 'background 0.3s' }}/>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function FormField({ label, icon, value, onChange, type = 'text', placeholder, readOnly }: {
    label: string; icon?: React.ReactNode; value: string;
    onChange: (v: string) => void; type?: string; placeholder?: string; readOnly?: boolean;
}) {
    return (
        <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>
                {icon && <span style={{ marginRight: 4, verticalAlign: 'middle' }}>{icon}</span>}
                {label}
            </label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)}
                placeholder={placeholder} readOnly={readOnly}
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: readOnly ? '#f8fafc' : 'white', color: readOnly ? '#94a3b8' : '#0f172a', transition: 'border-color 0.15s' }}
                onFocus={e => { if (!readOnly) e.target.style.borderColor = '#263a99'; }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; }}/>
        </div>
    );
}

function Empty({ icon, title, sub, cta, href }: { icon: React.ReactNode; title: string; sub: string; cta: string; href: string }) {
    return (
        <div style={{ background: 'white', borderRadius: 14, padding: '60px 40px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e9edf5' }}>
            <div style={{ width: 80, height: 80, background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>{icon}</div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>{title}</h3>
            <p style={{ color: '#64748b', marginBottom: 28, fontSize: 14, maxWidth: 360, margin: '0 auto 28px' }}>{sub}</p>
            <Link href={href} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: '#263a99', color: 'white', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
                <ShoppingCart size={16}/> {cta}
            </Link>
        </div>
    );
}
