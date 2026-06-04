'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Mail, Save, Eye, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface AutomationEmail {
    key: string;
    label: string;
    enabled: boolean;
    subject: string | null;
    body: string | null;
    promo_code: string | null;
    sort: number;
}

const TRIGGER_HINTS: Record<string, string> = {
    welcome: 'Одразу після підписки',
    welcome_step2: '≈ через 2 дні після підписки',
    welcome_step3: '≈ через 4 дні після підписки',
    abandoned_cart: 'Кошик без замовлення 4–72 год',
    winback: 'Останнє замовлення 60–540 днів тому',
    birthday: 'У день народження клієнта',
    order_placed: 'Одразу після оформлення замовлення',
    order_paid_full: 'Monobank підтвердив повну оплату',
    order_paid_prepayment: 'Monobank підтвердив передоплату (50%)',
    order_shipped: 'При створенні ТТН',
};

const ORDER_KEYS = ['order_placed', 'order_paid_full', 'order_paid_prepayment', 'order_shipped'];

export default function EmailAutomationsPage() {
    const supabase = createClient();
    const [rows, setRows] = useState<AutomationEmail[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            const { data, error } = await supabase
                .from('automation_emails')
                .select('*')
                .order('sort', { ascending: true });
            if (error) toast.error('Не вдалося завантажити листи');
            setRows((data as AutomationEmail[]) || []);
            setLoading(false);
        })();
    }, []);

    const update = (key: string, patch: Partial<AutomationEmail>) => {
        setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
    };

    const save = async (row: AutomationEmail) => {
        setSavingKey(row.key);
        const { error } = await supabase
            .from('automation_emails')
            .update({
                enabled: row.enabled,
                subject: row.subject,
                body: row.body,
                promo_code: row.promo_code || null,
                updated_at: new Date().toISOString(),
            })
            .eq('key', row.key);
        setSavingKey(null);
        if (error) {
            toast.error('Помилка збереження');
            return;
        }
        toast.success('Збережено');
    };

    const toggle = async (row: AutomationEmail) => {
        const next = !row.enabled;
        update(row.key, { enabled: next });
        const { error } = await supabase
            .from('automation_emails')
            .update({ enabled: next, updated_at: new Date().toISOString() })
            .eq('key', row.key);
        if (error) {
            update(row.key, { enabled: row.enabled });
            toast.error('Не вдалося змінити статус');
        } else {
            toast.success(next ? 'Лист увімкнено' : 'Лист вимкнено');
        }
    };

    const renderCard = (row: AutomationEmail) => (
        <div key={row.key} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, opacity: row.enabled ? 1 : 0.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <div>
                    <div style={{ fontWeight: 800, color: '#263A99', fontSize: 17 }}>{row.label}</div>
                    <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>Тригер: {TRIGGER_HINTS[row.key] || '—'}</div>
                </div>
                <button
                    onClick={() => toggle(row)}
                    style={{
                        position: 'relative', width: 52, height: 30, borderRadius: 999, border: 'none', cursor: 'pointer',
                        background: row.enabled ? '#22c55e' : '#cbd5e1', transition: 'background .15s', flexShrink: 0,
                    }}
                    title={row.enabled ? 'Вимкнути' : 'Увімкнути'}
                >
                    <span style={{ position: 'absolute', top: 3, left: row.enabled ? 25 : 3, width: 24, height: 24, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
                </button>
            </div>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Тема листа</label>
            <input
                value={row.subject || ''}
                onChange={e => update(row.key, { subject: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8, padding: '9px 12px', fontSize: 14, marginBottom: 12 }}
            />

            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Текст листа</label>
            <textarea
                value={row.body || ''}
                onChange={e => update(row.key, { body: e.target.value })}
                rows={5}
                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8, padding: '9px 12px', fontSize: 14, marginBottom: 12, resize: 'vertical', lineHeight: 1.5 }}
            />

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 220px' }}>
                    {(() => {
                        const promoNA = row.key === 'birthday' || row.key.startsWith('order_');
                        const promoNote = row.key === 'birthday' ? '(генерується автоматично)' : (promoNA ? '(не використовується)' : '');
                        return (
                            <>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
                                    Промокод {promoNote}
                                </label>
                                <input
                                    value={row.promo_code || ''}
                                    onChange={e => update(row.key, { promo_code: e.target.value })}
                                    disabled={promoNA}
                                    placeholder={promoNA ? '—' : 'промокод'}
                                    style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8, padding: '9px 12px', fontSize: 14, background: promoNA ? '#f1f5f9' : '#fff' }}
                                />
                            </>
                        );
                    })()}
                </div>
                <button
                    onClick={() => save(row)}
                    disabled={savingKey === row.key}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#263A99', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
                >
                    {savingKey === row.key ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Зберегти
                </button>
            </div>
        </div>
    );

    const marketingRows = rows.filter(r => !ORDER_KEYS.includes(r.key));
    const orderRows = rows.filter(r => ORDER_KEYS.includes(r.key));

    return (
        <div style={{ maxWidth: 920, margin: '0 auto', padding: '8px 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
                <h1 style={{ fontSize: 28, fontWeight: 900, color: '#263A99', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Mail size={26} /> Листи-автоматизації
                </h1>
                <Link
                    href="/admin/email-previews"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 10, padding: '8px 14px', color: '#263A99', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
                >
                    <Eye size={16} /> Переглянути всі листи
                </Link>
            </div>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
                Тут можна змінити тему й текст листа, промокод, або повністю вимкнути будь-яку автоматичну розсилку.
                Шапка, кнопка й підпис залишаються брендовими. Порожній рядок у тексті = новий абзац.
                У листах замовлень можна вставляти <strong>{'{order}'}</strong> (номер замовлення) і <strong>{'{name}'}</strong> (ім'я клієнта).
            </p>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: '#94a3b8' }}>
                    <Loader2 size={28} className="animate-spin" />
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
                    <div>
                        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 14px' }}>Маркетингові листи</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            {marketingRows.map(renderCard)}
                        </div>
                    </div>
                    <div>
                        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 14px' }}>Листи замовлень</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            {orderRows.map(renderCard)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
