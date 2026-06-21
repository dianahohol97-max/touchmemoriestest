'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { RefreshCw, ExternalLink, Globe, Mail, Phone } from 'lucide-react';

interface PartnershipRequest {
    id: string;
    kind: string;
    agency_name: string;
    contact_name: string | null;
    email: string;
    phone: string | null;
    website: string | null;
    interested_model: string | null;
    message: string | null;
    status: 'new' | 'contacted' | 'active' | 'declined';
    created_at: string;
}

const MODEL_LABEL: Record<string, string> = {
    gift_certificates: 'Подарункові сертифікати',
    referral: 'Реферальна програма',
    cobranded: 'Co-branded тревелбуки',
    not_sure: 'Ще не визначилися',
};

const STATUS_OPTS: { value: PartnershipRequest['status']; label: string; color: string }[] = [
    { value: 'new', label: 'Нова', color: '#d97706' },
    { value: 'contacted', label: 'Звʼязалися', color: '#3d56d6' },
    { value: 'active', label: 'Активна', color: '#16a34a' },
    { value: 'declined', label: 'Відхилена', color: '#dc2626' },
];

export default function PartnershipRequestsPage() {
    const [requests, setRequests] = useState<PartnershipRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'new' | 'all'>('new');

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/partnership-requests?status=${filter}`);
            const data = await res.json();
            if (res.ok) setRequests(data.requests || []);
            else toast.error(data.error || 'Помилка завантаження');
        } catch {
            toast.error('Помилка завантаження');
        }
        setLoading(false);
    };

    useEffect(() => { fetchRequests(); /* eslint-disable-next-line */ }, [filter]);

    const updateStatus = async (id: string, status: PartnershipRequest['status']) => {
        try {
            const res = await fetch('/api/admin/partnership-requests', {
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
                    <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1e2d7d', margin: 0 }}>Заявки на партнерство</h1>
                    <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0' }}>Тревел-агенції — індивідуальні умови співпраці</p>
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
                    <Globe size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                    <p>Заявок немає</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {requests.map(r => (
                        <div key={r.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 22px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: 220 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                        <span style={{ fontWeight: 700, fontSize: 16, color: '#1e2d7d' }}>{r.agency_name}</span>
                                        {r.interested_model && (
                                            <span style={{ fontSize: 11, fontWeight: 600, color: '#3d56d6', background: '#eef3ff', padding: '2px 8px', borderRadius: 10 }}>
                                                {MODEL_LABEL[r.interested_model] || r.interested_model}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                                        {r.contact_name && <span>{r.contact_name}</span>}
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Mail size={13} /> {r.email}</span>
                                        {r.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={13} /> {r.phone}</span>}
                                        {r.website && <a href={r.website} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#3d56d6', fontWeight: 600 }}>Сайт <ExternalLink size={12} /></a>}
                                    </div>
                                    {r.message && <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: '8px 0 0', background: '#f8fafc', padding: '10px 14px', borderRadius: 8 }}>{r.message}</p>}
                                </div>
                                <select value={r.status} onChange={e => updateStatus(r.id, e.target.value as any)}
                                    style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, color: STATUS_OPTS.find(s => s.value === r.status)?.color || '#475569', cursor: 'pointer' }}>
                                    {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
