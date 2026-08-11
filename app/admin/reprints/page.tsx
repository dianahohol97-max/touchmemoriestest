'use client';
import { useState, useEffect, useCallback } from 'react';
import {
    Recycle,
    Plus,
    Loader2,
    Tag,
    UserRound,
    ExternalLink,
    X,
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * Defect / reprint queue.
 *
 * A defect is its own piece of work, separate from the order it came from: the
 * order is finished and paid, but the reprint still has to be produced and
 * shipped. This board tracks that lifecycle so "чи відправили передрук" stops
 * being a question for the group chat.
 *
 * Entries appear here automatically when an order carries a defect tag (set in
 * KeyCRM or in this panel), and can be added by hand for defects reported
 * before any tag exists.
 */

const STATUS_FLOW = ['new', 'confirmed', 'reprinting', 'done', 'shipped'] as const;

const STATUS_LABELS: Record<string, string> = {
    new: 'Заявлено',
    confirmed: 'Підтверджено',
    reprinting: 'У передруку',
    done: 'Передруковано',
    shipped: 'Відправлено',
    rejected: 'Не брак',
};

const STATUS_COLORS: Record<string, { fg: string; bg: string }> = {
    new: { fg: '#b91c1c', bg: '#fef2f2' },
    confirmed: { fg: '#c2410c', bg: '#fff7ed' },
    reprinting: { fg: '#a16207', bg: '#fefce8' },
    done: { fg: '#15803d', bg: '#f0fdf4' },
    shipped: { fg: '#334155', bg: '#f1f5f9' },
    rejected: { fg: '#64748b', bg: '#f8fafc' },
};

export default function ReprintsPage() {
    const [entries, setEntries] = useState<any[]>([]);
    const [chatTasks, setChatTasks] = useState<any[]>([]);
    const [faultOptions, setFaultOptions] = useState<string[]>([]);
    const [showAll, setShowAll] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ order_number: '', customer_name: '', reason: '', fault: '', notes: '' });

    const load = useCallback(async (all: boolean) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/reprints${all ? '?all=1' : ''}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Не вдалося завантажити чергу');
            setEntries(json.entries || []);
            setChatTasks(json.chat_tasks || []);
            setFaultOptions(json.fault_options || []);
        } catch (e: any) {
            toast.error(e?.message || 'Не вдалося завантажити чергу');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(showAll); }, [showAll, load]);

    const patchEntry = async (id: string, patch: Record<string, any>) => {
        try {
            const res = await fetch('/api/admin/reprints', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...patch }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Не вдалося оновити запис');
            setEntries(prev => prev
                .map(e => (e.id === id ? json.entry : e))
                .filter(e => showAll || !['shipped', 'rejected'].includes(e.status)));
            if (patch.status) toast.success(`Статус: ${STATUS_LABELS[patch.status] || patch.status}`);
        } catch (e: any) {
            toast.error(e?.message || 'Не вдалося оновити запис');
        }
    };

    const createEntry = async () => {
        if (!form.reason.trim() && !form.order_number.trim()) {
            toast.error('Вкажи хоча б номер замовлення або опис проблеми.');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/admin/reprints', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Не вдалося створити запис');
            setEntries(prev => [json.entry, ...prev]);
            setShowForm(false);
            setForm({ order_number: '', customer_name: '', reason: '', fault: '', notes: '' });
            toast.success(json.order_linked
                ? 'Запис створено і привʼязано до замовлення.'
                : 'Запис створено. Замовлення з таким номером не знайдено, привʼязки немає.');
        } catch (e: any) {
            toast.error(e?.message || 'Не вдалося створити запис');
        } finally {
            setSaving(false);
        }
    };

    const openCount = entries.filter(e => !['shipped', 'rejected'].includes(e.status)).length;

    return (
        <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Recycle size={24} style={{ color: '#263a99' }} />
                    <div>
                        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0f172a' }}>Важливо</h1>
                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                            {openCount} у роботі. Браки зʼявляються за тегом «брак» чи «передрук» або вручну; доручення підтягує Софія з робочих чатів.
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowAll(v => !v)} style={secondaryBtn}>
                        {showAll ? 'Тільки відкриті' : 'Показати всі'}
                    </button>
                    <button onClick={() => setShowForm(true)} style={primaryBtn}>
                        <Plus size={15} /> Додати брак
                    </button>
                </div>
            </div>

            {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 40, color: '#64748b' }}>
                    <Loader2 size={18} className="animate-spin" /> Завантаження черги
                </div>
            )}

            {!loading && chatTasks.length > 0 && (
                <div style={{ marginBottom: 22 }}>
                    <h2 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
                        💬 Доручення з чатів ({chatTasks.filter(t => !t.done).length})
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {chatTasks.map(task => {
                            // The deadline "lights up" (Diana, 2026-08-11):
                            // red when it is within 3 days or already passed —
                            // that is when «запитати виробництво» cannot wait.
                            const deadline = task.deadline ? new Date(task.deadline) : null;
                            const daysLeft = deadline
                                ? Math.ceil((deadline.getTime() - Date.now()) / (24 * 3600 * 1000))
                                : null;
                            const deadlineHot = daysLeft !== null && daysLeft <= 3;
                            const messages: any[] = Array.isArray(task.messages) ? task.messages : [];

                            return (
                                <div key={task.id} style={{
                                    background: 'white', border: '1px solid #e2e8f0',
                                    borderLeft: `3px solid ${task.done ? '#15803d' : '#7c3aed'}`,
                                    borderRadius: 10, padding: '11px 16px',
                                    opacity: task.done ? 0.65 : 1,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 12, fontWeight: 800, borderRadius: 20, padding: '3px 10px', color: task.done ? '#15803d' : '#7c3aed', background: task.done ? '#f0fdf4' : '#f5f3ff' }}>
                                            {task.done ? 'Виконано' : 'В роботі'}
                                        </span>
                                        {task.order_id ? (
                                            <a href={`/admin/orders/${task.order_id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 800, color: '#263a99', textDecoration: 'none' }}>
                                                {task.order_number} <ExternalLink size={12} />
                                            </a>
                                        ) : null}
                                        {task.customer_name && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#64748b' }}>
                                                <UserRound size={13} /> {task.customer_name}
                                            </span>
                                        )}
                                        {deadline && (
                                            <span style={{
                                                fontSize: 12, fontWeight: 800, borderRadius: 20, padding: '3px 10px',
                                                color: deadlineHot ? '#b91c1c' : '#334155',
                                                background: deadlineHot ? '#fef2f2' : '#f1f5f9',
                                            }}>
                                                дедлайн {deadline.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short' })}
                                                {daysLeft !== null && (daysLeft < 0
                                                    ? ` · прострочено ${Math.abs(daysLeft)} дн.`
                                                    : daysLeft === 0 ? ' · сьогодні' : ` · ${daysLeft} дн.`)}
                                            </span>
                                        )}
                                        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>
                                            {new Date(task.updated_at || task.created_at).toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    {/* The whole conversation, oldest first — the last
                                        line is the task's current state. */}
                                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        {messages.map((m: any, i: number) => {
                                            const isLast = i === messages.length - 1;
                                            return (
                                                <div key={i} style={{
                                                    fontSize: isLast ? 13.5 : 12.5,
                                                    color: isLast ? '#334155' : '#94a3b8',
                                                    fontWeight: isLast ? 600 : 400,
                                                    lineHeight: 1.5,
                                                    textDecoration: m.done ? 'line-through' : 'none',
                                                }}>
                                                    {m.done ? '✓ ' : ''}{m.text}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {!loading && entries.length === 0 && chatTasks.length === 0 && (
                <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8', background: 'white', border: '1px dashed #e2e8f0', borderRadius: 12 }}>
                    Черга порожня. Це найкращий стан, у якому вона може бути.
                </div>
            )}

            {!loading && entries.length > 0 && chatTasks.length > 0 && (
                <h2 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
                    ♻️ Браки і передруки ({openCount})
                </h2>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {entries.map(entry => {
                    const color = STATUS_COLORS[entry.status] || STATUS_COLORS.new;
                    const nextIndex = STATUS_FLOW.indexOf(entry.status) + 1;
                    const next = nextIndex > 0 && nextIndex < STATUS_FLOW.length ? STATUS_FLOW[nextIndex] : null;

                    return (
                        <div key={entry.id} style={{
                            background: 'white', border: '1px solid #e2e8f0',
                            borderLeft: `3px solid ${color.fg}`, borderRadius: 10, padding: '14px 18px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 12, fontWeight: 800, color: color.fg, background: color.bg, borderRadius: 20, padding: '3px 10px' }}>
                                    {STATUS_LABELS[entry.status] || entry.status}
                                </span>

                                {entry.order_id ? (
                                    <a href={`/admin/orders/${entry.order_id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 800, color: '#263a99', textDecoration: 'none' }}>
                                        {entry.order_number} <ExternalLink size={12} />
                                    </a>
                                ) : (
                                    <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{entry.order_number || 'без замовлення'}</span>
                                )}

                                {entry.customer_name && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#64748b' }}>
                                        <UserRound size={13} /> {entry.customer_name}
                                    </span>
                                )}

                                {(entry.matched_tags || []).map((t: string) => (
                                    <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#7c3aed', background: '#f5f3ff', borderRadius: 20, padding: '2px 9px' }}>
                                        <Tag size={11} /> {t}
                                    </span>
                                ))}

                                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>
                                    {new Date(entry.created_at).toLocaleDateString('uk-UA', { day: '2-digit', month: 'short' })}
                                </span>
                            </div>

                            {(entry.items_summary || entry.reason) && (
                                <div style={{ fontSize: 13.5, color: '#475569', marginTop: 8, lineHeight: 1.5 }}>
                                    {entry.items_summary && <div>{entry.items_summary}</div>}
                                    {entry.reason && <div>{entry.reason}</div>}
                                </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                                <select
                                    value={entry.fault || ''}
                                    onChange={e => patchEntry(entry.id, { fault: e.target.value })}
                                    style={selectStyle}
                                >
                                    <option value="">Хто винен?</option>
                                    {faultOptions.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>

                                <input
                                    type="number"
                                    placeholder="Вартість, грн"
                                    defaultValue={entry.reprint_cost ?? ''}
                                    onBlur={e => {
                                        const v = e.target.value;
                                        if (v !== String(entry.reprint_cost ?? '')) patchEntry(entry.id, { reprint_cost: v });
                                    }}
                                    style={{ ...selectStyle, width: 110 }}
                                />

                                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                                    {entry.status === 'new' && (
                                        <button onClick={() => patchEntry(entry.id, { status: 'rejected' })} style={secondaryBtn}>
                                            Не брак
                                        </button>
                                    )}
                                    {next && (
                                        <button onClick={() => patchEntry(entry.id, { status: next })} style={primaryBtn}>
                                            {STATUS_LABELS[next]} →
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {showForm && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20,
                }}>
                    <div style={{ background: 'white', borderRadius: 14, padding: '22px 24px', width: '100%', maxWidth: 460 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900 }}>Новий запис про брак</h2>
                            <button onClick={() => setShowForm(false)} style={{ ...secondaryBtn, padding: 6 }}><X size={15} /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <input placeholder="Номер замовлення (TM-… або CRM-…)" value={form.order_number}
                                onChange={e => setForm(f => ({ ...f, order_number: e.target.value }))} style={inputStyle} />
                            <input placeholder="Імʼя клієнта, якщо замовлення не знайдеться" value={form.customer_name}
                                onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} style={inputStyle} />
                            <textarea placeholder="Що сталося: подряпина, брак кольору, згин…" value={form.reason} rows={3}
                                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} />
                            <select value={form.fault} onChange={e => setForm(f => ({ ...f, fault: e.target.value }))} style={inputStyle}>
                                <option value="">Хто винен — можна лишити порожнім</option>
                                {faultOptions.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>

                            <button onClick={createEntry} disabled={saving} style={{ ...primaryBtn, justifyContent: 'center', padding: '11px 16px', opacity: saving ? 0.7 : 1 }}>
                                {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Створити
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const primaryBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#263a99', color: 'white', border: 'none', borderRadius: 8,
    padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'white', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
};

const selectStyle: React.CSSProperties = {
    border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 10px',
    fontSize: 13, color: '#0f172a', background: 'white',
};

const inputStyle: React.CSSProperties = {
    border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px',
    fontSize: 14, color: '#0f172a', width: '100%', boxSizing: 'border-box',
};
