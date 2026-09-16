/**
 * Кому сьогодні йде прохання про відгук.
 *
 * Правила задала Діана 16.09.2026: сім днів після доставки, по замовленню, але
 * не частіше разу на шістдесят днів на клієнта, тільки доставлені, і нічого,
 * якщо відгук по цьому замовленню вже є.
 *
 * ЧОМУ Є ЩЕ Й ВЕРХНЯ МЕЖА. Позначка `delivered_at` — це не дата вручення, а
 * момент, коли крон відстеження побачив статус. 15.09.2026 відстеження
 * полагодили після довгої перерви, і за одну добу 256 замовлень отримали
 * позначку разом — серед них серпневі. Без верхньої межі вони всі перетнули б
 * семиденний поріг одного дня, і людина, яка забрала посилку в серпні,
 * отримала б «як вам покупка?» через півтора місяця. Тому вікно закрите з
 * обох боків, а вік самого замовлення обмежений окремо: свіжа позначка на
 * старому замовленні не робить його свіжим.
 */

export const REVIEW_REQUEST_RULES = {
    /** Скільки днів чекати після доставки. */
    minDaysAfterDelivery: 7,
    /** Пізніше за це прохання вже недоречне. */
    maxDaysAfterDelivery: 30,
    /** Замовлення, старші за це, не чіпаємо зовсім. */
    maxOrderAgeDays: 30,
    /** Одній людині — не частіше. */
    customerCooldownDays: 60,
    /** Скільки листів за один прогін. Хвиля розтікається на кілька днів. */
    batchLimit: 30,
};

export interface ReviewCandidate {
    id: string;
    customer_email: string | null;
    delivered_at: string | null;
    created_at: string;
}

export interface ReviewRequestRecord {
    email: string | null;
    sent_at: string | null;
    meta?: { order_id?: string | null } | null;
}

const DAY = 24 * 60 * 60 * 1000;
const key = (v: unknown) => String(v ?? '').trim().toLowerCase();

export function pickReviewTargets(params: {
    orders: ReviewCandidate[] | null | undefined;
    requestLog: ReviewRequestRecord[] | null | undefined;
    reviewedOrderIds: Array<string | null | undefined> | null | undefined;
    now: Date;
}): ReviewCandidate[] {
    const { orders, requestLog, reviewedOrderIds, now } = params;
    const nowMs = now.getTime();
    const R = REVIEW_REQUEST_RULES;

    const reviewed = new Set((reviewedOrderIds || []).filter(Boolean).map(String));

    // Прохання вже надсилали: по цьому замовленню — назавжди, цій людині —
    // на час охолодження.
    const askedOrders = new Set<string>();
    const askedRecently = new Set<string>();
    for (const row of requestLog || []) {
        const orderId = row?.meta?.order_id;
        if (orderId) askedOrders.add(String(orderId));
        const when = row?.sent_at ? new Date(row.sent_at).getTime() : NaN;
        const email = key(row?.email);
        if (email && Number.isFinite(when) && nowMs - when < R.customerCooldownDays * DAY) {
            askedRecently.add(email);
        }
    }

    const picked: ReviewCandidate[] = [];
    // Одна людина — один лист за прогін, навіть якщо в неї два підхожі
    // замовлення: інакше правило «раз на шістдесят днів» порушувалося б у
    // межах одного прогону.
    const takenThisRun = new Set<string>();

    const sorted = [...(orders || [])].sort((a, b) =>
        new Date(a.delivered_at || 0).getTime() - new Date(b.delivered_at || 0).getTime());

    for (const order of sorted) {
        if (picked.length >= R.batchLimit) break;

        const email = key(order?.customer_email);
        if (!email) continue;
        if (reviewed.has(String(order.id))) continue;
        if (askedOrders.has(String(order.id))) continue;
        if (askedRecently.has(email) || takenThisRun.has(email)) continue;

        const delivered = order.delivered_at ? new Date(order.delivered_at).getTime() : NaN;
        if (!Number.isFinite(delivered)) continue;
        const daysSinceDelivery = (nowMs - delivered) / DAY;
        if (daysSinceDelivery < R.minDaysAfterDelivery) continue;
        if (daysSinceDelivery > R.maxDaysAfterDelivery) continue;

        const created = new Date(order.created_at).getTime();
        if (!Number.isFinite(created)) continue;
        if ((nowMs - created) / DAY > R.maxOrderAgeDays) continue;

        picked.push(order);
        takenThisRun.add(email);
    }

    return picked;
}
