'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { Loader2, BadgePercent } from 'lucide-react';

/**
 * Місток з адмінки в кабінет продажів (Diana, 2026-08-06).
 *
 * Свій персонал (Аліна, Катерина) працює в адмінці щодня, а кабінет менеджера
 * з продажів живе за приватним посиланням — щоб їм не тримати те посилання
 * окремо, цей пункт меню сам знаходить кабінет за поштою залогіненої людини й
 * переходить туди. Хто ролі не має, бачить пояснення замість помилки.
 */
export default function MySalesPage() {
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/admin/sales-managers/my-cabinet');
                const json = await res.json();
                if (cancelled) return;
                if (res.ok && json?.cabinet_token) {
                    window.location.href = `/uk/sales/${json.cabinet_token}`;
                } else {
                    setMessage(json?.error || 'Не вдалося відкрити кабінет');
                }
            } catch {
                if (!cancelled) setMessage('Не вдалося відкрити кабінет — спробуйте оновити сторінку');
            }
        })();
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="p-8 max-w-xl">
            <h1 className="text-2xl font-bold flex items-center gap-2 mb-4">
                <BadgePercent size={24} /> Мій кабінет продажів
            </h1>
            {message ? (
                <p className="text-sm text-gray-600 border rounded-xl bg-white p-4">{message}</p>
            ) : (
                <p className="text-sm text-gray-500 flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Відкриваємо ваш кабінет…
                </p>
            )}
        </div>
    );
}
