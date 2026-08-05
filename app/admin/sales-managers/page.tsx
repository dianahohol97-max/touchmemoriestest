'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Users, Plus, Link2, RefreshCw, Loader2, Check } from 'lucide-react';

/**
 * Admin view of the sales-manager program: who works leads, what they earned,
 * which partners are credited to them, and which commissions are still owed.
 * Attribution lives here on purpose — a manager must not be able to credit a
 * partner to themselves.
 */

const money = (n: any) => `${Number(n || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;

export default function SalesManagersPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', phone: '', rate_order: 1, rate_gallery: 5, payout_account: '' });

    const load = useCallback(async () => {
        const res = await fetch('/api/admin/sales-managers');
        if (res.ok) setData(await res.json());
        else toast.error('Не вдалося завантажити');
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const create = async () => {
        if (!form.name.trim()) { toast.error('Вкажіть імʼя'); return; }
        const res = await fetch('/api/admin/sales-managers', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        });
        const json = await res.json();
        if (!res.ok) { toast.error(json?.error || 'Помилка'); return; }
        setAdding(false);
        setForm({ name: '', email: '', phone: '', rate_order: 1, rate_gallery: 5, payout_account: '' });
        await load();
        toast.success('Менеджера створено — скопіюйте посилання на кабінет');
    };

    const patch = async (body: any, msg = 'Збережено') => {
        const res = await fetch('/api/admin/sales-managers', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        if (res.ok) { await load(); toast.success(msg); }
        else toast.error((await res.json())?.error || 'Помилка');
    };

    if (loading) return <div className="p-8 text-gray-500"><Loader2 className="animate-spin" /></div>;
    if (!data) return null;

    const { managers, commissions, partners, photographers, lead_counts } = data;
    const byManager = (id: string) => commissions.filter((c: any) => c.manager_id === id);

    return (
        <div className="p-6 max-w-6xl">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Users size={24} /> Менеджери з продажів
                </h1>
                <div className="flex gap-2">
                    <button onClick={load} className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2">
                        <RefreshCw size={15} /> Оновити
                    </button>
                    <button onClick={() => setAdding(a => !a)} className="px-3 py-2 bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2">
                        <Plus size={15} /> Новий менеджер
                    </button>
                </div>
            </div>

            {adding && (
                <div className="border rounded-xl p-4 mb-6 bg-white grid grid-cols-2 gap-3">
                    <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Імʼя *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                    <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Телефон" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                    <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Картка або IBAN для виплат" value={form.payout_account} onChange={e => setForm(f => ({ ...f, payout_account: e.target.value }))} />
                    <label className="text-sm text-gray-600">% від замовлень партнера
                        <input type="number" step="0.5" className="border rounded-lg px-3 py-2 text-sm w-full mt-1" value={form.rate_order} onChange={e => setForm(f => ({ ...f, rate_order: Number(e.target.value) }))} />
                    </label>
                    <label className="text-sm text-gray-600">% від оплати галерей
                        <input type="number" step="0.5" className="border rounded-lg px-3 py-2 text-sm w-full mt-1" value={form.rate_gallery} onChange={e => setForm(f => ({ ...f, rate_gallery: Number(e.target.value) }))} />
                    </label>
                    <div className="col-span-2">
                        <button onClick={create} className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm">Створити</button>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {managers.length === 0 && <div className="text-gray-500 text-sm">Менеджерів ще немає.</div>}
                {managers.map((m: any) => {
                    const rows = byManager(m.id);
                    const pending = rows.filter((r: any) => r.status === 'pending');
                    const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/uk/sales/${m.cabinet_token}`;
                    return (
                        <div key={m.id} className="border rounded-xl bg-white p-4">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div>
                                    <div className="font-bold text-lg">{m.name} {!m.is_active && <span className="text-xs text-red-600">(вимкнений)</span>}</div>
                                    <div className="text-sm text-gray-500">
                                        {m.email || 'без email'} · лідів: {lead_counts[m.id] || 0} · {m.rate_order}% замовлення · {m.rate_gallery}% галереї
                                    </div>
                                    <div className="text-sm mt-1">
                                        Зароблено <b>{money(m.total_earned)}</b> · виплачено <b>{money(m.total_paid)}</b> ·
                                        до виплати <b className="text-amber-600">{money(pending.reduce((s: number, r: any) => s + Number(r.amount), 0))}</b>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <a href={`/uk/sales/${m.cabinet_token}`} target="_blank" rel="noreferrer"
                                        className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2">
                                        <Link2 size={15} /> Відкрити кабінет
                                    </a>
                                    <button onClick={() => { navigator.clipboard.writeText(link); toast.success('Посилання скопійовано'); }}
                                        className="px-3 py-2 border rounded-lg text-sm">
                                        Скопіювати
                                    </button>
                                    <button onClick={() => patch({ manager_id: m.id, is_active: !m.is_active }, m.is_active ? 'Вимкнено' : 'Увімкнено')}
                                        className="px-3 py-2 border rounded-lg text-sm">
                                        {m.is_active ? 'Вимкнути' : 'Увімкнути'}
                                    </button>
                                </div>
                            </div>

                            {rows.length > 0 && (
                                <div className="mt-3 border-t pt-3 space-y-2">
                                    {rows.slice(0, 12).map((c: any) => (
                                        <div key={c.id} className="flex items-center justify-between text-sm gap-3">
                                            <span className="text-gray-600 truncate">
                                                {c.kind === 'gallery' ? 'Галерея' : 'Замовлення'} · {c.note} · база {money(c.base_amount)}
                                            </span>
                                            <span className="flex items-center gap-2 shrink-0">
                                                <b>{money(c.amount)}</b>
                                                {c.status === 'paid'
                                                    ? <span className="text-green-600 flex items-center gap-1"><Check size={14} /> виплачено</span>
                                                    : <button onClick={() => patch({ commission_id: c.id, status: 'paid' }, 'Позначено виплаченим')}
                                                        className="px-2 py-1 border rounded text-xs">Позначити виплаченим</button>}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <h2 className="text-lg font-bold mt-8 mb-3">Хто кого привів</h2>
            <p className="text-sm text-gray-500 mb-3">
                Оберіть менеджера для партнера чи фотографа — з цього моменту всі їхні оплати нараховують йому відсоток.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
                <div className="border rounded-xl bg-white p-4">
                    <div className="font-semibold mb-2">Партнери</div>
                    <div className="space-y-2">
                        {partners.map((p: any) => (
                            <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                                <span className="truncate">{p.agency_name} <code className="text-xs text-gray-400">{p.referral_code}</code></span>
                                <select className="border rounded px-2 py-1 text-xs" value={p.sales_manager_id || ''}
                                    onChange={e => patch({ assign: 'partner', target_id: p.id, manager_id: e.target.value || null })}>
                                    <option value="">—</option>
                                    {managers.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="border rounded-xl bg-white p-4">
                    <div className="font-semibold mb-2">Фотографи</div>
                    <div className="space-y-2">
                        {photographers.map((p: any) => (
                            <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                                <span className="truncate">{p.name || p.email}</span>
                                <select className="border rounded px-2 py-1 text-xs" value={p.sales_manager_id || ''}
                                    onChange={e => patch({ assign: 'photographer', target_id: p.id, manager_id: e.target.value || null })}>
                                    <option value="">—</option>
                                    {managers.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
