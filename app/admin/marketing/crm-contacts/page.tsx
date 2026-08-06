'use client';

import { useCallback, useEffect, useState } from 'react';

type Contact = {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    last_order_at: string | null;
    order_count: number | null;
    total_spend: number | null;
    source: string | null;
    imported_at: string;
    email_status: 'ok' | 'suspect' | 'invalid';
    email_status_reason: string | null;
    email_suggestion: string | null;
    subscriber_state: 'active' | 'unsubscribed' | 'none';
};

const tile: React.CSSProperties = {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 22px', flex: '1 1 200px',
};

const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: 12 };
const td: React.CSSProperties = { padding: '10px 12px', color: '#1e2d7d', fontSize: 13, borderTop: '1px solid #f1f5f9' };

function fmtDate(v: string | null) {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('uk-UA');
}

const STATE_LABEL: Record<Contact['subscriber_state'], { text: string; color: string; bg: string }> = {
    active: { text: 'у підписниках', color: '#166534', bg: '#dcfce7' },
    unsubscribed: { text: 'відписаний', color: '#991b1b', bg: '#fee2e2' },
    none: { text: 'не в розсилці', color: '#475569', bg: '#f1f5f9' },
};

const EMAIL_LABEL: Record<Contact['email_status'], { text: string; color: string; bg: string }> = {
    ok: { text: 'придатна', color: '#166534', bg: '#dcfce7' },
    suspect: { text: 'сумнівна', color: '#92400e', bg: '#fef3c7' },
    invalid: { text: 'непридатна', color: '#991b1b', bg: '#fee2e2' },
};

const STATUS_FILTERS: { key: string; label: string }[] = [
    { key: '', label: 'Усі' },
    { key: 'ok', label: 'Придатні' },
    { key: 'suspect', label: 'Сумнівні' },
    { key: 'invalid', label: 'Непридатні' },
];

export default function CrmContactsPage() {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState('');
    const [stats, setStats] = useState({ matched: 0, total: 0, withOrderDate: 0, badEmails: 0, pageSize: 50 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async (p: number, q: string, st: string) => {
        setLoading(true); setError('');
        try {
            const params = new URLSearchParams({ page: String(p) });
            if (q.trim()) params.set('search', q.trim());
            if (st) params.set('status', st);
            const res = await fetch(`/api/admin/crm-contacts?${params.toString()}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Не вдалося завантажити контакти');
            setContacts(data.contacts || []);
            setStats({
                matched: data.matched, total: data.total, withOrderDate: data.withOrderDate,
                badEmails: data.badEmails, pageSize: data.pageSize,
            });
        } catch (e: any) {
            setError(e?.message || 'Помилка завантаження');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(page, search, status); }, [page, status, load]);   // eslint-disable-line react-hooks/exhaustive-deps

    const totalPages = Math.max(1, Math.ceil(stats.matched / (stats.pageSize || 50)));

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '8px 4px' }}>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#263A99', marginBottom: 6 }}>Контакти зі старої CRM</h1>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
                База, підтягнута з KeyCRM через сторінку імпорту. Ці люди живлять автоматичний win-back.
                Щоб надсилати їм звичайну розсилку через розділ «Листи», їх треба окремо додати у підписників
                галочкою на сторінці імпорту.
            </p>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
                <div style={tile}>
                    <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>ВСЬОГО КОНТАКТІВ</div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: '#263A99' }}>{stats.total}</div>
                </div>
                <div style={tile}>
                    <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>З ДАТОЮ ЗАМОВЛЕННЯ</div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: '#263A99' }}>{stats.withOrderDate}</div>
                </div>
                <div style={tile}>
                    <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>ПРОБЛЕМНІ АДРЕСИ</div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: stats.badEmails > 0 ? '#b45309' : '#263A99' }}>{stats.badEmails}</div>
                </div>
                <div style={tile}>
                    <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>ЗНАЙДЕНО ЗА ФІЛЬТРОМ</div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: '#263A99' }}>{stats.matched}</div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                {STATUS_FILTERS.map(f => (
                    <button
                        key={f.key || 'all'}
                        onClick={() => { setStatus(f.key); setPage(1); }}
                        style={{
                            padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            border: status === f.key ? '1.5px solid #263A99' : '1.5px solid #e2e8f0',
                            background: status === f.key ? '#263A99' : '#fff',
                            color: status === f.key ? '#fff' : '#475569',
                        }}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <form
                onSubmit={e => { e.preventDefault(); setPage(1); load(1, search, status); }}
                style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}
            >
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Пошук за поштою, іменем або телефоном…"
                    style={{
                        flex: '1 1 320px', padding: '11px 14px', border: '1.5px solid #e2e8f0',
                        borderRadius: 10, fontSize: 14, color: '#1e2d7d', background: '#fff',
                    }}
                />
                <button
                    type="submit"
                    style={{ padding: '11px 24px', background: '#263A99', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                >
                    Знайти
                </button>
                {search && (
                    <button
                        type="button"
                        onClick={() => { setSearch(''); setPage(1); load(1, '', status); }}
                        style={{ padding: '11px 20px', background: '#fff', color: '#475569', border: '1.5px solid #e2e8f0', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                    >
                        Скинути
                    </button>
                )}
            </form>

            {error && (
                <div style={{ padding: 16, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, color: '#991b1b', fontSize: 14, marginBottom: 18 }}>
                    {error}
                </div>
            )}

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                    <thead>
                        <tr>
                            <th style={th}>EMAIL</th>
                            <th style={th}>ІМʼЯ</th>
                            <th style={th}>ТЕЛЕФОН</th>
                            <th style={th}>ОСТАННЄ ЗАМОВЛЕННЯ</th>
                            <th style={th}>К-СТЬ</th>
                            <th style={th}>СУМА</th>
                            <th style={th}>АДРЕСА</th>
                            <th style={th}>СТАТУС РОЗСИЛКИ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr><td style={{ ...td, color: '#94a3b8' }} colSpan={8}>Завантажую…</td></tr>
                        )}
                        {!loading && contacts.length === 0 && (
                            <tr><td style={{ ...td, color: '#94a3b8' }} colSpan={8}>Нічого не знайшлося</td></tr>
                        )}
                        {!loading && contacts.map(c => {
                            const badge = STATE_LABEL[c.subscriber_state];
                            const mail = EMAIL_LABEL[c.email_status] || EMAIL_LABEL.ok;
                            return (
                                <tr key={c.id}>
                                    <td style={td}>{c.email}</td>
                                    <td style={td}>{c.name || '—'}</td>
                                    <td style={td}>{c.phone || '—'}</td>
                                    <td style={td}>{fmtDate(c.last_order_at)}</td>
                                    <td style={td}>{c.order_count || '—'}</td>
                                    <td style={td}>{c.total_spend ? `${Number(c.total_spend).toFixed(0)} ₴` : '—'}</td>
                                    <td style={td}>
                                        <span style={{ background: mail.bg, color: mail.color, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                                            {mail.text}
                                        </span>
                                        {c.email_status_reason && (
                                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                                                {c.email_status_reason}
                                                {c.email_suggestion ? `, можливо ${c.email_suggestion}` : ''}
                                            </div>
                                        )}
                                    </td>
                                    <td style={td}>
                                        <span style={{ background: badge.bg, color: badge.color, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                                            {badge.text}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', marginTop: 20 }}>
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        style={{ padding: '9px 18px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 9, color: page <= 1 ? '#cbd5e1' : '#263A99', fontWeight: 600, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
                    >
                        Назад
                    </button>
                    <span style={{ fontSize: 13, color: '#64748b' }}>Сторінка {page} з {totalPages}</span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        style={{ padding: '9px 18px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 9, color: page >= totalPages ? '#cbd5e1' : '#263A99', fontWeight: 600, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
                    >
                        Далі
                    </button>
                </div>
            )}
        </div>
    );
}
