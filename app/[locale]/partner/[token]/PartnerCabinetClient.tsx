'use client';

import React, { useEffect, useState } from 'react';
import { partnerRefLink } from '@/lib/partners/referral-link';

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
    visits?: number;
    paid_orders?: number;
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
    const [certNominal, setCertNominal] = useState(1725);
    const [certQty, setCertQty] = useState(1);
    const [certBuying, setCertBuying] = useState(false);

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

    // Buy gift certificates at the partner −10%: create the order, then send
    // the partner straight to Monobank payment (the certs are auto-issued and
    // emailed after payment by the standard certificate flow).
    const buyCertificates = async () => {
        if (certBuying) return;
        setCertBuying(true);
        try {
            const res = await fetch('/api/partnership/certificates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, nominal: certNominal, qty: certQty }),
            });
            const json = await res.json();
            if (!res.ok) { alert(json?.error || 'Помилка'); return; }
            const inv = await fetch('/api/monobank/create-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: json.orderId }),
            });
            const invJson = await inv.json();
            if (!inv.ok || !invJson?.pageUrl) { alert(invJson?.error || 'Не вдалося створити оплату — напишіть нам, замовлення ' + json.orderNumber); return; }
            window.location.href = invJson.pageUrl;
        } finally { setCertBuying(false); }
    };

    if (loading) return <Centered>Завантаження…</Centered>;
    if (error || !data) return <Centered>{error || 'Партнера не знайдено'}</Centered>;

    const canPayout = data.pending_payout >= minPayout;
    const isBlogger = data.partner_kind === 'travel_blogger';
    const isPhotographer = data.partner_kind === 'photographer';
    const kindLabel = isPhotographer ? 'Фотограф' : isBlogger ? 'Блогер' : 'Агенція';
    // Код кодується: партнерські коди роблять із назв агенцій, тож бувають
    // кириличними («ПОДОTABB»). У самому браузері такий рядок працює, але
    // варто скопіювати посилання в месенджер чи документ — і воно приїде
    // побитим. Відколи посилання стало головним інструментом партнера, ця
    // дрібниця коштує втраченої комісії.
    const refLink = partnerRefLink(data.referral_code);
    const CERT_NOMINALS = [675, 825, 975, 1125, 1425, 1725, 2025, 2350, 2900];
    const certUnit = Math.round(certNominal * 0.9 * 100) / 100;
    const certTotal = Math.round(certUnit * certQty * 100) / 100;

    return (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px 60px', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
            {notice && <div style={{ position: 'fixed', top: 16, right: 16, background: '#065f46', color: '#fff', borderRadius: 8, padding: '10px 16px', zIndex: 100, fontSize: 14 }}>{notice}</div>}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1e2d7d', margin: 0 }}>{data.agency_name}</h1>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: isPhotographer ? '#fef3c7' : isBlogger ? '#fce7f3' : '#e0e7ff', color: isPhotographer ? '#92400e' : isBlogger ? '#be185d' : '#3730a3' }}>{kindLabel}</span>
            </div>
            <p style={{ color: '#64748b', marginTop: 0, marginBottom: 20 }}>Ваш партнерський кабінет touch.memories</p>

            {/* Реферальне посилання — головний інструмент партнера.
                Раніше тут великим стояв код, а посилання йшло приміткою під ним.
                Це змінено (Діана, 16.09.2026): за посиланням знижка застосовується
                сама, а код вимагає, щоб клієнт його згадав і не помилився при
                введенні — зайвий крок рівно там, де людина вже готова платити.
                Код лишився нижче дрібним рядком, бо потрібен для замовлень, які
                оформлюють у директі чи телефоном, тобто без переходу за посиланням. */}
            <div style={{ ...card, background: '#eef2ff', border: '1px dashed #a5b4fc', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Ваше реферальне посилання</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1e2d7d', wordBreak: 'break-all', lineHeight: 1.4 }}>{refLink}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
                    Комісія: {data.travelbook_rate}% з тревелбуків і журналів · {data.other_rate}% з решти товарів
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 14 }}>
                    <button style={btn} onClick={() => copy(refLink, 'Посилання скопійовано')}>Скопіювати посилання</button>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10 }}>
                    Клієнт переходить за посиланням і бачить знижку вже в кошику, вводити нічого не треба.
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(165,180,252,0.5)' }}>
                    Якщо замовлення оформлюють без переходу за посиланням, той самий результат дає код{' '}
                    <b style={{ color: '#64748b', letterSpacing: '0.06em' }}>{data.referral_code}</b> — його вводять при оформленні.
                    <br />
                    <button style={{ ...btnGhost, marginTop: 8 }} onClick={() => copy(data.referral_code, 'Код скопійовано')}>Скопіювати код</button>
                </div>
            </div>

            {/* Переходи за посиланням і що з них вийшло.
                Окремим рядком над грошима: партнер без жодного замовлення досі
                не міг відрізнити «посилання ніхто не відкрив» від «відкривали,
                але не купували», а це різні проблеми з різними рішеннями.
                Конверсія рахується з того самого журналу нарахувань, що й
                гроші, тож два числа поруч ніколи не розійдуться. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
                <Stat label="Переходів за посиланням" value={String(data.visits ?? 0)} />
                <Stat label="Оплачених замовлень" value={String(data.paid_orders ?? 0)} />
                <Stat
                    label="Конверсія"
                    value={(data.visits ?? 0) > 0
                        ? `${Math.round(((data.paid_orders ?? 0) / (data.visits ?? 1)) * 100)}%`
                        : '—'}
                />
            </div>

            {/* Earnings */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
                <Stat label="Нараховано всього" value={uah(data.total_earned)} />
                <Stat label="Виплачено" value={uah(data.total_paid_out)} />
                <Stat label="До виплати" value={uah(data.pending_payout)} accent />
            </div>

            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, marginBottom: 16 }}>
                Переходом вважається відкриття вашого посилання. Повторні заходи за тим самим посиланням протягом доби рахуються один раз, щоб число показувало людей, а не кліки.
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
                        : `Накопичуйте комісію: виплата стає доступною від ${uah(minPayout)}. Нарахування відбувається автоматично після оплати замовлень за вашим посиланням.`}
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

            {/* Gift certificates at the partner −10% */}
            <div style={{ ...card, border: '1px solid #c7d2fe' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1e2d7d', marginBottom: 4 }}>Сертифікати зі знижкою −10%</div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
                    Купуйте подарункові сертифікати на Travel Book за партнерською ціною (−10% від номіналу) і даруйте клієнтам.
                    Сертифікат зберігає повний номінал, діє 3 місяці. Після оплати сертифікати автоматично надійдуть на ваш email.
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <label style={{ fontSize: 12, color: '#475569', fontWeight: 700 }}>
                        Номінал
                        <select value={certNominal} onChange={e => setCertNominal(Number(e.target.value))}
                            style={{ display: 'block', marginTop: 4, padding: '9px 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, minWidth: 130 }}>
                            {CERT_NOMINALS.map(n => <option key={n} value={n}>{n} ₴</option>)}
                        </select>
                    </label>
                    <label style={{ fontSize: 12, color: '#475569', fontWeight: 700 }}>
                        Кількість
                        <select value={certQty} onChange={e => setCertQty(Number(e.target.value))}
                            style={{ display: 'block', marginTop: 4, padding: '9px 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, minWidth: 80 }}>
                            {Array.from({ length: 20 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>
                    <button style={{ ...btn, background: certBuying ? '#94a3b8' : '#263A99' }} onClick={buyCertificates} disabled={certBuying}>
                        {certBuying ? 'Створюємо оплату…' : `Купити за ${certTotal.toLocaleString('uk-UA')} грн`}
                    </button>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10 }}>
                    {certQty} × сертифікат {certNominal} ₴ → ви платите {certUnit.toLocaleString('uk-UA')} грн за шт (замість {certNominal} ₴). Оплата картою онлайн.
                </div>
            </div>

            {/* Terms */}
            <div style={{ ...card, background: '#f8fafc' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1e2d7d', marginBottom: 8 }}>Умови партнерства</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
                    <li>Ваша комісія: <b>{data.travelbook_rate}%</b> з тревелбуків і глянцевих журналів, <b>{data.other_rate}%</b> з решти товарів — нараховується автоматично після оплати замовлення за вашим посиланням.</li>
                    <li>Клієнт за вашим посиланням отримує знижку на замовлення, і вона застосовується сама.</li>
                    <li>Сертифікати для дарування — зі знижкою <b>10%</b> (у цьому кабінеті), діють 3 місяці, зберігають повний номінал.</li>
                    <li>Виплата комісії — від <b>{uah(minPayout)}</b>, на вказаний вами рахунок.</li>
                </ul>
            </div>

            {/* Commission history */}
            <div style={card}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1e2d7d', marginBottom: 4 }}>Історія нарахувань</div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
                    Комісія нараховується після оплати замовлення за вашим посиланням.
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
                                        <td style={{ padding: '9px 6px', textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap', color: c.payout_status === 'cancelled' ? '#94a3b8' : '#1e2d7d', textDecoration: c.payout_status === 'cancelled' ? 'line-through' : 'none' }}>{uah(c.total_commission)}</td>
                                        <td style={{ padding: '9px 6px', textAlign: 'right' }}>
                                            {/* Скасоване нарахування показується окремо, а не як «Очікує».
                                                Замовлення скасували, комісію за ним зняли — і партнер має
                                                бачити саме це, а не суму, яка ніколи не прийде. */}
                                            {c.payout_status === 'paid'
                                                ? <span style={{ fontSize: 12, fontWeight: 700, color: '#065f46', background: '#ecfdf5', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>Виплачено</span>
                                                : c.payout_status === 'cancelled'
                                                    ? <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', background: '#f1f5f9', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>Скасовано</span>
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
