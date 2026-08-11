'use client';
import { useState, useEffect, useCallback } from 'react';
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
    Flame,
    Instagram,
    Globe,
    UserX,
    Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * Production calendar — one week of work, by the day each order must be finished.
 *
 * Grouped by finish date rather than by the date the customer expects the
 * parcel: those differ by the days it spends in transit, and the workshop plans
 * around the former.
 *
 * Both intakes are shown. An Instagram order entered in KeyCRM takes the same
 * day and the same hands as one from the site, so hiding it would make the
 * week look emptier than it is.
 */

const WEEKDAYS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];

const SITE_STATUS_LABELS: Record<string, string> = {
    new: 'Нове',
    confirmed: 'Підтверджено',
    in_production: 'У виробництві',
    quality_check: 'Перевірка якості',
    ready: 'Готове',
};

const REASON_LABELS: Record<string, string> = {
    'requested-date': 'дата від клієнта',
    'urgent': 'терміново',
    'standard': 'стандартний строк',
};

export default function ProductionCalendarPage() {
    const [weekOffset, setWeekOffset] = useState(0);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async (offset: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/production-calendar?week=${offset}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Не вдалося завантажити календар');
            setData(json);
        } catch (e: any) {
            toast.error(e?.message || 'Не вдалося завантажити календар');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(weekOffset); }, [weekOffset, load]);

    const dayKeys = data ? Object.keys(data.days) : [];
    const todayKey = new Date().toISOString().slice(0, 10);
    const totalThisWeek = dayKeys.reduce((sum, k) => sum + (data.days[k]?.length || 0), 0);

    const weekLabel = (() => {
        if (!data) return '';
        const start = new Date(data.week_start);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const fmt = (d: Date) => d.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long' });
        return `${fmt(start)} — ${fmt(end)}`;
    })();

    return (
        <div style={{ padding: '28px 32px', maxWidth: 1440, margin: '0 auto' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <CalendarDays size={24} style={{ color: '#263a99' }} />
                    <div>
                        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0f172a' }}>Календар виробництва</h1>
                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                            {weekLabel}{data ? ` · ${totalThisWeek} замовлень на тиждень` : ''}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => setWeekOffset(w => w - 1)} style={navBtn} title="Попередній тиждень">
                        <ChevronLeft size={16} />
                    </button>
                    <button onClick={() => setWeekOffset(0)} style={{ ...navBtn, width: 'auto', padding: '0 14px', fontWeight: 700, fontSize: 13 }}>
                        Цей тиждень
                    </button>
                    <button onClick={() => setWeekOffset(w => w + 1)} style={navBtn} title="Наступний тиждень">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 40, color: '#64748b' }}>
                    <Loader2 size={18} className="animate-spin" /> Завантаження календаря
                </div>
            )}

            {!loading && data && (
                <>
                    {data.overdue?.length > 0 && (
                        <div style={{
                            border: '1.5px solid #fecaca', background: '#fef2f2', borderRadius: 12,
                            padding: '14px 18px', marginBottom: 18,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                <AlertTriangle size={16} style={{ color: '#b91c1c' }} />
                                <span style={{ fontWeight: 800, fontSize: 14, color: '#b91c1c' }}>
                                    Прострочено, потребує рішення сьогодні — {data.overdue.length}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {data.overdue.slice(0, 12).map((o: any) => (
                                    <OrderCard key={o.id} order={o} overdue onChanged={() => load(weekOffset)} />
                                ))}
                            </div>
                        </div>
                    )}

                    {data.ship_soon?.length > 0 && (
                        <div style={{
                            border: '1.5px solid #fed7aa', background: '#fff7ed', borderRadius: 12,
                            padding: '14px 18px', marginBottom: 18,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                <Flame size={16} style={{ color: '#ea580c' }} />
                                <span style={{ fontWeight: 800, fontSize: 14, color: '#c2410c' }}>
                                    Дата від клієнта ближче ніж за 4 дні — {data.ship_soon.length}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {data.ship_soon.slice(0, 12).map((o: any) => (
                                    <OrderCard key={`soon-${o.id}`} order={o} overdue onChanged={() => load(weekOffset)} />
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                        gap: 12,
                        alignItems: 'start',
                    }}>
                        {dayKeys.map((key, index) => {
                            const orders = data.days[key] || [];
                            const isToday = key === todayKey;
                            const isWeekend = index >= 5;
                            const date = new Date(key);

                            return (
                                <div key={key} style={{
                                    background: isWeekend ? '#f8fafc' : 'white',
                                    border: isToday ? '2px solid #263a99' : '1px solid #e2e8f0',
                                    borderRadius: 12,
                                    minHeight: 150,
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}>
                                    <div style={{
                                        padding: '10px 12px',
                                        borderBottom: '1px solid #eef2f7',
                                        display: 'flex',
                                        alignItems: 'baseline',
                                        justifyContent: 'space-between',
                                        gap: 8,
                                    }}>
                                        <div>
                                            <div style={{ fontSize: 12, fontWeight: 800, color: isToday ? '#263a99' : '#0f172a' }}>
                                                {WEEKDAYS[index]}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#94a3b8' }}>
                                                {date.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short' })}
                                            </div>
                                        </div>
                                        {orders.length > 0 && (
                                            <span style={{
                                                fontSize: 11, fontWeight: 800, color: '#263a99',
                                                background: '#eef2ff', borderRadius: 20, padding: '2px 8px',
                                            }}>
                                                {orders.length}
                                            </span>
                                        )}
                                    </div>

                                    <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {orders.length === 0 && (
                                            <div style={{ fontSize: 12, color: '#cbd5e1', padding: '10px 2px' }}>Порожньо</div>
                                        )}
                                        {orders.map((o: any) => <OrderCard key={o.id} order={o} onChanged={() => load(weekOffset)} />)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {data.beyond_this_week > 0 && (
                        <div style={{ marginTop: 14, fontSize: 13, color: '#64748b' }}>
                            Ще {data.beyond_this_week} замовлень мають дедлайн поза межами цього тижня.
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function OrderCard({ order, overdue, onChanged }: { order: any; overdue?: boolean; onChanged?: () => void }) {
    const isUrgent = order.reason === 'urgent' || order.reason === 'requested-date';
    const fromInstagram = order.source === 'keycrm';

    // Deadline editable right on the board (Diana, 2026-08-11). Saved through
    // the PATCH allowlist, which also pins the date (deadline_locked) so the
    // syncs never recompute over a hand-set value.
    const saveDeadline = async (value: string) => {
        if (!value) return;
        try {
            const resp = await fetch(`/api/admin/orders/${order.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deadline: `${value}T09:00:00Z`, updated_at: new Date().toISOString() }),
            });
            if (!resp.ok) throw new Error((await resp.json().catch(() => ({})))?.error || 'Не вдалося оновити дедлайн');
            toast.success(`${order.order_number}: дедлайн → ${value}`);
            onChanged?.();
        } catch (e: any) {
            toast.error(e?.message || 'Помилка збереження дедлайну');
        }
    };

    return (
        <a
            href={`/admin/orders/${order.id}`}
            style={{
                display: 'block',
                textDecoration: 'none',
                background: overdue ? '#fef2f2' : (isUrgent ? '#fff7ed' : '#f8fafc'),
                border: `1px solid ${overdue ? '#fecaca' : (isUrgent ? '#fed7aa' : '#e2e8f0')}`,
                borderLeft: `3px solid ${overdue ? '#b91c1c' : (isUrgent ? '#ea580c' : '#94a3b8')}`,
                borderRadius: 8,
                padding: '8px 10px',
                minWidth: overdue ? 210 : undefined,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                {fromInstagram
                    ? <Instagram size={12} style={{ color: '#a855f7' }} />
                    : <Globe size={12} style={{ color: '#0ea5e9' }} />}
                <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{order.order_number}</span>
                {isUrgent && <Flame size={12} style={{ color: '#ea580c' }} />}
                {order.needs_designer && <UserX size={12} style={{ color: '#b91c1c' }} />}
            </div>

            <div style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.35 }}>
                {order.customer_name || 'без імені'}
            </div>

            {/* The stage by its live name — the CRM's own when the order is
                there, the site's otherwise — so the board answers "де воно
                зараз" without opening either system. */}
            <div style={{ marginTop: 4 }}>
                <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: '0.02em',
                    color: '#334155', background: '#f1f5f9',
                    borderRadius: 20, padding: '2px 8px', display: 'inline-block',
                }}>
                    {order.crm_status || SITE_STATUS_LABELS[order.order_status] || order.order_status}
                </span>
            </div>

            {order.items_summary && (
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.35, marginTop: 2 }}>
                    {order.items_summary}
                </div>
            )}

            {/* Why this day — the customer's own words when there were any. */}
            {order.reason !== 'standard' && (
                <div style={{ fontSize: 10.5, color: '#c2410c', marginTop: 4 }}>
                    {REASON_LABELS[order.reason]}
                    {order.evidence?.length ? `: «${order.evidence.join(', ')}»` : ''}
                </div>
            )}

            {/* The promise to the customer is already missed — say it in red,
                louder than a date that is merely approaching. */}
            {order.client_date_passed && (
                <div style={{ fontSize: 10.5, fontWeight: 800, color: '#b91c1c', marginTop: 3 }}>
                    дата від клієнта вже минула
                </div>
            )}

            {!order.stored_deadline && (
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 3 }}>
                    дедлайн ще не збережений, показано розрахунковий
                </div>
            )}

            {/* Inline deadline editor — inside a link card, so the click must
                not navigate. */}
            <div
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}
            >
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>дедлайн:</span>
                <input
                    type="date"
                    defaultValue={order.deadline ? String(order.deadline).slice(0, 10) : ''}
                    onChange={(e) => saveDeadline(e.target.value)}
                    style={{
                        border: '1px solid #e2e8f0', borderRadius: 6, background: 'white',
                        fontSize: 11, fontWeight: 700, color: '#0f172a', padding: '1px 4px', outline: 'none',
                    }}
                />
            </div>
        </a>
    );
}

const navBtn: React.CSSProperties = {
    width: 34,
    height: 34,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    background: 'white',
    color: '#0f172a',
    cursor: 'pointer',
};
