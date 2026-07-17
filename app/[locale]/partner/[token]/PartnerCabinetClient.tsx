'use client';

import React, { useEffect, useState } from 'react';

interface Commission {
    id: string;
    order_number: string;
    total_commission: number;
    payout_status: string;
    paid_at: string | null;
    created_at: string;
}

interface PartnerData {
    agency_name: string;
    contact_name: string | null;
    referral_code: string;
    partner_kind: string;
    travelbook_rate: number;
    other_rate: number;
    total_earned: number;
    total_paid_out: number;
    pending_payout: number;
    payout_account: string;
    payout_requested_at: string | null;
    status: string;
}

const uah = (n: number) => `${(Math.round((n || 0) * 100) / 100).toLocaleString('uk-UA')} грн`;
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' };
const btn: React.CSSProperties = { padding: '10px 20px', background: '#263A99', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { ...btn, background: '#eef2ff', color: '#1e2d7d' };

export default function PartnerCabinetClient({ token }: { token: string }) {
    const [data, setData] = useState<PartnerData | null>(null);
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [minPayout, setMinPayout] = useState(500);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [account, setAccount] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [requesting, setRequesting] = useState(false);
    const [notice, setNotice] = useState('');

    const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 2500); };

    const load = async () => {
        try {
            const res = await fetch(`/api/partnership/partner?token=${encodeURIComponent(token)}`);
            const json = await res.json();
            if (!res.ok) { setError(json?.error || 'Помилка'); return; }
            setData(json.partner);
            setCommissions(json.commissions || []);
            setMinPayout(json.min_payout || 500);
            setAccount(json.partner.payout_account || '');
        } catch { setError('Не вдалося завантажити'); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

    const save = async () => {
        setSaving(true); setSaved(false);
        try {
            const res = await fetch('/api/partnership/partner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, payout_account: account }),
            });
            if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); await load(); }
        } finally { setSaving(false); }
    };

    const requestPayout = async () => {
        if (requesting) return;
        setRequesting(true);
        try {
            const res = await fetch('/api/partnership/partner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, action: 'request_payout' }),
            });
            const json = await res.json();
            if (!res.ok) { alert(json?.error || 'Помилка'); return; }
            await load();
            flash('Запит на виплату надіслано!');
        } finally { setRequesting(false); }
    };

    const copy = (text: string, msg: string) => {
        navigator.clipboard.writeText(text);
        flash(msg);
    };

    if (loading) return <Centered>Завантаження…</Centered>;
    if (error || !data) return <Centered>{error || 'Партнера не знайдено'}</Centered>;

    const canPayout = data.pending_payout >= minPayout;
    const isBlogger = data.partner_kind === 'travel_blogger';
    const refLink = `https://touchmemories.com.ua/?ref=${data.referral_code}`;

    return (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px 60px', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
            {notice && <div style={{ position: 'fixed', top: 16, right: 16, background: '#065f46', color: '#fff', borderRadius: 8, padding: '10px 16px', zIndex: 100, fontSize: 14 }}>{notice}</div>}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1e2d7d', margin: 0 }}>{data.agency_name}</h1>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: isBlogger ? '#fce7f3' : '#e0e7ff', color: isBlogger ? '#be185d' : '#3730a3' }}>{isBlogger ? 'Блогер' : 'Агенція'}</span>
            </div>
            <p style={{ color: '#64748b', marginTop: 0, marginBottom: 20 }}>Ваш партнерський кабінет touch.memories</p>

            {/* Referral code + shareable link */}
            <div style={{ ...card, background: '#eef2ff', border: '1px dashed #a5b4fc', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Ваш промокод</div>
                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '0.1em', color: '#1e2d7d' }}>{data.referral_code}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
                    Комісія: {data.travelbook_rate}% з тревелбуків · {data.other_rate}% з решти товарів
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 14 }}>
                    <button style={btnGhost} onClick={() => copy(data.referral_code, 'Промокод скопійовано')}>Скопіювати код</button>
                    <button style={btn} onClick={() => copy(refLink, 'Посилання скопійовано')}>Скопіювати посилання</button>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10, wordBreak: 'break-all' }}>
                    {refLink}
                    <br />За цим посиланням знижка клієнту застосується автоматично — код вводити не треба.
                </div>
            </div>

            {/* Earnings */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
                <Stat label="Нараховано всього" value={uah(data.total_earned)} />
                <Stat label="Виплачено" value={uah(data.total_paid_out)} />
                <Stat label="До виплати" value={uah(data.pending_payout)} accent />
            </div>

            {/* Payout */}
            <div style={{ ...card, background: canPayout ? '#ecfdf5' : '#fff7ed', border: `1px solid ${canPayout ? '#a7f3d0' : '#fed7aa'}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: canPayout ? '#047857' : '#c2410c', marginBottom: 4 }}>
                    {canPayout ? 'Можна виводити' : `Мінімальна сума виведення — ${uah(minPayout)}`}
                </div>
                <div style={{ fontSize: 13, color: '#475569' }}>
                    {canPayout
                        ? (data.payout_requested_at
                            ? `Запит на виплату надіслано ${new Date(data.payout_requested_at).toLocaleDateString('uk-UA')} — обробляємо, кошти надійдуть на вказаний рахунок.`
                            : 'Сума до виплати перевищує мінімум. Перевірте рахунок нижче й натисніть кнопку.')
                        : `Накопичуйте комісію: виплата стає доступною від ${uah(minPayout)}. Нарахування відбувається автоматично після оплати замовлень за вашим кодом.`}
                </div>
                {canPayout && !data.payout_requested_at && (
                    <button style={{ ...btn, marginTop: 12, background: '#047857' }} onClick={requestPayout} disabled={requesting}>
                        {requesting ? 'Надсилаємо…' : `Запросити виплату ${uah(data.pending_payout)}`}
                    </button>
                )}
                {canPayout && data.payout_requested_at && (
                    <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: '#047857' }}>⏳ Запит в обробці</div>
                )}
            </div>

            {/* Commission history */}
            <div style={card}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1e2d7d', marginBottom: 4 }}>Історія нарахувань</div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
                    Комісія нараховується після оплати замовлення за вашим кодом чи посиланням.
                </div>
                {commissions.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: 14, padding: '10px 0' }}>
                        Поки що нарахувань немає — поділіться своїм посиланням із клієнтами.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ textAlign: 'left', color: '#64748b' }}>
                                    <th style={{ padding: '8px 6px', fontWeight: 700 }}>Дата</th>
                                    <th style={{ padding: '8px 6px', fontWeight: 700 }}>Замовлення</th>
                                    <th style={{ padding: '8px 6px', fontWeight: 700, textAlign: 'right' }}>Комісія</th>
                                    <th style={{ padding: '8px 6px', fontWeight: 700, textAlign: 'right' }}>Статус</th>
                                </tr>
                            </thead>
                            <tbody>
                                {commissions.map(c => (
                                    <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '9px 6px', whiteSpace: 'nowrap' }}>{new Date(c.created_at).toLocaleDateString('uk-UA')}</td>
                                        <td style={{ padding: '9px 6px', fontWeight: 600 }}>{c.order_number}</td>
                                        <td style={{ padding: '9px 6px', textAlign: 'right', fontWeight: 800, color: '#1e2d7d', whiteSpace: 'nowrap' }}>{uah(c.total_commission)}</td>
                                        <td style={{ padding: '9px 6px', textAlign: 'right' }}>
                                            {c.payout_status === 'paid'
                                                ? <span style={{ fontSize: 12, fontWeight: 700, color: '#065f46', background: '#ecfdf5', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>Виплачено</span>
                                                : <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e', background: '#fffbeb', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>Очікує</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Bank account */}
            <div style={card}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Рахунок для виведення коштів</label>
                <textarea
                    value={account}
                    onChange={e => setAccount(e.target.value)}
                    placeholder="Номер картки або IBAN, ПІБ отримувача, призначення"
                    rows={3}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                    <button onClick={save} disabled={saving} style={{ ...btn, background: saving ? '#94a3b8' : '#263A99' }}>
                        {saving ? 'Збереження…' : 'Зберегти рахунок'}
                    </button>
                    {saved && <span style={{ color: '#047857', fontSize: 14, fontWeight: 600 }}>Збережено</span>}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10 }}>Ці дані бачимо лише ми — для проведення виплат вашої комісії.</div>
            </div>
        </div>
    );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    return (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: accent ? '#1e2d7d' : '#0f172a' }}>{value}</div>
        </div>
    );
}

function Centered({ children }: { children: React.ReactNode }) {
    return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontFamily: 'Arial, sans-serif', padding: 20, textAlign: 'center' }}>{children}</div>;
}
