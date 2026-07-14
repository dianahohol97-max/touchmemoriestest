'use client';

import React, { useEffect, useState } from 'react';

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
    status: string;
}

const uah = (n: number) => `${(Math.round((n || 0) * 100) / 100).toLocaleString('uk-UA')} грн`;

export default function PartnerCabinetClient({ token }: { token: string }) {
    const [data, setData] = useState<PartnerData | null>(null);
    const [minPayout, setMinPayout] = useState(500);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [account, setAccount] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/partnership/partner?token=${encodeURIComponent(token)}`);
                const json = await res.json();
                if (!res.ok) { setError(json?.error || 'Помилка'); return; }
                setData(json.partner);
                setMinPayout(json.min_payout || 500);
                setAccount(json.partner.payout_account || '');
            } catch { setError('Не вдалося завантажити'); }
            finally { setLoading(false); }
        })();
    }, [token]);

    const save = async () => {
        setSaving(true); setSaved(false);
        try {
            const res = await fetch('/api/partnership/partner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, payout_account: account }),
            });
            if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
        } finally { setSaving(false); }
    };

    if (loading) return <Centered>Завантаження…</Centered>;
    if (error || !data) return <Centered>{error || 'Партнера не знайдено'}</Centered>;

    const canPayout = data.pending_payout >= minPayout;
    const isBlogger = data.partner_kind === 'travel_blogger';

    return (
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 60px', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1e2d7d', margin: 0 }}>{data.agency_name}</h1>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: isBlogger ? '#fce7f3' : '#e0e7ff', color: isBlogger ? '#be185d' : '#3730a3' }}>{isBlogger ? 'Блогер' : 'Агенція'}</span>
            </div>
            <p style={{ color: '#64748b', marginTop: 0, marginBottom: 24 }}>Ваш партнерський кабінет touch.memories</p>

            {/* Referral code */}
            <div style={{ background: '#eef2ff', border: '1px dashed #a5b4fc', borderRadius: 12, padding: 18, textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Ваш промокод</div>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '0.1em', color: '#1e2d7d' }}>{data.referral_code}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>Комісія: {data.travelbook_rate}% з тревелбуків · {data.other_rate}% з решти товарів</div>
            </div>

            {/* Earnings */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                <Stat label="Нараховано всього" value={uah(data.total_earned)} />
                <Stat label="Виплачено" value={uah(data.total_paid_out)} />
                <Stat label="До виплати" value={uah(data.pending_payout)} accent />
            </div>

            {/* Payout status */}
            <div style={{ background: canPayout ? '#ecfdf5' : '#fff7ed', border: `1px solid ${canPayout ? '#a7f3d0' : '#fed7aa'}`, borderRadius: 12, padding: 16, marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: canPayout ? '#047857' : '#c2410c', marginBottom: 4 }}>
                    {canPayout ? 'Можна виводити 🎉' : `Мінімальна сума виведення — ${uah(minPayout)}`}
                </div>
                <div style={{ fontSize: 13, color: '#475569' }}>
                    {canPayout
                        ? 'Ваша сума до виплати перевищує мінімум. Вкажіть рахунок нижче — і ми проведемо виплату.'
                        : `Накопичуйте комісію: виплата стає доступною, коли сума до виплати досягне ${uah(minPayout)}. Нарахування відбувається автоматично після оплати замовлень за вашим кодом.`}
                </div>
            </div>

            {/* Bank account */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Рахунок для виведення коштів</label>
                <textarea
                    value={account}
                    onChange={e => setAccount(e.target.value)}
                    placeholder="Номер картки або IBAN, ПІБ отримувача, призначення"
                    rows={3}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                    <button onClick={save} disabled={saving}
                        style={{ padding: '10px 20px', background: saving ? '#94a3b8' : '#263A99', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
                        {saving ? 'Збереження…' : 'Зберегти рахунок'}
                    </button>
                    {saved && <span style={{ color: '#047857', fontSize: 14, fontWeight: 600 }}>Збережено ✓</span>}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10 }}>Ці дані бачимо лише ми — для проведення виплат вашої комісії.</div>
            </div>
        </div>
    );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    return (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: accent ? '#1e2d7d' : '#0f172a' }}>{value}</div>
        </div>
    );
}

function Centered({ children }: { children: React.ReactNode }) {
    return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontFamily: 'Arial, sans-serif', padding: 20, textAlign: 'center' }}>{children}</div>;
}
