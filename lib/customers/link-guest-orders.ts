import { shouldLinkOrder } from './name-match';

/**
 * Прив'язка гостьових замовлень до щойно створеного акаунта.
 *
 * Викликається при реєстрації. Бере всі замовлення з тією самою нормалізованою
 * поштою, у яких customer_id порожній, і розкладає їх на дві купки:
 *
 *   * ім'я в замовленні і в картці зійшлося — ставимо customer_id одразу;
 *   * не зійшлося — лишаємо customer_id порожнім і позначаємо кандидатом,
 *     щоб менеджер подивився пару очима в адмінці.
 *
 * Друга купка НЕ прапорець «колись розберемося». Її видно окремим списком у
 * розділі «Клієнти», бо прапорець без списку накопичується — рівно так
 * накопичилися ті 79 замовлень, з яких усе почалося.
 *
 * Дзеркалені з KeyCRM замовлення (source='keycrm') не чіпаються взагалі: вони
 * приходять із CRM зі своєю моделлю клієнта, і це чужа область.
 *
 * Помилка тут не має ламати реєстрацію. Людина створила акаунт — це головне;
 * непов'язане замовлення полагодить менеджер, а неможливість зареєструватися
 * не полагодить ніхто.
 */

export interface LinkGuestOrdersResult {
    linked: number;
    review: number;
    scanned: number;
}

/** Пошта в тому вигляді, у якому її можна порівнювати. */
export function normaliseEmail(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const s = raw.trim().toLowerCase();
    return s.length > 0 ? s : null;
}

export async function linkGuestOrdersForCustomer(
    admin: any,
    customer: { id: string; email: unknown; name?: unknown; phone?: unknown },
): Promise<LinkGuestOrdersResult> {
    const empty: LinkGuestOrdersResult = { linked: 0, review: 0, scanned: 0 };
    const email = normaliseEmail(customer.email);
    if (!email || !customer.id) return empty;

    // ilike, а не eq: у замовленнях пошта записана як людина її ввела, з
    // великими літерами і пробілами. Екранування не потрібне — адреса вже
    // пройшла нормалізацію, а спецсимволів у ній не буває.
    const { data: orders, error } = await admin
        .from('orders')
        .select('id, customer_name, customer_phone, source')
        .is('customer_id', null)
        .is('link_review_rejected_at', null)
        .ilike('customer_email', email);

    if (error || !orders?.length) return empty;

    const toLink: string[] = [];
    const toReview: Array<{ id: string; reason: string }> = [];

    for (const o of orders) {
        if (o.source === 'keycrm') continue;
        const verdict = shouldLinkOrder({
            cardName: customer.name,
            orderName: o.customer_name,
            cardPhone: customer.phone,
            orderPhone: o.customer_phone,
        });
        if (verdict.verdict === 'match') toLink.push(o.id);
        else toReview.push({ id: o.id, reason: verdict.reason });
    }

    if (toLink.length) {
        await admin
            .from('orders')
            .update({ customer_id: customer.id, updated_at: new Date().toISOString() })
            .in('id', toLink)
            .is('customer_id', null);
    }

    // Кандидати оновлюються по одному, бо причина в кожного своя. Їх завжди
    // одиниці на реєстрацію, тож окремі запити тут дешевші за конструювання
    // спільного UPDATE ... FROM (values ...).
    for (const r of toReview) {
        await admin
            .from('orders')
            .update({
                link_candidate_customer_id: customer.id,
                link_candidate_at: new Date().toISOString(),
                link_candidate_reason: r.reason,
            })
            .eq('id', r.id)
            .is('customer_id', null);
    }

    return { linked: toLink.length, review: toReview.length, scanned: orders.length };
}
