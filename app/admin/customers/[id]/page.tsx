'use client';
import { useState, useEffect, use, useRef } from 'react';
import styles from './customer-profile.module.css';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, User, Phone, Mail, ShoppingBag,
    CreditCard, Calendar, ArrowUpRight, Loader2, Save
} from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const router = useRouter();

    const [customer, setCustomer] = useState<any>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Notes state
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const notesRef = useRef(notes);

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        setLoading(true);
        // Fetch Customer
        const { data: custData, error: custErr } = await supabase
            .from('customers')
            .select('*')
            .eq('id', id)
            .single();

        if (custData) {
            setCustomer(custData);
            setNotes(custData.notes || '');
            notesRef.current = custData.notes || '';
        }

        // Fetch Orders
        const { data: ordData } = await supabase
            .from('orders')
            .select('id, order_number, total, created_at, order_status')
            .eq('customer_id', id)
            .order('created_at', { ascending: false });

        if (ordData) setOrders(ordData);
        setLoading(false);
    };

    // Auto-save logic (1-second debounce)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (customer && notes !== notesRef.current) {
                saveNotes(notes);
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [notes, customer]);

    const saveNotes = async (newNotes: string) => {
        setSaving(true);
        const { error } = await supabase
            .from('customers')
            .update({ notes: newNotes })
            .eq('id', id);

        if (!error) {
            notesRef.current = newNotes;
            // toast.success('Нотатки збережено', { duration: 2000 });
        } else {
            toast.error('Помилка збереження нотаток');
        }
        setSaving(false);
    };

    if (loading) return <div style={{ padding: '100px', display: 'flex', justifyContent: 'center' }}><Loader2 className={styles.animateSpin} size={32} color="#94a3b8" /></div>;
    if (!customer) return <div style={{ padding: '100px', textAlign: 'center' }}>Клієнт не знайдений</div>;

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '80px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
                <button onClick={() => router.back()} style={backBtnStyle}><ArrowLeft size={20} /></button>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 900, color: '#1e293b' }}>
                        Профіль клієнта
                    </h1>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px' }}>

                {/* Left Column: Info & Notes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                    {/* Basic Info */}
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                            <div style={avatarBigStyle}>{customer.name?.[0]}</div>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b', margin: 0 }}>{customer.name}</h2>
                                <div style={{ fontSize: '12px', color: '#94a3b8' }}>ID: {customer.id.substring(0, 8)}...</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={contactRowStyle}><Mail size={16} color="#94a3b8" /> {customer.email || '—'}</div>
                            <div style={contactRowStyle}><Phone size={16} color="#94a3b8" /> {customer.phone || '—'}</div>
                            <div style={contactRowStyle}><Calendar size={16} color="#94a3b8" /> Реєстрація: {new Date(customer.created_at || Date.now()).toLocaleDateString('uk-UA')}</div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #f1f5f9' }}>
                            <div>
                                <div style={statLabelStyle}>Замовлень</div>
                                <div style={statValueStyle}>{customer.total_orders || 0}</div>
                            </div>
                            <div>
                                <div style={statLabelStyle}>Витрачено</div>
                                <div style={statValueStyle}>{customer.total_spent || 0} ₴</div>
                            </div>
                        </div>
                    </div>

                    {/* Customer Notes */}
                    <div style={{ ...cardStyle, position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', margin: 0 }}>📌 Нотатки про клієнта</h3>
                            <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {saving ? <><Loader2 size={12} className={styles.animateSpin} /> Збереження...</> : <><Save size={12} /> Збережено</>}
                            </div>
                        </div>
                        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', lineHeight: '1.5' }}>
                            Ці нотатки бачать лише адміністратори. Вони відображатимуться як підказка у спиsku замовлень цього клієнта.
                        </p>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Наприклад: VIP клієнт, завжди бере преміум обкладинку..."
                            style={notesTextareaStyle}
                        />
                    </div>
                </div>

                {/* Right Column: Order History */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                    <div style={cardStyle}>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', marginBottom: '24px', margin: 0 }}>
                            Історія замовлень ({orders.length})
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {orders.length === 0 ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '16px' }}>
                                    Ще немає замовлень
                                </div>
                            ) : orders.map(order => (
                                <Link key={order.id} href={`/admin/orders/${order.id}`} style={orderRowStyle}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={orderIconStyle}><ShoppingBag size={18} color="var(--primary)" /></div>
                                        <div>
                                            <div style={{ fontWeight: 800, color: '#1e293b' }}>{order.order_number}</div>
                                            <div style={{ fontSize: '13px', color: '#64748b' }}>{new Date(order.created_at).toLocaleDateString('uk-UA')}</div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 800, color: '#1e293b' }}>{order.total} ₴</div>
                                            <div style={{ fontSize: '12px', fontWeight: 600, color: getStatusColor(order.order_status) }}>
                                                {getStatusLabel(order.order_status)}
                                            </div>
                                        </div>
                                        <ArrowUpRight size={18} color="#94a3b8" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>

                </div>

            </div>

        </div>
    );
}

// Helpers & Styles
function getStatusLabel(status: string) {
    const map: Record<string, string> = {
        'pending': 'Нове', 'confirmed': 'Підтверджено', 'in_production': 'У виробництві',
        'shipped': 'Відправлено', 'delivered': 'Виконано', 'cancelled': 'Скасовано'
    };
    return map[status] || status;
}

function getStatusColor(status: string) {
    const map: Record<string, string> = {
        'pending': '#3b82f6', 'confirmed': '#14b8a6', 'in_production': '#f59e0b',
        'shipped': '#a855f7', 'delivered': '#22c55e', 'cancelled': '#ef4444'
    };
    return map[status] || '#64748b';
}

const backBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', cursor: 'pointer' };
const cardStyle = { backgroundColor: 'white', padding: '32px', borderRadius: '32px', border: '1px solid #f1f5f9', boxShadow: '0 4px 25px rgba(0,0,0,0.02)' };
const avatarBigStyle = { width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#f1f5f9', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 900 };
const contactRowStyle = { display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', fontWeight: 600, color: '#475569' };
const statLabelStyle = { fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as any, letterSpacing: '0.05em', marginBottom: '4px' };
const statValueStyle = { fontSize: '24px', fontWeight: 900, color: '#1e293b' };
const notesTextareaStyle = { width: '100%', padding: '16px', borderRadius: '16px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px', color: '#1e293b', fontFamily: 'inherit', resize: 'vertical' as any, minHeight: '150px', backgroundColor: '#fdfbf7' };
const orderRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9', textDecoration: 'none', transition: 'all 0.2s', backgroundColor: 'white' };
const orderIconStyle = { width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' };
