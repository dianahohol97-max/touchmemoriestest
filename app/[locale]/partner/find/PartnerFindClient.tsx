'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { FIND_CABINET_REPLY } from '@/lib/partners/find-cabinet';

const LOCALES = ['uk', 'en', 'ro', 'pl', 'de'];

/**
 * Форма «знайти мій кабінет».
 *
 * Екран НІКОЛИ не показує ні посилання, ні назву агенції, ні натяку на те, чи
 * така пошта в системі є: після сабміту тут зʼявляється один і той самий текст
 * незалежно від того, що сталося на сервері. Інакше форму можна було б
 * перебором перетворити на довідник партнерів.
 */
export default function PartnerFindClient() {
    const params = useParams();
    const rawLocale = Array.isArray(params?.locale) ? params.locale[0] : params?.locale;
    const lang = LOCALES.includes(String(rawLocale)) ? String(rawLocale) : 'uk';

    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            const res = await fetch('/api/partnership/find-cabinet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const json = await res.json().catch(() => ({}));
            // Єдина відмінна відповідь — перевищений ліміт спроб, і вона теж
            // нічого не каже про саму пошту.
            if (res.status === 429) {
                setError(json?.message || 'Забагато спроб. Спробуйте трохи згодом.');
                return;
            }
            setDone(true);
        } catch {
            setError('Не вдалося звʼязатися із сервером. Спробуйте ще раз за хвилину.');
        } finally {
            setBusy(false);
        }
    };

    const wrap: React.CSSProperties = { minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'Arial, sans-serif', color: '#475569', textAlign: 'center', padding: 20 };
    const btn: React.CSSProperties = { background: '#263A99', color: '#fff', borderRadius: 10, padding: '12px 24px', fontWeight: 800, fontSize: 15, border: 'none', cursor: 'pointer' };
    const input: React.CSSProperties = { width: '100%', border: '1px solid #cbd5e1', borderRadius: 10, padding: '12px 14px', fontSize: 15, outline: 'none' };

    if (done) {
        return (
            <div style={wrap}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#263A99' }}>Перевірте пошту</div>
                <div style={{ maxWidth: 460, lineHeight: 1.55 }}>{FIND_CABINET_REPLY}</div>
                <a href={`/${lang}/partner/cabinet`} style={{ color: '#263A99', fontSize: 13, fontWeight: 700 }}>
                    Маєте акаунт на цю саму пошту? Заходьте одразу →
                </a>
            </div>
        );
    }

    return (
        <div style={wrap}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#263A99' }}>Знайти мій кабінет</div>
            <div style={{ maxWidth: 460, lineHeight: 1.55 }}>
                Вкажіть пошту, на яку оформлена ваша співпраця з touch.memories, і ми надішлемо на неї посилання
                на партнерський кабінет. Показати посилання тут, на екрані, ми не можемо — воно відкриває кабінет
                без пароля, тому йде тільки на вашу скриньку.
            </div>
            <form onSubmit={submit} style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                    style={input}
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="studio@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                />
                <button type="submit" style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={busy}>
                    {busy ? 'Надсилаємо…' : 'Надіслати посилання'}
                </button>
            </form>
            {error && <div style={{ color: '#b91c1c', fontSize: 13, maxWidth: 400 }}>{error}</div>}
            <div style={{ fontSize: 13, color: '#94a3b8', maxWidth: 460, lineHeight: 1.55 }}>
                Якщо у вас є акаунт на сайті на цю саму пошту, кабінет відкривається і без листа — просто
                увійдіть і зайдіть на <a href={`/${lang}/partner/cabinet`} style={{ color: '#263A99', fontWeight: 700 }}>сторінку кабінету</a>.
                Ще не партнер? <a href={`/${lang}/travel-agencies/apply`} style={{ color: '#263A99', fontWeight: 700 }}>Залиште заявку</a>.
            </div>
        </div>
    );
}
