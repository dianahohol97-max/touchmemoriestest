'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import Link from 'next/link';
import { ShoppingBag, Heart, BookOpen, User, Settings, LogOut, Save, Mail, Phone, Calendar, ChevronRight, Trash2, ExternalLink, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

type Tab = 'orders' | 'wishlist' | 'projects' | 'profile';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    pending:      { label: 'Нове',         color: '#263A99', bg: '#eff6ff' },
    new:          { label: 'Нове',         color: '#263A99', bg: '#eff6ff' },
    confirmed:    { label: 'Підтверджено', color: '#14b8a6', bg: '#f0fdfa' },
    in_production:{ label: 'У виробництві',color: '#f59e0b', bg: '#fffbeb' },
    shipped:      { label: 'Відправлено',  color: '#8b5cf6', bg: '#f5f3ff' },
    delivered:    { label: 'Доставлено',   color: '#10b981', bg: '#ecfdf5' },
    cancelled:    { label: 'Скасовано',    color: '#ef4444', bg: '#fef2f2' },
};

export default function AccountPage() {
    const supabase = createClient();
    const router = useRouter();
    const [tab, setTab] = useState<Tab>('orders');
    const [user, setUser] = useState<any>(null);
    const [customer, setCustomer] = useState<any>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const [wishlist, setWishlist] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [formData, setFormData] = useState({ first_name: '', last_name: '', phone: '', birthday: '', email_subscribed: false });

    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/login'); return; }
            setUser(session.user);

            const [custRes, ordersRes, wishRes, projRes] = await Promise.all([
                supabase.from('customers').select('*').eq('email', session.user.email).single(),
                supabase.from('orders').select('id,order_number,order_status,payment_status,total,created_at,items').or(`customer_email.eq.${session.user.email},customer_id.in.(${(await supabase.from('customers').select('id').eq('email', session.user.email)).data?.map((c: any) => c.id).join(',') || 'null'})`).order('created_at', { ascending: false }),
                supabase.from('wishlists').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
                supabase.from('customer_projects').select('*').in('customer_id',
                    (await supabase.from('customers').select('id').eq('email', session.user.email)).data?.map((c: any) => c.id) || []
                ).order('updated_at', { ascending: false }),
            ]);

            if (custRes.data) {
                setCustomer(custRes.data);
                setFormData({ first_name: custRes.data.first_name || '', last_name: custRes.data.last_name || '', phone: custRes.data.phone || '', birthday: custRes.data.birthday || '', email_subscribed: custRes.data.email_subscribed || false });
            }
            if (ordersRes.data) setOrders(ordersRes.data);
            if (wishRes.data) setWishlist(wishRes.data);
            if (projRes.data) setProjects(projRes.data);
            setIsLoading(false);
        };
        init();
    }, []);

    const removeWishlist = async (id: string) => {
        await supabase.from('wishlists').delete().eq('id', id);
        setWishlist(prev => prev.filter(w => w.id !== id));
        toast.success('Видалено зі списку бажань');
    };

    const saveProfile = async () => {
        try {
            await supabase.from('customers').update(formData).eq('email', user.email);
            toast.success('Зміни збережено');
        } catch { toast.error('Помилка збереження'); }
    };

    const logout = async () => { await supabase.auth.signOut(); router.push('/'); };

    if (isLoading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 48, height: 48, border: '4px solid #e2e8f0', borderTopColor: '#263a99', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    const name = formData.first_name || user?.user_metadata?.first_name || 'Друже';

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
            <Navigation />
            <main style={{ flex: 1, paddingTop: '120px', paddingBottom: '80px' }}>
                <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 20px' }}>

                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '36px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#263a99', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 22, fontWeight: 900 }}>
                                {name[0]?.toUpperCase()}
                            </div>
                            <div>
                                <h1 style={{ fontSize: 26, fontWeight: 900, color: '#263A99', margin: 0 }}>Привіт, {name}! 👋</h1>
                                <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>{user?.email}</p>
                            </div>
                        </div>
                        <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', border: '1px solid #e2e8f0', borderRadius: 4, background: 'white', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}>
                            <LogOut size={16} /> Вийти
                        </button>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: '#f1f5f9', padding: 5, borderRadius: 8, width: 'fit-content' }}>
                        {([
                            { id: 'orders',   icon: <ShoppingBag size={16}/>, label: `Замовлення (${orders.length})` },
                            { id: 'wishlist', icon: <Heart size={16}/>,      label: `Вішлист (${wishlist.length})` },
                            { id: 'projects', icon: <BookOpen size={16}/>,   label: `Макети (${projects.length})` },
                            { id: 'profile',  icon: <Settings size={16}/>,   label: 'Профіль' },
                        ] as const).map(t => (
                            <button key={t.id} onClick={() => setTab(t.id as Tab)}
                                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, transition: 'all 0.15s',
                                    background: tab === t.id ? 'white' : 'transparent',
                                    color: tab === t.id ? '#263A99' : '#64748b',
                                    boxShadow: tab === t.id ? '0 2px 8px rgba(0,0,0,0.08)' : 'none' }}>
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div style={{ background: 'white', borderRadius: 8, padding: 32, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>

                        {/* ── ORDERS ── */}
                        {tab === 'orders' && (
                            orders.length === 0 ? (
                                <Empty icon={<ShoppingBag size={36} color="#94a3b8"/>} title="У вас ще немає замовлень" sub="Ваші замовлення з'являться тут" cta="До каталогу" href="/catalog" />
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>Мої замовлення</h2>
                                    {orders.map(o => {
                                        const s = STATUS_MAP[o.order_status] || STATUS_MAP.new;
                                        const itemCount = Array.isArray(o.items) ? o.items.reduce((a: number, i: any) => a + (i.qty || i.quantity || 1), 0) : 0;
                                        return (
                                            <div key={o.id} style={{ border: '1px solid #f1f5f9', borderRadius: 6, padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                                        <span style={{ fontWeight: 800, color: '#263A99' }}>#{o.order_number}</span>
                                                        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: s.bg, color: s.color, textTransform: 'uppercase' }}>{s.label}</span>
                                                    </div>
                                                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                                                        {new Date(o.created_at).toLocaleDateString('uk-UA')} · {itemCount} {itemCount === 1 ? 'товар' : 'товари'}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontWeight: 900, color: '#263A99', fontSize: 18 }}>{o.total} ₴</div>
                                                        <div style={{ fontSize: 11, fontWeight: 700, color: o.payment_status === 'paid' ? '#10b981' : '#f59e0b', textTransform: 'uppercase' }}>
                                                            {o.payment_status === 'paid' ? '✅ Оплачено' : '⏳ Очікує'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        )}

                        {/* ── WISHLIST ── */}
                        {tab === 'wishlist' && (
                            wishlist.length === 0 ? (
                                <Empty icon={<Heart size={36} color="#94a3b8"/>} title="Список бажань порожній" sub="Додавайте товари ♡ щоб зберегти їх тут" cta="До каталогу" href="/catalog" />
                            ) : (
                                <div>
                                    <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginBottom: 20 }}>Список бажань</h2>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                                        {wishlist.map(w => (
                                            <div key={w.id} style={{ border: '1px solid #f1f5f9', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                                                <button onClick={() => removeWishlist(w.id)} style={{ position: 'absolute', top: 8, right: 8, background: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.12)', zIndex: 2 }}>
                                                    <Trash2 size={12} color="#ef4444" />
                                                </button>
                                                {w.product_image ? (
                                                    <img src={w.product_image} alt={w.product_name} style={{ width: '100%', height: 160, objectFit: 'cover' }} />
                                                ) : (
                                                    <div style={{ width: '100%', height: 160, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Package size={40} color="#cbd5e1" />
                                                    </div>
                                                )}
                                                <div style={{ padding: 14 }}>
                                                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{w.product_name}</div>
                                                    <div style={{ fontWeight: 900, color: '#263A99', marginBottom: 10 }}>{w.product_price} ₴</div>
                                                    {w.product_slug && (
                                                        <Link href={`/catalog/${w.product_slug}`} style={{ display: 'block', textAlign: 'center', padding: '8px', background: '#263a99', color: 'white', borderRadius: 4, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
                                                            Переглянути
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        )}

                        {/* ── PROJECTS / МАКЕТИ ── */}
                        {tab === 'projects' && (
                            projects.length === 0 ? (
                                <Empty icon={<BookOpen size={36} color="#94a3b8"/>} title="Макетів ще немає" sub="Після створення замовлення з дизайнером — ваші макети збережуться тут" cta="Замовити фотокнигу" href="/catalog/photobook" />
                            ) : (
                                <div>
                                    <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginBottom: 20 }}>Мої макети</h2>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                                        {projects.map(p => (
                                            <div key={p.id} style={{ border: '1px solid #f1f5f9', borderRadius: 8, overflow: 'hidden' }}>
                                                {p.thumbnail_url ? (
                                                    <img src={p.thumbnail_url} alt={p.title} style={{ width: '100%', height: 160, objectFit: 'cover' }} />
                                                ) : (
                                                    <div style={{ width: '100%', height: 160, background: '#f0f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <BookOpen size={40} color="#263a99" />
                                                    </div>
                                                )}
                                                <div style={{ padding: 14 }}>
                                                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{p.title || 'Макет'}</div>
                                                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
                                                        {new Date(p.updated_at).toLocaleDateString('uk-UA')} · {p.product_type || ''}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        {(() => {
                                                            const sc: Record<string, any> = {
                                                                draft: { l: 'Чернетка', c: '#64748b', bg: '#f1f5f9' },
                                                                in_review: { l: 'На розгляді', c: '#f59e0b', bg: '#fffbeb' },
                                                                approved: { l: 'Затверджено', c: '#10b981', bg: '#ecfdf5' },
                                                                rejected: { l: 'На доопрацюванні', c: '#ef4444', bg: '#fef2f2' },
                                                            };
                                                            const st = sc[p.status] || sc.draft;
                                                            return <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: st.bg, color: st.c, textTransform: 'uppercase' }}>{st.l}</span>;
                                                        })()}
                                                    </div>
                                                    {p.status === 'in_review' && (
                                                        <Link href={`/review/${p.id}`} style={{ display: 'block', textAlign: 'center', padding: '8px', background: '#263a99', color: 'white', borderRadius: 4, textDecoration: 'none', fontSize: 13, fontWeight: 700, marginTop: 10 }}>
                                                            Переглянути макет
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        )}

                        {/* ── PROFILE ── */}
                        {tab === 'profile' && (
                            <div style={{ maxWidth: 560 }}>
                                <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 24 }}>Особисті дані</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        {[['Ім\'я', 'first_name', 'text'], ['Прізвище', 'last_name', 'text']].map(([label, field, type]) => (
                                            <div key={field}>
                                                <label style={lbl}>{label}</label>
                                                <input type={type} style={inp} value={(formData as any)[field]} onChange={e => setFormData({ ...formData, [field]: e.target.value })} />
                                            </div>
                                        ))}
                                    </div>
                                    <div>
                                        <label style={lbl}>Телефон</label>
                                        <input type="tel" style={inp} placeholder="+380..." value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={lbl}>Email</label>
                                        <input type="email" style={{ ...inp, background: '#f8fafc', color: '#94a3b8' }} value={user?.email || ''} readOnly />
                                    </div>
                                    <div>
                                        <label style={lbl}>Дата народження</label>
                                        <input type="date" style={inp} value={formData.birthday} onChange={e => setFormData({ ...formData, birthday: e.target.value })} />
                                    </div>
                                    <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: 6 }}>
                                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                                            <div>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: '#263A99' }}>Отримувати email розсилку</div>
                                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Дізнавайтесь першими про акції та новинки</div>
                                            </div>
                                            <input type="checkbox" style={{ width: 18, height: 18, accentColor: '#263a99' }} checked={formData.email_subscribed} onChange={e => setFormData({ ...formData, email_subscribed: e.target.checked })} />
                                        </label>
                                    </div>
                                    <button onClick={saveProfile} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: '#263a99', color: 'white', borderRadius: 6, border: 'none', fontWeight: 800, cursor: 'pointer' }}>
                                        <Save size={16} /> Зберегти зміни
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}

function Empty({ icon, title, sub, cta, href }: { icon: React.ReactNode; title: string; sub: string; cta: string; href: string }) {
    return (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ width: 72, height: 72, background: '#f8fafc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>{icon}</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#263A99', marginBottom: 8 }}>{title}</h3>
            <p style={{ color: '#64748b', marginBottom: 24, fontSize: 14 }}>{sub}</p>
            <Link href={href} style={{ display: 'inline-block', padding: '12px 24px', background: '#263a99', color: 'white', borderRadius: 6, textDecoration: 'none', fontWeight: 700 }}>{cta}</Link>
        </div>
    );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 };
const inp: React.CSSProperties = { width: '100%', padding: '11px 14px', borderRadius: 6, border: '1px solid #e2e8f0', outline: 'none', fontSize: 14, boxSizing: 'border-box' };
