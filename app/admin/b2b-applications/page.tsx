'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Check, X, ExternalLink, RefreshCw, Clock, Camera, Heart } from 'lucide-react';

interface B2bApplication {
    id: string;
    customer_id: string | null;
    role: 'photographer' | 'wedding_agency';
    name: string | null;
    email: string;
    phone: string | null;
    portfolio_url: string;
    status: 'pending' | 'verified' | 'rejected';
    admin_note: string | null;
    created_at: string;
    reviewed_at: string | null;
}

const ROLE_LABEL: Record<string, string> = {
    photographer: 'Фотограф',
    wedding_agency: 'Весільна агенція',
};

const STATUS_COLOR: Record<string, string> = {
    pending: '#d97706',
    verified: '#16a34a',
    rejected: '#dc2626',
};
const STATUS_LABEL: Record<string, string> = {
    pending: 'На розгляді',
    verified: 'Підтверджено',
    rejected: 'Відхилено',
};

export default function B2bApplicationsPage() {
    const [apps, setApps] = useState<B2bApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'pending' | 'verified' | 'rejected' | 'all'>('pending');
    const [busyId, setBusyId] = useState<string | null>(null);

    const fetchApps = async () => {
        setLoading(true);
        try {
            const q = filter === 'all' ? '' : `?status=${filter}`;
            const res = await fetch(`/api/admin/b2b-applications${q}`);
            const data = await res.json();
            if (res.ok) setApps(data.applications || []);
            else toast.error(data.error || 'Не вдалося завантажити заявки');
        } catch {
            toast.error('Помилка завантаження');
        }
        setLoading(false);
    };

    useEffect(() => { fetchApps(); /* eslint-disable-next-line */ }, [filter]);

    const review = async (id: string, action: 'approve' | 'reject') => {
        setBusyId(id);
        try {
            const res = await fetch('/api/admin/b2b-applications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(action === 'approve' ? 'Підтверджено — лист надіслано' : 'Відхилено');
                fetchApps();
            } else {
                toast.error(data.error || 'Помилка');
            }
        } catch {
            toast.error('Помилка');
        }
        setBusyId(null);
    };

    return (
        <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1e2d7d', margin: 0 }}>Заявки B2B</h1>
                    <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0' }}>Фотографи та весільні агенції — підтвердження за портфоліо</p>
                </div>
                <button onClick={fetchApps} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14 }}>
                    <RefreshCw size={15} /> Оновити
                </button>
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {(['pending', 'verified', 'rejected', 'all'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        style={{
                            padding: '7px 16px', borderRadius: 20, border: '1px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            background: filter === f ? '#263A99' : '#fff',
                            color: filter === f ? '#fff' : '#475569',
                            borderColor: filter === f ? '#263A99' : '#e2e8f0',
                        }}>
                        {f === 'pending' ? 'На розгляді' : f === 'verified' ? 'Підтверджені' : f === 'rejected' ? 'Відхилені' : 'Усі'}
                    </button>
                ))}
            </div>

            {loading ? (
                <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>Завантаження…</p>
            ) : apps.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
                    <Clock size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                    <p>Заявок у цьому статусі немає</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {apps.map(app => (
                        <div key={app.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eef3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {app.role === 'photographer' ? <Camera size={20} color="#3d56d6" /> : <Heart size={20} color="#3d56d6" />}
                            </div>
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                                    <span style={{ fontWeight: 700, fontSize: 15, color: '#1e2d7d' }}>{app.name || '—'}</span>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 10 }}>{ROLE_LABEL[app.role]}</span>
                                </div>
                                <div style={{ fontSize: 13, color: '#64748b' }}>{app.email}{app.phone ? ` · ${app.phone}` : ''}</div>
                                <a href={app.portfolio_url} target="_blank" rel="noopener noreferrer"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#3d56d6', fontWeight: 600, marginTop: 4 }}>
                                    Портфоліо <ExternalLink size={12} />
                                </a>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLOR[app.status] }}>{STATUS_LABEL[app.status]}</span>
                            {app.status === 'pending' && (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button disabled={busyId === app.id} onClick={() => review(app.id, 'approve')}
                                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: busyId === app.id ? 0.6 : 1 }}>
                                        <Check size={15} /> Підтвердити
                                    </button>
                                    <button disabled={busyId === app.id} onClick={() => review(app.id, 'reject')}
                                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: busyId === app.id ? 0.6 : 1 }}>
                                        <X size={15} /> Відхилити
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
