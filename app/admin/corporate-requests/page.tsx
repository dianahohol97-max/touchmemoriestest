'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Building2, Mail, Phone, Calendar } from 'lucide-react';

interface BriefLine { product: string; qty: number; options?: Record<string, string>; }
interface CorporateRequest {
    id: string;
    company_name: string;
    contact_name: string | null;
    email: string;
    phone: string | null;
    brief: BriefLine[];
    deadline: string | null;
    message: string | null;
    proposal_total: number | null;
    status: 'new' | 'quoted' | 'won' | 'lost';
    created_at: string;
}

const STATUS_OPTS: { value: CorporateRequest['status']; label: string; color: string }[] = [
    { value: 'new', label: 'Новий', color: '#d97706' },
    { value: 'quoted', label: 'Надіслано пропозицію', color: '#3d56d6' },
    { value: 'won', label: 'Угода', color: '#16a34a' },
    { value: 'lost', label: 'Втрачено', color: '#dc2626' },
];

export default function CorporateRequestsPage() {
    const [requests, setRequests] = useState<CorporateRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'new' | 'all'>('new');

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/corporate-requests?status=${filter}`);
            const data = await res.json();
            if (res.ok) setRequests(data.requests || []);
            else toast.error(data.error || 'Помилка завантаження');
        } catch {
            toast.error('Помилка завантаження');
        }
        setLoading(false);
    };

    useEffect(() => { fetchRequests(); /* eslint-disable-next-line */ }, [filter]);

    const updateStatus = async (id: string, status: CorporateRequest['status']) => {
        try {
            const res = await fetch('/api/admin/corporate-requests', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status }),
            });
            if (res.ok) { toast.success('Оновлено'); fetchRequests(); }
            else toast.error('Помилка');
        } catch {
            toast.error('Помилка');
        }
    };

    return (
        <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1e2d7d', margin: 0 }}>Корпоративні запити</h1>
                    <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0' }}>Запити на комерційні пропозиції від компаній</p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <select value={filter} onChange={e => setFilter(e.target.value as any)} style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}>
                        <option value="new">Нові</option>
                        <option value="all">Усі</option>
                    </select>
                    <button onClick={fetchRequests} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14 }}>
                        <RefreshCw size={15} /> Оновити
                    </button>
                </div>
            </div>

            {loading ? (
                <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>Завантаження…</p>
            ) : requests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
                    <Building2 size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                    <p>Запитів немає</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {requests.map(r => (
                        <div key={r.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '22px 24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                                <div style={{ flex: 1, minWidth: 220 }}>
                                    <div style={{ fontWeight: 700, fontSize: 17, color: '#1e2d7d', marginBottom: 6 }}>{r.company_name}</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 13, color: '#64748b' }}>
                                        {r.contact_name && <span>{r.contact_name}</span>}
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Mail size={13} /> {r.email}</span>
                                        {r.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={13} /> {r.phone}</span>}
                                        {r.deadline && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={13} /> {r.deadline}</span>}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    {r.proposal_total != null && (
                                        <div style={{ fontWeight: 800, fontSize: 18, color: '#1e2d7d', marginBottom: 6 }}>{r.proposal_total} грн</div>
                                    )}
                                    <select value={r.status} onChange={e => updateStatus(r.id, e.target.value as any)}
                                        style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, color: STATUS_OPTS.find(s => s.value === r.status)?.color || '#475569', cursor: 'pointer' }}>
                                        {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Brief table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        <th style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Товар</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Тираж</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Опції</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(r.brief || []).map((b, i) => (
                                        <tr key={i}>
                                            <td style={{ padding: '8px 10px', borderTop: '1px solid #f1f5f9' }}>{b.product}</td>
                                            <td style={{ padding: '8px 10px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>{b.qty} шт</td>
                                            <td style={{ padding: '8px 10px', borderTop: '1px solid #f1f5f9', color: '#64748b' }}>
                                                {b.options ? Object.entries(b.options).map(([k, v]) => `${k}: ${v}`).join(', ') : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {r.message && (
                                <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: '14px 0 0', background: '#f8fafc', padding: '10px 14px', borderRadius: 8 }}>{r.message}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
