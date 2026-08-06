'use client';

import { useState } from 'react';

/**
 * The confirmation step of the unsubscribe flow.
 *
 * The removal happens on a button press rather than on page load, because mail
 * gateways and link scanners open footer links by themselves — an automatic
 * unsubscribe on open would quietly drop recipients who never asked to leave.
 */
export default function UnsubscribeForm({
    token,
    email,
    campaignId,
}: {
    token: string;
    email: string;
    campaignId: string;
}) {
    const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const submit = async () => {
        setState('busy');
        try {
            const res = await fetch('/api/email/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, email, campaignId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Не вдалося відписатися');
            setMessage(
                data.alreadyInactive
                    ? 'Ця адреса вже була відписана раніше, тому нічого змінювати не довелося.'
                    : 'Готово, ми більше не надсилатимемо вам листів про акції та новини.'
            );
            setState('done');
        } catch (e: any) {
            setMessage(e?.message || 'Не вдалося відписатися. Спробуйте ще раз за хвилину.');
            setState('error');
        }
    };

    if (state === 'done') {
        return (
            <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: '#263A99', marginBottom: 12 }}>
                    Вас відписано
                </h1>
                <p style={{ color: '#475569', lineHeight: 1.6, marginBottom: 24 }}>
                    {message} Листи про ваші замовлення надходитимуть і далі, бо вони потрібні,
                    щоб ви знали про статус доставки.
                </p>
                <a
                    href="/"
                    style={{
                        display: 'inline-block', background: '#263A99', color: '#fff',
                        textDecoration: 'none', padding: '12px 24px', borderRadius: 10, fontWeight: 700,
                    }}
                >
                    Повернутися на сайт
                </a>
            </div>
        );
    }

    return (
        <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#263A99', marginBottom: 12 }}>
                Відписатися від розсилки
            </h1>
            <p style={{ color: '#475569', lineHeight: 1.6, marginBottom: 8 }}>
                {email
                    ? <>Ми більше не надсилатимемо листи про акції та новини на адресу <strong>{email}</strong>.</>
                    : <>Ми більше не надсилатимемо вам листи про акції та новини.</>}
            </p>
            <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                Листи про ваші замовлення це не зачепить, вони приходитимуть і далі.
            </p>

            <button
                onClick={submit}
                disabled={state === 'busy'}
                style={{
                    background: state === 'busy' ? '#94a3b8' : '#263A99', color: '#fff', border: 'none',
                    padding: '14px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700,
                    cursor: state === 'busy' ? 'not-allowed' : 'pointer',
                }}
            >
                {state === 'busy' ? 'Відписую…' : 'Так, відписатися'}
            </button>

            {state === 'error' && (
                <div style={{ marginTop: 18, padding: 14, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, color: '#991b1b', fontSize: 14 }}>
                    {message}
                </div>
            )}
        </div>
    );
}
