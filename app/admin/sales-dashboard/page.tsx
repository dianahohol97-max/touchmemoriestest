'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { BarChart2, RefreshCw, Loader2 } from 'lucide-react';

/**
 * Дашборд партнерської програми (Diana, 2026-08-06): ліди, замовлення й
 * конверсія в одному місці, з розрізом по менеджерах.
 *
 * Форма свідомо без графіків: плитки з ключовими числами, воронка з
 * підписаними смугами (той самий колір статусу, що й у «Лідах» та в кабінетах
 * менеджерів — колір закріплений за статусом, підпис і число на кожній смузі)
 * і таблиця по менеджерах. «Замовлення за кодами» — лише оплачені: рядок у
 * нарахуваннях зʼявляється тільки після підтвердженої оплати.
 */

const FUNNEL_STEPS = [
    { key: 'new', label: 'Нові', color: '#d97706' },
    { key: 'contacted', label: 'Написали', color: '#3d56d6' },
    { key: 'replied', label: 'Відповіли', color: '#7c3aed' },
    { key: 'qualified', label: 'Кваліфіковані', color: '#0891b2' },
    { key: 'won', label: 'Угоди', color: '#16a34a' },
    { key: 'lost', label: 'Втрачені', color: '#dc2626' },
];

const SOURCE_LABELS: Record<string, string> = {
    google_places: 'зібрані з Google',
    manager: 'додали менеджери',
    manual: 'додані вручну',
    inbound: 'написали самі',
};

const money = (n: number) => `${Number(n || 0).toLocaleString('uk-UA')} ₴`;

export default function SalesDashboardPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/sales-dashboard');
            const json = await res.json();
            if (res.ok) setData(json);
            else toast.error(json?.error || 'Не вдалося завантажити');
        } catch { toast.error('Не вдалося завантажити'); }
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    if (loading && !data) return <div className="p-8 text-gray-500"><Loader2 className="animate-spin" /></div>;
    if (!data) return null;

    const { leads, managers, partners, orders, pending_requests } = data;
    const funnelMax = Math.max(1, ...FUNNEL_STEPS.map(s => leads.funnel[s.key] || 0));

    const tiles = [
        { t: 'Лідів у роботі', v: String(leads.total), sub: leads.free_pool ? `з них вільних у пулі: ${leads.free_pool}` : null },
        { t: 'Конверсія в угоду', v: leads.conversion === null ? '—' : `${leads.conversion}%`, sub: `угод: ${leads.funnel.won || 0}` },
        { t: 'Замовлень за кодами · 30 днів', v: String(orders.last_30_days.orders), sub: `виручка ${money(orders.last_30_days.revenue)}` },
        { t: 'Комісії партнерам · 30 днів', v: money(orders.last_30_days.partner_commission), sub: `за весь час ${money(orders.all_time.partner_commission)}` },
    ];

    return (
        <div className="p-6 max-w-5xl">
            <div className="flex items-center justify-between mb-2">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <BarChart2 size={24} /> Продажі: дашборд
                </h1>
                <button onClick={load} className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2">
                    <RefreshCw size={15} /> Оновити
                </button>
            </div>
            <p className="text-sm text-gray-500 mb-6">
                Уся партнерська програма одним поглядом: воронка лідів, замовлення за партнерськими кодами
                і робота кожного менеджера. Рахуються лише оплачені замовлення.
            </p>

            {pending_requests > 0 && (
                <Link href="/admin/partner-requests"
                    className="block border border-amber-300 bg-amber-50 rounded-xl px-4 py-3 mb-5 text-sm font-semibold text-amber-800">
                    Заявок на оформлення партнера чекає на рішення: {pending_requests} — перейти до розгляду
                </Link>
            )}

            {/* Ключові числа */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {tiles.map(s => (
                    <div key={s.t} className="border rounded-xl bg-white px-4 py-3">
                        <div className="text-xs text-gray-500">{s.t}</div>
                        <div className="text-2xl font-extrabold text-indigo-900 mt-1">{s.v}</div>
                        {s.sub && <div className="text-xs text-gray-500 mt-1">{s.sub}</div>}
                    </div>
                ))}
            </div>

            {/* Воронка лідів */}
            <div className="border rounded-xl bg-white p-5 mb-6">
                <h2 className="text-lg font-bold mb-1">Воронка лідів</h2>
                <p className="text-xs text-gray-500 mb-4">
                    {Object.entries(leads.by_source as Record<string, number>)
                        .map(([k, v]) => `${SOURCE_LABELS[k] || k}: ${v}`)
                        .join(' · ') || 'Джерел поки немає'}
                </p>
                <div className="flex flex-col gap-2">
                    {FUNNEL_STEPS.map(s => {
                        const n = leads.funnel[s.key] || 0;
                        return (
                            <div key={s.key} className="flex items-center gap-3">
                                <div className="w-32 shrink-0 text-sm text-gray-700">{s.label}</div>
                                <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                                    <div className="h-full rounded"
                                        style={{ width: `${Math.max(n ? 4 : 0, (n / funnelMax) * 100)}%`, background: s.color }} />
                                </div>
                                <div className="w-10 shrink-0 text-right text-sm font-bold text-gray-800">{n}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* По менеджерах */}
            <div className="border rounded-xl bg-white p-5 mb-6">
                <h2 className="text-lg font-bold mb-3">По менеджерах</h2>
                {managers.length === 0 ? (
                    <p className="text-sm text-gray-500">Менеджерів ще немає — додайте їх у «Менеджерах з продажів».</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-gray-500 border-b">
                                    <th className="py-2 pr-3 font-semibold">Менеджер</th>
                                    <th className="py-2 pr-3 font-semibold text-right">Лідів</th>
                                    <th className="py-2 pr-3 font-semibold text-right">Угод</th>
                                    <th className="py-2 pr-3 font-semibold text-right">Конверсія</th>
                                    <th className="py-2 pr-3 font-semibold text-right">Партнерів</th>
                                    <th className="py-2 pr-3 font-semibold text-right">Зароблено</th>
                                    <th className="py-2 font-semibold text-right">До виплати</th>
                                </tr>
                            </thead>
                            <tbody>
                                {managers.map((m: any) => (
                                    <tr key={m.id} className="border-b last:border-0">
                                        <td className="py-2 pr-3 font-semibold">
                                            {m.name}
                                            {!m.is_active && <span className="ml-2 text-xs text-red-600">вимкнено</span>}
                                        </td>
                                        <td className="py-2 pr-3 text-right">{m.leads}</td>
                                        <td className="py-2 pr-3 text-right">{m.won}</td>
                                        <td className="py-2 pr-3 text-right">{m.conversion === null ? '—' : `${m.conversion}%`}</td>
                                        <td className="py-2 pr-3 text-right">{m.partners}</td>
                                        <td className="py-2 pr-3 text-right">{money(m.earned)}</td>
                                        <td className="py-2 text-right">{money(m.pending)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Партнери й замовлення за весь час */}
            <div className="grid md:grid-cols-2 gap-3">
                <div className="border rounded-xl bg-white p-5">
                    <h2 className="text-lg font-bold mb-2">Партнери</h2>
                    <div className="text-sm text-gray-700 flex flex-col gap-1">
                        <div>Всього в програмі: <b>{partners.total}</b> (активних {partners.active})</div>
                        <div>Привели менеджери: <b>{partners.via_manager}</b></div>
                        <div>Прийшли самі: <b>{partners.self_came}</b></div>
                        <div>Мають хоч одне оплачене замовлення: <b>{partners.selling}</b></div>
                    </div>
                </div>
                <div className="border rounded-xl bg-white p-5">
                    <h2 className="text-lg font-bold mb-2">Замовлення за кодами · весь час</h2>
                    <div className="text-sm text-gray-700 flex flex-col gap-1">
                        <div>Оплачених замовлень: <b>{orders.all_time.orders}</b></div>
                        <div>Виручка: <b>{money(orders.all_time.revenue)}</b></div>
                        <div>Комісії партнерам: <b>{money(orders.all_time.partner_commission)}</b></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
