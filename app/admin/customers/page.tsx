'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import {
    Search,
    Users,
    ShoppingBag,
    BarChart3,
    ArrowUpRight,
    Search as SearchIcon,
    Mail,
    Phone
} from 'lucide-react';

export default function CustomersPage() {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('total_spent', { ascending: false });

        if (data) setCustomers(data);
        setLoading(false);
    };

    const filteredCustomers = customers.filter(c =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone?.includes(searchQuery)
    );

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 900, color: '#1e293b', marginBottom: '8px' }}>Клієнти</h1>
                    <p style={{ color: '#64748b' }}>База даних покупців та їх купівельна активність.</p>
                </div>
            </div>

            {/* Stats */}
            <div style={statsGridStyle}>
                <div style={statCardStyle}>
                    <div style={{ ...iconWrapperStyle, backgroundColor: '#f0fdf4', color: '#16a34a' }}><Users size={24} /></div>
                    <div>
                        <div style={statLabelStyle}>Всього клієнтів</div>
                        <div style={statValueStyle}>{customers.length}</div>
                    </div>
                </div>
                <div style={statCardStyle}>
                    <div style={{ ...iconWrapperStyle, backgroundColor: '#eff6ff', color: '#3b82f6' }}><ShoppingBag size={24} /></div>
                    <div>
                        <div style={statLabelStyle}>Всього замовлень</div>
                        <div style={statValueStyle}>{customers.reduce((acc, c) => acc + (c.total_orders || 0), 0)}</div>
                    </div>
                </div>
                <div style={statCardStyle}>
                    <div style={{ ...iconWrapperStyle, backgroundColor: '#fdf2f8', color: '#db2777' }}><BarChart3 size={24} /></div>
                    <div>
                        <div style={statLabelStyle}>Середній чек</div>
                        <div style={statValueStyle}>
                            {Math.round(customers.reduce((acc, c) => acc + (Number(c.total_spent) || 0), 0) / (customers.reduce((acc, c) => acc + (c.total_orders || 0), 0) || 1))} ₴
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div style={searchWrapperStyle}>
                <SearchIcon size={20} color="#94a3b8" />
                <input
                    placeholder="Пошук за ім'ям, email або телефоном..."
                    style={searchInputStyle}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Table */}
            <div style={tableCardStyle}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1.5px solid #f1f5f9' }}>
                            <th style={thStyle}>Клієнт</th>
                            <th style={thStyle}>Замовлень</th>
                            <th style={thStyle}>Витрачено</th>
                            <th style={thStyle}>Контакти</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Дії</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '100px', color: '#94a3b8' }}>Завантаження...</td></tr>
                        ) : filteredCustomers.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '100px', color: '#94a3b8' }}>Клієнтів не знайдено</td></tr>
                        ) : filteredCustomers.map(customer => (
                            <tr key={customer.id} style={trStyle}>
                                <td style={tdStyle}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={avatarStyle}>{customer.name?.[0]}</div>
                                        <div>
                                            <div style={{ fontWeight: 800, color: '#1e293b' }}>{customer.name}</div>
                                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>ID: {customer.id.substring(0, 8)}...</div>
                                        </div>
                                    </div>
                                </td>
                                <td style={tdStyle}>
                                    <div style={{ fontWeight: 800, fontSize: '15px' }}>{customer.total_orders || 0}</div>
                                </td>
                                <td style={tdStyle}>
                                    <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--primary)' }}>{customer.total_spent || 0} ₴</div>
                                </td>
                                <td style={tdStyle}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={contactLinkStyle}><Mail size={12} /> {customer.email}</div>
                                        <div style={contactLinkStyle}><Phone size={12} /> {customer.phone}</div>
                                    </div>
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right' }}>
                                    <Link href={`/admin/customers/${customer.id}`} style={actionBtnStyle}>
                                        Профіль <ArrowUpRight size={16} />
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const statsGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', marginBottom: '48px' };
const statCardStyle = { backgroundColor: 'white', padding: '32px', borderRadius: '32px', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' };
const iconWrapperStyle = { width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const statLabelStyle = { fontSize: '13px', fontWeight: 700, color: '#64748b', marginBottom: '4px' };
const statValueStyle = { fontSize: '24px', fontWeight: 900, color: '#1e293b' };
const searchWrapperStyle = { display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'white', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '0 20px', marginBottom: '32px', maxWidth: '600px' };
const searchInputStyle = { border: 'none', padding: '16px 0', outline: 'none', width: '100%', fontSize: '15px', fontWeight: 500 };
const tableCardStyle = { backgroundColor: 'white', borderRadius: '32px', border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 4px 25px rgba(0,0,0,0.02)' };
const thStyle = { textAlign: 'left' as any, padding: '24px', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' as any, letterSpacing: '0.05em', fontWeight: 800 };
const tdStyle = { padding: '24px', verticalAlign: 'middle' };
const trStyle = { borderBottom: '1px solid #f8fafc' };
const avatarStyle = { width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 900 };
const contactLinkStyle = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b', fontWeight: 600 };
const actionBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '10px', backgroundColor: '#f8fafc', color: '#475569', fontSize: '13px', fontWeight: 700, textDecoration: 'none', transition: 'all 0.2s' };
