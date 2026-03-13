'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Plus,
    Search,
    Ticket,
    Calendar,
    MousePointer2,
    MoreVertical,
    Edit,
    Trash2,
    CheckCircle2,
    XCircle,
    Copy,
    ArrowUpRight
} from 'lucide-react';
import { toast } from 'sonner';

export default function PromoCodesPage() {
    const [promocodes, setPromocodes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchPromocodes();
    }, []);

    const fetchPromocodes = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/promocodes');
            const data = await res.json();
            if (res.ok) {
                setPromocodes(data);
            } else {
                toast.error('Помилка завантаження промокодів');
            }
        } catch (error) {
            toast.error('Помилка мережі');
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Ви впевнені, що хочете видалити цей промокод?')) return;

        try {
            const res = await fetch(`/api/admin/promocodes?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Промокод видалено');
                setPromocodes(prev => prev.filter(p => p.id !== id));
            } else {
                toast.error('Помилка видалення');
            }
        } catch (error) {
            toast.error('Помилка мережі');
        }
    };

    const copyToClipboard = (code: string) => {
        navigator.clipboard.writeText(code);
        toast.success(`Код ${code} скопійовано`);
    };

    const filteredPromocodes = promocodes.filter(p =>
        p.code?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isExpired = (date: string) => {
        if (!date) return false;
        return new Date(date) < new Date();
    };

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 900, color: '#1e293b', marginBottom: '8px' }}>Промокоди</h1>
                    <p style={{ color: '#64748b' }}>Керування знижками та маркетинговими акціями.</p>
                </div>
                <Link href="/admin/marketing/promocodes/new" style={addBtnStyle}>
                    <Plus size={20} /> Додати промокод
                </Link>
            </div>

            {/* Filters */}
            <div style={filterBarStyle}>
                <div style={searchWrapperStyle}>
                    <Search size={20} color="#94a3b8" />
                    <input
                        placeholder="Пошук за кодом..."
                        style={searchInputStyle}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Table */}
            <div style={tableCardStyle}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1.5px solid #f1f5f9' }}>
                            <th style={thStyle}>Код</th>
                            <th style={thStyle}>Тип знижки</th>
                            <th style={thStyle}>Використання</th>
                            <th style={thStyle}>Термін дії</th>
                            <th style={thStyle}>Статус</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Дії</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '100px', color: '#94a3b8' }}>Завантаження...</td></tr>
                        ) : filteredPromocodes.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '100px', color: '#94a3b8' }}>Промокодів не знайдено</td></tr>
                        ) : filteredPromocodes.map(promo => (
                            <tr key={promo.id} style={trStyle}>
                                <td style={tdStyle}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={promoBadgeStyle}>
                                            <span style={{ fontWeight: 800 }}>{promo.code}</span>
                                            <button
                                                onClick={() => copyToClipboard(promo.code)}
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8' }}
                                            >
                                                <Copy size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </td>
                                <td style={tdStyle}>
                                    <div style={{ fontWeight: 700, color: '#1e293b' }}>
                                        {promo.type === 'percent' ? `${promo.value}%` : `${promo.value} ₴`}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                        {promo.type === 'percent' ? 'Відсоткова знижка' : 'Фіксована знижка'}
                                    </div>
                                </td>
                                <td style={tdStyle}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ fontWeight: 800 }}>{promo.uses_count || 0}</div>
                                        {promo.max_uses && (
                                            <div style={{ fontSize: '13px', color: '#94a3b8' }}>/ {promo.max_uses}</div>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>разів використано</div>
                                </td>
                                <td style={tdStyle}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#475569' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Calendar size={12} color="#94a3b8" />
                                            {promo.valid_from ? new Date(promo.valid_from).toLocaleDateString('uk-UA') : 'Без дати'}
                                            {' — '}
                                            {promo.valid_until ? new Date(promo.valid_until).toLocaleDateString('uk-UA') : 'Необмежено'}
                                        </div>
                                    </div>
                                </td>
                                <td style={tdStyle}>
                                    {promo.is_active && !isExpired(promo.valid_until) ? (
                                        <div style={{ ...statusBadgeStyle, backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                                            <CheckCircle2 size={12} /> Активний
                                        </div>
                                    ) : (
                                        <div style={{ ...statusBadgeStyle, backgroundColor: '#fef2f2', color: '#ef4444' }}>
                                            <XCircle size={12} />
                                            {isExpired(promo.valid_until) ? 'Прострочений' : 'Неактивний'}
                                        </div>
                                    )}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right' }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                        <Link href={`/admin/marketing/promocodes/edit/${promo.id}`} style={iconBtnStyle}>
                                            <Edit size={16} />
                                        </Link>
                                        <button onClick={() => handleDelete(promo.id)} style={{ ...iconBtnStyle, color: '#ef4444' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const addBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: '#1e293b', color: 'white', borderRadius: '14px', fontWeight: 700, textDecoration: 'none', transition: 'all 0.2s', fontSize: '15px' };
const filterBarStyle = { display: 'flex', gap: '16px', marginBottom: '32px' };
const searchWrapperStyle = { display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'white', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '0 20px', flex: 1, maxWidth: '500px' };
const searchInputStyle = { border: 'none', padding: '14px 0', outline: 'none', width: '100%', fontSize: '15px', fontWeight: 500 };
const tableCardStyle = { backgroundColor: 'white', borderRadius: '32px', border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 4px 25px rgba(0,0,0,0.02)' };
const thStyle = { textAlign: 'left' as any, padding: '24px', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' as any, letterSpacing: '0.05em', fontWeight: 800 };
const tdStyle = { padding: '24px', verticalAlign: 'middle' };
const trStyle = { borderBottom: '1px solid #f8fafc' };
const promoBadgeStyle = { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#1e293b', fontSize: '14px', fontFamily: 'monospace' };
const statusBadgeStyle = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 700 };
const iconBtnStyle = { width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#f8fafc', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', transition: 'all 0.2s' };
