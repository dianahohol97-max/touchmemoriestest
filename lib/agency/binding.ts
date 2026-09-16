import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Довічна привʼязка клієнта до партнера (Діана, 16.09.2026).
 *
 * Клієнт, який хоч раз ОПЛАТИВ замовлення за партнерським посиланням,
 * лишається за цим партнером назавжди: кожне наступне оплачене замовлення з
 * тією ж поштою нараховує партнеру комісію, хоч би з якого пристрою воно
 * прийшло і хоч би скільки часу минуло. Переходити за посиланням удруге не
 * потрібно, реєструватися теж.
 *
 * Знижка при цьому НЕ довічна: пʼять відсотків діють лише на перше,
 * привʼязувальне замовлення. Далі клієнт платить звичайну ціну, а партнер усе
 * одно отримує свої відсотки — це плата за приведеного клієнта, а не знижка,
 * яку клієнт носить із собою.
 *
 * КЛЮЧ — НОРМАЛІЗОВАНА ПОШТА, і це не спрощення, а єдине, що працює: на момент
 * переходу на цю модель із 807 оплачених замовлень лише 81 мало customer_id, а
 * 256 гостьових не мали рядка в customers узагалі. Привʼязка на акаунті
 * обслуговувала б меншість і мовчки не працювала б для решти.
 */

/**
 * Пошта у вигляді, придатному для ключа привʼязки.
 *
 * Нижній регістр і обрізані пробіли — більше нічого. Свідомо НЕ прибираються
 * крапки й не відкидається «+тег» у гмейлі: для Google це та сама скринька, а
 * для решти світу — різні адреси, тож така нормалізація склеїла б різних людей
 * заради одного постачальника пошти. Ціна помилки несиметрична: зайва
 * привʼязка віддає чужу комісію, а зайвий пропуск лише не зекономить клієнту
 * нічого.
 */
export function normalizeBindingEmail(email: string | null | undefined): string | null {
    const value = String(email ?? '').trim().toLowerCase();
    if (!value || !value.includes('@')) return null;
    return value.slice(0, 320);
}

/**
 * Чи це самореферал: партнер купує за власним посиланням.
 *
 * Такий випадок не дає ні комісії, ні привʼязки — інакше партнер прив'язав би
 * сам себе й отримував відсоток із кожної власної покупки назавжди.
 */
export function isSelfReferral(
    buyerEmail: string | null | undefined,
    partnerEmail: string | null | undefined,
): boolean {
    const buyer = normalizeBindingEmail(buyerEmail);
    const partner = normalizeBindingEmail(partnerEmail);
    return !!buyer && !!partner && buyer === partner;
}

export interface PartnerBinding {
    email: string;
    partner_id: string;
    bound_at: string;
}

/** Партнер, за яким закріплена ця пошта, або null. */
export async function findBinding(
    admin: SupabaseClient,
    email: string | null | undefined,
): Promise<PartnerBinding | null> {
    const key = normalizeBindingEmail(email);
    if (!key) return null;
    const { data } = await admin
        .from('partner_client_bindings')
        .select('email, partner_id, bound_at')
        .eq('email', key)
        .maybeSingle();
    return (data as PartnerBinding) || null;
}

/**
 * Закріпити пошту за партнером, якщо вона ще нічия.
 *
 * Правило «створюється один раз і пізнішими переходами не перезаписується»
 * тримається на первинному ключі в базі, а не на перевірці перед вставкою:
 * перевірка програє гонці двох одночасних оплат, а ключ — ні. Конфлікт
 * ігнорується мовчки, бо він означає рівно те, чого ми й хочемо: привʼязка вже
 * є, і вона чинна.
 *
 * Повертає true, якщо привʼязку створив САМЕ цей виклик — за цим і
 * визначається, чи є замовлення «новим клієнтом» у нарахуванні.
 */
export async function bindClientToPartner(
    admin: SupabaseClient,
    opts: { email: string | null | undefined; partnerId: string; orderId: string },
): Promise<boolean> {
    const key = normalizeBindingEmail(opts.email);
    if (!key) return false;

    const { data, error } = await admin
        .from('partner_client_bindings')
        .upsert(
            { email: key, partner_id: opts.partnerId, first_order_id: opts.orderId },
            { onConflict: 'email', ignoreDuplicates: true },
        )
        .select('email');

    if (error) {
        console.error('[partner-binding] bind failed:', error.message);
        return false;
    }
    // Порожній результат означає, що спрацював ignoreDuplicates: пошта вже за
    // кимось закріплена, і цей виклик нічого не змінив.
    return Array.isArray(data) && data.length > 0;
}
