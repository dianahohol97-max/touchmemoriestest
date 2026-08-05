'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Handshake, RefreshCw, Loader2, Check, X, Instagram, Globe, Phone, Mail } from 'lucide-react';
import { PARTNER_KINDS, PARTNER_KIND_LABELS, type PartnerKind } from '@/lib/sales/partner-activation';

/**
 * Заявки менеджерів на оформлення партнера.
 *
 * Менеджер домовився з фотографом чи агенцією й натиснув «Оформити
 * партнером» — сюди лягла заявка. Підтвердження одним кліком робить усе
 * одразу: створює партнера з персональним промокодом, записує менеджера, який
 * його привів, переводить ліда в «Угоду» і надсилає партнеру лист із кодом та
 * посиланням на кабінет.
 *
 * Рішення лишається за адміністратором, бо код — це жива знижка на сайті, а
 * менеджер має відсоток із кожного залученого партнера. Умови тут можна
 * змінити перед підтвердженням: менеджер їх не задає.
 */

const TYPE_LABELS: Record<string, string> = {
    photographer: 'Фотограф',
    wedding_agency: 'Весільна агенція',
    travel_agency: 'Тревел-агенція',
    corporate: 'Компанія',
    other: 'Інше',
};

interface Req {
    id: string; lead_id: string | null; status: string; business_name: string; contact_name: string | null;
    email: string; phone: string | null; website: string | null; instagram: string | null;
    partner_kind: string; client_discount: number; travelbook_rate: number; other_rate: number;
    comment: string | null; decline_reason: string | null; partner_id: string | null;
    created_at: string; decided_at: string | null;
    manager: { id: string; name: string; email: string | null } | null;
    lead: { id: string; status: string; business_type: string; city: string | null; notes: string | null } | null;
}

export default function PartnerRequestsPage() {
    const [requests, setRequests] = useState<Req[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    // Правки умов до підтвердження, по одній заявці.
    const [terms, setTerms] = useState<Record<string, { partner_kind: string; client_discount: number; travelbook_rate: number; other_rate: number }>>({});

    const load = useCallback(async () => {
        const res = await fetch('/api/admin/partner-requests');
        if (res.ok) setRequests((await res.json()).requests || []);
        else toast.error('Не вдалося завантажити заявки');
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const termsOf = (r: Req) => terms[r.id] || {
        partner_kind: r.partner_kind,
        client_discount: Number(r.client_discount),
        travelbook_rate: Number(r.travelbook_rate),
        other_rate: Number(r.other_rate),
    };
    const setTerm = (r: Req, patch: Partial<ReturnType<typeof termsOf>>) =>
        setTerms(t => ({ ...t, [r.id]: { ...termsOf(r), ...patch } }));

    const decide = async (r: Req, action: 'approve' | 'decline') => {
        if (action === 'decline') {
            const reason = window.prompt('Чому відхиляємо? Менеджер побачить цю причину у своєму кабінеті.');
            if (reason === null) return;
            setBusy(r.id);
            const res = await fetch('/api/admin/partner-requests', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ request_id: r.id, action, decline_reason: reason }),
            });
            setBusy(null);
            if (!res.ok) { toast.error((await res.json())?.error || 'Помилка'); return; }
            await load();
            toast.success('Заявку відхилено');
            return;
        }

        setBusy(r.id);
        const res = await fetch('/api/admin/partner-requests', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ request_id: r.id, action: 'approve', ...termsOf(r) }),
        });
        const json = await res.json();
        setBusy(null);
        if (!res.ok) { toast.error(json?.error || 'Помилка'); return; }
        await load();
        toast.success(
            json?.email_sent
                ? `Партнера створено, код ${json.partner?.referral_code} надіслано на пошту`
                : `Партнера створено, код ${json.partner?.referral_code}. Лист не пішов — надішліть код вручну.`,
        );
    };

    if (loading) return <div className="p-8 text-gray-500"><Loader2 className="animate-spin" /></div>;

    const pending = requests.filter(r => r.status === 'pending');
    const decided = requests.filter(r => r.status !== 'pending');

    return (
        <div className="p-6 max-w-5xl">
            <div className="flex items-center justify-between mb-2">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Handshake size={24} /> Оформлення партнерів
                </h1>
                <button onClick={load} className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2">
                    <RefreshCw size={15} /> Оновити
                </button>
            </div>
            <p className="text-sm text-gray-500 mb-6">
                Заявки менеджерів на партнерів, з якими вони домовились. Підтвердження створює партнера з
                персональним промокодом, записує менеджера, переводить ліда в «Угоду» і надсилає партнеру лист.
            </p>

            {pending.length === 0 ? (
                <div className="border rounded-xl p-6 bg-white text-gray-500 text-sm">
                    Нових заявок немає. Тут зʼявиться кожна угода, яку закриють менеджери.
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {pending.map(r => {
                        const t = termsOf(r);
                        return (
                            <div key={r.id} className="border rounded-xl p-5 bg-white">
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div>
                                        <div className="text-lg font-bold">{r.business_name}</div>
                                        <div className="text-sm text-gray-500">
                                            {TYPE_LABELS[r.lead?.business_type || ''] || 'Бізнес'}
                                            {r.lead?.city ? ` · ${r.lead.city}` : ''}
                                            {r.contact_name ? ` · ${r.contact_name}` : ''}
                                        </div>
                                    </div>
                                    <div className="text-sm text-right">
                                        <div className="text-gray-500">Привів менеджер</div>
                                        <div className="font-semibold">{r.manager?.name || '—'}</div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-700">
                                    <span className="flex items-center gap-1"><Mail size={14} /> {r.email}</span>
                                    {r.phone && <span className="flex items-center gap-1"><Phone size={14} /> {r.phone}</span>}
                                    {r.instagram && (
                                        <a className="flex items-center gap-1 text-blue-700" target="_blank" rel="noreferrer"
                                            href={`https://instagram.com/${r.instagram}`}>
                                            <Instagram size={14} /> @{r.instagram}
                                        </a>
                                    )}
                                    {r.website && (
                                        <a className="flex items-center gap-1 text-blue-700" target="_blank" rel="noreferrer"
                                            href={r.website.startsWith('http') ? r.website : `https://${r.website}`}>
                                            <Globe size={14} /> {r.website}
                                        </a>
                                    )}
                                </div>

                                {r.comment && (
                                    <div className="mt-3 text-sm bg-gray-50 border rounded-lg p-3 whitespace-pre-wrap">
                                        {r.comment}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                                    <label className="text-xs text-gray-600">Вид партнера
                                        <select className="border rounded-lg px-3 py-2 text-sm w-full mt-1"
                                            value={t.partner_kind} onChange={e => setTerm(r, { partner_kind: e.target.value })}>
                                            {PARTNER_KINDS.map(k => (
                                                <option key={k} value={k}>{PARTNER_KIND_LABELS[k as PartnerKind]}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="text-xs text-gray-600">Знижка клієнту, %
                                        <input type="number" step="0.5" className="border rounded-lg px-3 py-2 text-sm w-full mt-1"
                                            value={t.client_discount} onChange={e => setTerm(r, { client_discount: Number(e.target.value) })} />
                                    </label>
                                    <label className="text-xs text-gray-600">Комісія з тревелбуків, %
                                        <input type="number" step="0.5" className="border rounded-lg px-3 py-2 text-sm w-full mt-1"
                                            value={t.travelbook_rate} onChange={e => setTerm(r, { travelbook_rate: Number(e.target.value) })} />
                                    </label>
                                    <label className="text-xs text-gray-600">Комісія з решти, %
                                        <input type="number" step="0.5" className="border rounded-lg px-3 py-2 text-sm w-full mt-1"
                                            value={t.other_rate} onChange={e => setTerm(r, { other_rate: Number(e.target.value) })} />
                                    </label>
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <button disabled={busy === r.id} onClick={() => decide(r, 'approve')}
                                        className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-60">
                                        {busy === r.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                                        Підтвердити й видати код
                                    </button>
                                    <button disabled={busy === r.id} onClick={() => decide(r, 'decline')}
                                        className="px-4 py-2 border rounded-lg text-sm flex items-center gap-2 disabled:opacity-60">
                                        <X size={15} /> Відхилити
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {decided.length > 0 && (
                <>
                    <h2 className="text-lg font-bold mt-8 mb-3">Опрацьовані</h2>
                    <div className="flex flex-col gap-2">
                        {decided.map(r => (
                            <div key={r.id} className="border rounded-lg px-4 py-3 bg-white text-sm flex justify-between gap-4 flex-wrap">
                                <div>
                                    <b>{r.business_name}</b> · {r.email}
                                    <span className="text-gray-500"> · менеджер {r.manager?.name || '—'}</span>
                                    {r.status === 'declined' && r.decline_reason && (
                                        <div className="text-gray-500 mt-1">Причина: {r.decline_reason}</div>
                                    )}
                                </div>
                                <div className={r.status === 'approved' ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
                                    {r.status === 'approved' ? 'Оформлено' : 'Відхилено'}
                                    <span className="text-gray-400 font-normal">
                                        {r.decided_at ? ` · ${new Date(r.decided_at).toLocaleDateString('uk-UA')}` : ''}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
