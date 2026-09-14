/**
 * «Повторити замовлення» — що саме повторюється.
 *
 * ЧОМУ ЦЕ ОКРЕМИЙ МОДУЛЬ. Кнопка в кабінеті копіювала з минулого замовлення
 * тільки назву, ціну, кількість і опції. Усе, чим позиція насправді є —
 * макет, фотографії, факт того, що книгу верстав дизайнер, — лишалося в
 * старому замовленні, бо живе не в позиції, а поруч: файли в order_files,
 * дизайн у projects, ознака дизайнера в самому замовленні.
 *
 * Через це TM-001314 виглядав так: клієнтка п'ять разів замовила Travel Book
 * із дизайнером (TM-001304 … TM-001313, з фото і брифом), увечері натиснула
 * «Повторити» на трьох із них, заплатила 1953 ₴ — і в адмінку приїхало
 * замовлення на три книги, яке каже «самостійний макет» і не має жодного
 * файлу для друку. Ні менеджер, ні дизайнер не бачили, звідки ці книги
 * взялися.
 *
 * Повтор не може відтворити фотографії, і не має вдавати, що може. Але він
 * зобов'язаний сказати, ЧОГО він повтор: тоді замовлення їде в ту саму чергу,
 * що й оригінал, а менеджер бачить номер замовлення, з якого брати файли.
 */

/** Мітка повтору всередині metadata позиції кошика. */
export interface RepeatMeta {
    repeat_of_order_id: string;
    repeat_of_order_number: string;
    /** Оригінал робив дизайнер — повтор має потрапити в ту саму чергу. */
    designer_flow?: true;
}

export interface RepeatSourceOrder {
    id: string;
    order_number?: string | null;
    with_designer?: boolean | null;
    payment_status?: string | null;
    order_status?: string | null;
    items?: any[] | null;
}

/**
 * Попередження перед повтором НЕОПЛАЧЕНОГО замовлення.
 *
 * Саме тут клієнтка і спіткнулась. У кабінеті висіли чотири неоплачені
 * замовлення з її фотографіями, вона хотіла заплатити за три книги одним
 * платежем — і натиснула «Замовити знову», бо оплатити все разом кабінет не
 * вміє. Сайт мовчки створив паралельне замовлення на 1953 ₴ без жодного фото,
 * а чотири з фотографіями лишились неоплаченими (TM-001314).
 *
 * Повернути порожній рядок означає «питати нічого, це звичайний повтор».
 */
export function unpaidRepeatWarning(source: RepeatSourceOrder): string {
    const paid = String(source.payment_status || '').toLowerCase() === 'paid';
    const cancelled = String(source.order_status || '').toLowerCase() === 'cancelled';
    if (paid || cancelled) return '';
    const num = String(source.order_number || '').trim();
    return `Замовлення ${num || 'ще'} не оплачене, і ваші фотографії зберігаються саме в ньому. `
        + 'Кнопка створить ОКРЕМЕ нове замовлення без цих фотографій, тобто заплатити доведеться двічі. '
        + 'Щоб оплатити саме це замовлення, натисніть «Оплатити» на цій же картці. Усе одно створити нове?';
}

/** Підпис повтору для менеджера, дизайнера і майстерні. */
export function repeatNote(orderNumber: string | null | undefined): string {
    const num = String(orderNumber || '').trim();
    return num ? `Повтор замовлення ${num} — макет і фото беремо звідти.` : 'Повтор попереднього замовлення.';
}

/**
 * Позиція кошика з позиції минулого замовлення.
 *
 * `id` передається ззовні (у кошику він мусить бути новим, інакше addItem
 * просто збільшить кількість наявної позиції), тож функція лишається чистою і
 * перевіряється тестами.
 */
export function buildRepeatCartItem(item: any, source: RepeatSourceOrder, id: string): any {
    const orderNumber = source.order_number || '';
    const meta: Record<string, any> = {
        ...(item?.metadata || {}),
        repeat_of_order_id: source.id,
        repeat_of_order_number: orderNumber,
    };
    // Ознака дизайнерського замовлення лежить на ЗАМОВЛЕННІ, не на позиції,
    // тому при копіюванні позиції вона губилась, і оформлення чесно вважало
    // повтор самостійним макетом. Переносимо її явно: checkout читає саме
    // metadata.designer_flow.
    if (source.with_designer) meta.designer_flow = true;

    const note = [repeatNote(orderNumber), String(item?.personalization_note || '').trim()]
        .filter(Boolean)
        .join(' ');

    return {
        id,
        product_id: item?.product_id,
        name: item?.product_name || item?.name || 'Товар',
        price: Number(item?.unit_price ?? item?.price ?? 0),
        qty: item?.quantity ?? item?.qty ?? 1,
        slug: item?.slug || item?.product_slug,
        image: item?.image || '',
        options: item?.options || undefined,
        personalization_note: note,
        metadata: meta,
    };
}

/**
 * Чи є ця позиція повтором, і чого саме.
 *
 * Читає і адмінка (щоб показати, звідки брати файли), і серверний аудит
 * друкарських файлів (щоб не кричати «нема файлів» там, де вони є, просто в
 * іншому замовленні).
 */
export function repeatSourceOf(item: any): { id: string; orderNumber: string } | null {
    const meta = item?.metadata;
    if (!meta || typeof meta !== 'object') return null;
    const id = String(meta.repeat_of_order_id || '').trim();
    const orderNumber = String(meta.repeat_of_order_number || '').trim();
    if (!id && !orderNumber) return null;
    return { id, orderNumber };
}

/** Номери замовлень, повтором яких є ці позиції (без дублів, у порядку появи). */
export function repeatSourceNumbers(items: any[] | null | undefined): string[] {
    const out: string[] = [];
    for (const it of items || []) {
        const src = repeatSourceOf(it);
        const num = src?.orderNumber;
        if (num && !out.includes(num)) out.push(num);
    }
    return out;
}
