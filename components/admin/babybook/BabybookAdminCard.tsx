'use client';

import { useState, useEffect } from 'react';
import { Sparkles, ExternalLink, Loader2, Check, Clock, AlertCircle } from 'lucide-react';

const STAGE_LABELS: Record<string, string> = {
    brief: 'Анкета',
    character: 'Персонаж',
    story: 'Історія',
    images: 'Зображення',
    spreads: 'Розвороти',
    proof: 'Макет',
    done: 'Готово',
};

const STATUS_COLOR: Record<string, string> = {
    approved: '#16a34a',
    awaiting_approval: '#d97706',
    in_progress: '#3d56d6',
    error: '#dc2626',
    pending: '#94a3b8',
};

interface BabybookData {
    brief: any;
    stage: string | null;
    stages: Record<string, { status: string; at?: string }>;
    engineSlug: string | null;
    childPhotoUrls: string[];
    engineEnabled: boolean;
    cabinUrl: string | null;
    spec: { pages: number; spreads: number; stages: string[] };
}

export default function BabybookAdminCard({ orderId }: { orderId: string }) {
    const [data, setData] = useState<BabybookData | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        let alive = true;
        fetch(`/api/admin/babybook/${orderId}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (!alive) return;
                if (!d || !d.brief) { setNotFound(true); }
                else setData(d);
            })
            .catch(() => { if (alive) setNotFound(true); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [orderId]);

    if (loading) {
        return <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}><Loader2 size={20} className="animate-spin" /></div>;
    }
    // Not a babybook order — render nothing.
    if (notFound || !data) return null;

    const b = data.brief;

    return (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '24px', marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eef3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d56d6' }}>
                    <Sparkles size={20} />
                </div>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e2d7d', margin: 0 }}>Персоналізована казка</h2>
                    <div style={{ fontSize: 13, color: '#94a3b8' }}>{data.spec.pages} сторінок · {data.spec.spreads} розворотів · {b.scenario === 'designer' ? 'З дизайнером' : 'Самостійно'}</div>
                </div>
            </div>

            {/* Stage progress */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
                {data.spec.stages.map(st => {
                    const s = data.stages[st];
                    const status = s?.status || 'pending';
                    const isCurrent = data.stage === st;
                    return (
                        <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                            background: isCurrent ? '#eef3ff' : '#f8fafc', border: `1px solid ${isCurrent ? '#c7d2fe' : '#e2e8f0'}`, color: STATUS_COLOR[status] || '#94a3b8' }}>
                            {status === 'approved' ? <Check size={12} /> : status === 'error' ? <AlertCircle size={12} /> : <Clock size={12} />}
                            {STAGE_LABELS[st] || st}
                        </div>
                    );
                })}
            </div>

            {/* Brief details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
                <Detail label="Імʼя дитини" value={b.child_name} />
                <Detail label="Вік" value={b.child_age} />
                <Detail label="Стать" value={b.child_gender === 'girl' ? 'Дівчинка' : b.child_gender === 'boy' ? 'Хлопчик' : b.child_gender || '—'} />
                <Detail label="Тема" value={b.theme} />
            </div>

            {b.dedication && <Detail label="Присвята" value={b.dedication} block />}

            {Array.isArray(b.personal_details) && b.personal_details.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                    <div style={detailLabelStyle}>Деталі</div>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 14, color: '#374151' }}>
                        {b.personal_details.map((d: string, i: number) => <li key={i}>{d}</li>)}
                    </ul>
                </div>
            )}

            {Array.isArray(b.additional_characters) && b.additional_characters.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                    <div style={detailLabelStyle}>Додаткові персонажі</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                        {b.additional_characters.map((c: any, i: number) => (
                            <div key={i} style={{ fontSize: 14, color: '#374151' }}>
                                <strong>{c.name || `Персонаж ${i + 1}`}</strong>{c.appearance ? ` — ${c.appearance}` : ''}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Photos */}
            {data.childPhotoUrls.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                    <div style={detailLabelStyle}>Фото дитини</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
                        {data.childPhotoUrls.map((url, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={url} alt={`Фото ${i + 1}`} style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 10, border: '1px solid #e2e8f0' }} />
                        ))}
                    </div>
                </div>
            )}

            {/* Cabin link */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 18 }}>
                {data.engineEnabled && data.cabinUrl ? (
                    <a href={data.cabinUrl} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: '#263A99', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                        Відкрити кабіну генерації <ExternalLink size={15} />
                    </a>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, fontSize: 13, color: '#92400e' }}>
                        <Clock size={15} />
                        Двигун генерації ще не підключено. Кабіна стане доступною, щойно його налаштують.
                    </div>
                )}
            </div>
        </div>
    );
}

const detailLabelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em',
};

function Detail({ label, value, block }: { label: string; value: any; block?: boolean }) {
    return (
        <div style={block ? { marginBottom: 16 } : undefined}>
            <div style={detailLabelStyle}>{label}</div>
            <div style={{ fontSize: 15, color: '#1e2d7d', fontWeight: 600, marginTop: 2 }}>{value || '—'}</div>
        </div>
    );
}
