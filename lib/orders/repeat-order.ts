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
    /** Готовий підпис для людини — живе тут, а не в брифі позиції. */
    repeat_note: string;
    /** В оригіналі був бриф. Сам текст не переносимо, але факт не ховаємо. */
    repeat_source_had_brief?: true;
    /** Оригінал робив дизайнер — повтор має потрапити в ту саму чергу. */
    designer_flow?: true;
}

export interface RepeatSourceOrder {
    id: string;
    order_number?: string | null;
    with_designer?: boolean | null;
    items?: any[] | null;
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
 *
 * ПРО БРИФ. Бриф оригіналу в повтор не переноситься зовсім. Туди конструктори
 * пишуть «Кому / Текст / Від / Дата» диплома, заголовок і присвяту зоряної
 * карти, параметри пазла — тобто вказівки про КОНКРЕТНІ фотографії, яких у
 * повторі немає. Менеджер, читаючи такий бриф, шукав би в замовленні файли,
 * що існують в іншому.
 *
 * Мовчки це теж не губиться: факт того, що бриф був, лишається в метаданих
 * (repeat_source_had_brief), а картка позиції в адмінці каже про нього рядком
 * і веде на замовлення-джерело, де бриф лежить цілим.
 */
export function buildRepeatCartItem(item: any, source: RepeatSourceOrder, id: string): any {
    const orderNumber = source.order_number || '';
    const meta: Record<string, any> = {
        ...(item?.metadata || {}),
        repeat_of_order_id: source.id,
        repeat_of_order_number: orderNumber,
        repeat_note: repeatNote(orderNumber),
    };
    // Ознака дизайнерського замовлення лежить на ЗАМОВЛЕННІ, не на позиції,
    // тому при копіюванні позиції вона губилась, і оформлення чесно вважало
    // повтор самостійним макетом. Переносимо її явно: checkout читає саме
    // metadata.designer_flow.
    if (source.with_designer) meta.designer_flow = true;

    // Бриф НЕ переносимо — він про фотографії, яких тут немає. Але позначаємо,
    // що в оригіналі він був, інакше зникнення читалося б як «брифу не було».
    if (String(item?.personalization_note || '').trim()) meta.repeat_source_had_brief = true;

    return {
        id,
        product_id: item?.product_id,
        name: item?.product_name || item?.name || 'Товар',
        price: Number(item?.unit_price ?? item?.price ?? 0),
        qty: item?.quantity ?? item?.qty ?? 1,
        slug: item?.slug || item?.product_slug,
        image: item?.image || '',
        options: item?.options || undefined,
        metadata: meta,
    };
}

/**
 * Чи є ця позиція повтором, і чого саме.
 *
 * Читає адмінка, щоб показати менеджеру, з якого замовлення брати файли.
 */
export function repeatSourceOf(item: any): { id: string; orderNumber: string; note: string; hadBrief: boolean } | null {
    const meta = item?.metadata;
    if (!meta || typeof meta !== 'object') return null;
    const id = String(meta.repeat_of_order_id || '').trim();
    const orderNumber = String(meta.repeat_of_order_number || '').trim();
    if (!id && !orderNumber) return null;
    // Позиції, записані до появи repeat_note, підпис відновлюють з номера.
    const note = String(meta.repeat_note || '').trim() || repeatNote(orderNumber);
    return { id, orderNumber, note, hadBrief: meta.repeat_source_had_brief === true };
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
