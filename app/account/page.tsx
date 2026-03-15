'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import styles from './account.module.css';
import { createClient } from '@/lib/supabase/client';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import Link from 'next/link';
import { ShoppingBag, Package, Calendar, Tag, User, Settings, LogOut, ChevronRight, ExternalLink, Save, Mail, Phone, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function AccountPage() {
    const supabase = createClient();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'orders' | 'profile'>('orders');
    const [user, setUser] = useState<any>(null);
    const [customer, setCustomer] = useState<any>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Profile form state
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        phone: '',
        birthday: '',
        email_subscribed: false
    });

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                router.push('/login');
                return;
            }

            setUser(session.user);

            // Fetch customer and orders
            const [customerRes, ordersRes] = await Promise.all([
                supabase.from('customers').select('*').eq('email', session.user.email).single(),
                supabase.from('orders').select('*').eq('customer_email', session.user.email).order('created_at', { ascending: false })
            ]);

            if (customerRes.data) {
                setCustomer(customerRes.data);
                setFormData({
                    first_name: customerRes.data.first_name || '',
                    last_name: customerRes.data.last_name || '',
                    phone: customerRes.data.phone || '',
                    birthday: customerRes.data.birthday || '',
                    email_subscribed: customerRes.data.email_subscribed || false
                });
            }
            if (ordersRes.data) setOrders(ordersRes.data);

            setIsLoading(false);
        };
        fetchData();
    }, [supabase, router]);

    const handleSaveProfile = async () => {
        try {
            const { error } = await supabase
                .from('customers')
                .update({
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    phone: formData.phone,
                    birthday: formData.birthday,
                    email_subscribed: formData.email_subscribed
                })
                .eq('email', user.email);

            if (error) throw error;
            toast.success('Зміни збережено');
        } catch (error: any) {
            toast.error('Помилка: ' + error.message);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
    };

    if (isLoading) {
        return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Завантаження...</div>;
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
            <Navigation />

            <main style={{ flex: 1, paddingTop: '120px', paddingBottom: '80px' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>

                    {/* Header Section */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            {customer?.avatar_url || user?.user_metadata?.avatar_url ? (
                                <img
                                    src={customer?.avatar_url || user?.user_metadata?.avatar_url}
                                    alt="Avatar"
                                    style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                            ) : (
                                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                    <User size={32} />
                                </div>
                            )}
                            <div>
                                <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#263A99' }}>
                                    Привіт, {formData.first_name || user?.user_metadata?.first_name || 'Друже'}! 👋
                                </h1>
                                <p style={{ color: '#64748b', fontSize: '14px' }}>Ласкаво просимо до вашого кабінету</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#64748b', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                            <LogOut size={18} /> Вийти
                        </button>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', backgroundColor: '#f1f5f9', padding: '6px', borderRadius: '16px', width: 'fit-content' }}>
                        <button
                            onClick={() => setActiveTab('orders')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '12px',
                                border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '14px',
                                backgroundColor: activeTab === 'orders' ? 'white' : 'transparent',
                                color: activeTab === 'orders' ? 'var(--primary)' : '#64748b',
                                boxShadow: activeTab === 'orders' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none'
                            }}
                        >
                            <ShoppingBag size={18} /> Мої замовлення
                        </button>
                        <button
                            onClick={() => setActiveTab('profile')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '12px',
                                border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '14px',
                                backgroundColor: activeTab === 'profile' ? 'white' : 'transparent',
                                color: activeTab === 'profile' ? 'var(--primary)' : '#64748b',
                                boxShadow: activeTab === 'profile' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none'
                            }}
                        >
                            <Settings size={18} /> Особисті дані
                        </button>
                    </div>

                    {/* Content */}
                    <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                        {activeTab === 'orders' ? (
                            <OrdersTab orders={orders} />
                        ) : (
                            <ProfileTab
                                formData={formData}
                                setFormData={setFormData}
                                onSave={handleSaveProfile}
                                isGoogle={user?.app_metadata?.provider === 'google'}
                            />
                        )}
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}

function OrdersTab({ orders }: { orders: any[] }) {
    if (orders.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ width: '64px', height: '64px', backgroundColor: '#f8fafc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <ShoppingBag size={32} color="#94a3b8" />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#263A99', marginBottom: '8px' }}>У вас ще немає замовлень</h3>
                <p style={{ color: '#64748b', marginBottom: '24px' }}>Всі ваші замовлення будуть відображатися тут</p>
                <Link href="/catalog" style={{ display: 'inline-block', padding: '12px 24px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '12px', textDecoration: 'none', fontWeight: 700 }}>
                    До каталогу
                </Link>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {orders.map((order) => (
                <div key={order.id} style={{ border: '1px solid #f1f5f9', borderRadius: '16px', padding: '20px', transition: 'border-color 0.2s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 800, color: '#263A99' }}>Замовлення #{order.order_number}</span>
                                <OrderStatusBadge status={order.order_status} />
                            </div>
                            <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Calendar size={14} /> {new Date(order.created_at).toLocaleDateString('uk-UA')}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ color: 'var(--primary)', fontWeight: 900, fontSize: '18px' }}>{order.total} ₴</div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: order.payment_status === 'paid' ? '#16a34a' : '#f59e0b', textTransform: 'uppercase', marginTop: '4px' }}>
                                {order.payment_status === 'paid' ? 'Оплачено' : 'Очікує оплати'}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function ProfileTab({ formData, setFormData, onSave, isGoogle }: any) {
    return (
        <div style={{ maxWidth: '600px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '24px' }}>Особисті дані</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                        <label style={pLabelStyle}>Ім'я</label>
                        <input
                            type="text"
                            style={pInputStyle}
                            value={formData.first_name}
                            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label style={pLabelStyle}>Прізвище</label>
                        <input
                            type="text"
                            style={pInputStyle}
                            value={formData.last_name}
                            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        />
                    </div>
                </div>

                <div>
                    <label style={pLabelStyle}>Email {isGoogle && <span style={{ fontSize: '11px', color: '#94a3b8' }}>(читання)</span>}</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="email"
                            style={{ ...pInputStyle, backgroundColor: isGoogle ? '#f8fafc' : 'white', color: isGoogle ? '#94a3b8' : 'inherit' }}
                            value={formData.email || ''}
                            readOnly={isGoogle}
                            disabled={isGoogle}
                        />
                        <Mail size={16} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#cbd5e1' }} />
                    </div>
                </div>

                <div>
                    <label style={pLabelStyle}>Телефон</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="tel"
                            style={pInputStyle}
                            placeholder="+380..."
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                        <Phone size={16} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#cbd5e1' }} />
                    </div>
                </div>

                <div>
                    <label style={pLabelStyle}>Дата народження</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="date"
                            style={pInputStyle}
                            value={formData.birthday}
                            onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                        />
                    </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <div>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: '#263A99' }}>Отримувати email розсилку</div>
                            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Дізнавайтеся першими про акції та новинки</div>
                        </div>
                        <input
                            type="checkbox"
                            style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
                            checked={formData.email_subscribed}
                            onChange={(e) => setFormData({ ...formData, email_subscribed: e.target.checked })}
                        />
                    </label>
                </div>

                <div style={{ marginTop: '12px' }}>
                    <button
                        onClick={onSave}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 28px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}
                    >
                        <Save size={18} /> Зберегти зміни
                    </button>
                </div>

                <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #f1f5f9' }}>
                    <Link href="/privacy-policy" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Політика конфіденційності <ExternalLink size={12} />
                    </Link>
                </div>
            </div>
        </div>
    );
}

const pLabelStyle = { display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px' };
const pInputStyle = { width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '14px', transition: 'border-color 0.2s' };

function OrderStatusBadge({ status }: { status: string }) {
    const configs: any = {
        'new': { label: 'Нове', color: '#263A99', bg: '#eff6ff' },
        'processing': { label: 'В роботі', color: '#8b5cf6', bg: '#f5f3ff' },
        'shipped': { label: 'Відправлено', color: '#10b981', bg: '#ecfdf5' },
        'delivered': { label: 'Доставлено', color: '#059669', bg: '#f0fdf4' },
        'cancelled': { label: 'Скасовано', color: '#ef4444', bg: '#fef2f2' },
    };
    const c = configs[status] || configs['new'];
    return (
        <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', backgroundColor: c.bg, color: c.color, textTransform: 'uppercase' }}>
            {c.label}
        </span>
    );
}
