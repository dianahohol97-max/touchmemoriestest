'use client';

import { useState } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { Check, Loader2 } from 'lucide-react';

/** Локалі сайту. Усе, що поза списком, читаємо як українську. */
const LOCALES = ['uk', 'en', 'ro', 'pl', 'de'];

/**
 * Заявка на партнерство — форма і тільки форма.
 *
 * Раніше цей файл звався TravelAgenciesClient і тримав два режими: лендінг із
 * описом моделей співпраці і саму форму. Лендінг переїхав на три серверні
 * сторінки (/partnery і дві профільні), бо текст, який має ранжуватися, не
 * повинен приїжджати клієнтським компонентом. Тут лишилося те, заради чого
 * компонент і був клієнтським, — стан форми.
 *
 * `defaultKind` приходить з адреси: кнопка «Зареєструватися як блогер» на
 * лендінгу веде на /partnery/apply?kind=blogger. Перемикач лишається видимим і
 * змінюваним — людина, яка помилилася дверима, не мусить повертатися назад.
 * Саме це значення їде в `partnership_requests.kind`, а звідти при схваленні
 * стає `agency_partners.partner_kind`.
 */
export default function PartnerApplyClient({
    locale = 'uk',
    defaultKind = 'travel_agency',
}: {
    locale?: string;
    defaultKind?: 'travel_agency' | 'travel_blogger';
}) {
    const lang = LOCALES.includes(locale) ? locale : 'uk';
    const [agencyName, setAgencyName] = useState('');
    const [contactName, setContactName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [website, setWebsite] = useState('');
    const [interestedModel, setInterestedModel] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    // Заявка не створена, бо на цю пошту вже є партнер або заявка на розгляді.
    // Це не помилка заповнення, тому й показується інакше — спокійним блоком із
    // дорогою далі, а не червоним рядком під полями (Діана, 16.09.2026).
    const [notice, setNotice] = useState<{ message: string; cabinetUrl: string | null } | null>(null);
    const [done, setDone] = useState(false);
    // Photographers have their own workflow at /photographers — removed from
    // this form per Diana («фотографів саме звідси треба забрати»).
    const [kind, setKind] = useState<'travel_agency' | 'travel_blogger'>(defaultKind);
    const isBlogger = kind === 'travel_blogger';

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setNotice(null);
        if (!agencyName.trim() || !email.trim()) {
            setError('Вкажіть назву та email.');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('/api/partnership/travel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind, agencyName, contactName, email, phone, website, interestedModel, message }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (data?.code === 'active_partner' || data?.code === 'pending_request') {
                    setNotice({ message: data.error, cabinetUrl: data.cabinetUrl || null });
                } else {
                    setError(data.error || 'Сталася помилка.');
                }
                setLoading(false);
                return;
            }
            setDone(true);
        } catch {
            setError('Сталася помилка. Спробуйте ще раз.');
        }
        setLoading(false);
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
            <Navigation />
            <main style={{ flex: 1, paddingTop: 110, paddingBottom: 80 }}>
                <section style={{ padding: '40px 0 40px' }}>
                    <div className="container" style={{ maxWidth: 620 }}>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '40px 36px', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}>
                            {done ? (
                                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                        <Check size={32} color="#16a34a" />
                                    </div>
                                    <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1e2d7d', marginBottom: 12 }}>Дякуємо за заявку!</h2>
                                    <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.7, margin: 0 }}>
                                        Ми звʼяжемося з вами найближчим часом, щоб обговорити деталі співпраці.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {notice && (
                                        <div style={{ background: '#eef3ff', border: '1px solid #c7d6ff', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
                                            <p style={{ fontSize: 14, lineHeight: 1.7, color: '#1e2d7d', margin: 0 }}>{notice.message}</p>
                                            {notice.cabinetUrl && (
                                                <a href={notice.cabinetUrl} style={{ display: 'inline-block', marginTop: 10, color: '#263A99', fontWeight: 700, fontSize: 14 }}>
                                                    Увійти в партнерський кабінет →
                                                </a>
                                            )}
                                        </div>
                                    )}
                                    <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e2d7d', marginBottom: 6, textAlign: 'center' }}>Хочемо співпрацювати</h1>
                                    <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 20, textAlign: 'center' }}>Залиште контакти — і ми обговоримо найкращі умови співпраці</p>

                                    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                            {([['travel_agency', 'Агенція'], ['travel_blogger', 'Блогер']] as const).map(([val, label]) => (
                                                <button key={val} type="button" onClick={() => setKind(val)}
                                                    style={{ padding: '10px 12px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                                                        border: kind === val ? '2px solid #263A99' : '1px solid #e2e8f0',
                                                        background: kind === val ? '#263A99' : '#fff', color: kind === val ? '#fff' : '#475569' }}>
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                        <Field label={isBlogger ? 'Імʼя / назва блогу' : 'Назва агенції'} required>
                                            <input value={agencyName} onChange={e => setAgencyName(e.target.value)} required placeholder={isBlogger ? 'Ваше імʼя або назва блогу' : 'Назва вашої агенції'} style={inputStyle} />
                                        </Field>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <Field label="Контактна особа">
                                                <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Імʼя" style={inputStyle} />
                                            </Field>
                                            <Field label="Телефон">
                                                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+380…" style={inputStyle} />
                                            </Field>
                                        </div>
                                        <Field label="Email" required>
                                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="агенція@пошта.com" style={inputStyle} />
                                        </Field>
                                        <Field label={isBlogger ? 'Ваш блог або сторінка' : 'Сайт або сторінка агенції'} required>
                                            {/* Required — the application is reviewed BY HAND (Diana,
                                                2026-08-04), and the page/portfolio link is what the
                                                review actually looks at. An optional field here meant
                                                applications arrived with nothing to check. */}
                                            <input value={website} onChange={e => setWebsite(e.target.value)} required placeholder="Instagram або вебсайт" style={inputStyle} />
                                        </Field>
                                        <Field label="Яка модель вас цікавить?">
                                            <select value={interestedModel} onChange={e => setInterestedModel(e.target.value)} style={inputStyle}>
                                                <option value="">Оберіть (необовʼязково)</option>
                                                <option value="gift_certificates">Подарункові сертифікати</option>
                                                <option value="referral">Реферальна програма</option>
                                                {/* <option value="cobranded">Co-branded тревелбуки</option> — hidden for now */}
                                                <option value="not_sure">Ще не визначилися</option>
                                            </select>
                                        </Field>
                                        <Field label="Повідомлення">
                                            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Розкажіть трохи про вашу агенцію або питання…" style={{ ...inputStyle, resize: 'vertical' }} />
                                        </Field>

                                        {error && <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{error}</p>}

                                        <button type="submit" disabled={loading}
                                            style={{ width: '100%', padding: 15, background: loading ? '#9ca3af' : '#263A99', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                            {loading && <Loader2 size={16} className="animate-spin" />}
                                            {loading ? 'Надсилається…' : 'Надіслати заявку'}
                                        </button>
                                    </form>
                                    <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', margin: '16px 0 0' }}>
                                        Вже наш партнер? <a href={`/${lang}/partner/cabinet`} style={{ color: '#263A99', fontWeight: 700 }}>Увійти в кабінет →</a>
                                    </p>
                                    <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', margin: '8px 0 0' }}>
                                        Умови під ваш випадок: <a href={`/${lang}/partnerska-programa-dlya-blogeriv`} style={{ color: '#263A99', fontWeight: 700 }}>для блогерів</a>
                                        {' '}або <a href={`/${lang}/partnerska-programa-dlya-turagentstv`} style={{ color: '#263A99', fontWeight: 700 }}>для турагентств</a>.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </section>
            </main>
            <Footer categories={[]} />
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 15, outline: 'none', boxSizing: 'border-box', background: '#fff',
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
            </label>
            {children}
        </div>
    );
}
