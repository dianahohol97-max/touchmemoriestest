/**
 * Події доставки від Brevo, зведені до того, що розуміє наш журнал.
 *
 * Модуль чистий навмисно: жодних запитів і жодного next/server, щоб правило
 * можна було перевірити тестами без бази й без вебхука. Сам вебхук лежить у
 * app/api/webhooks/brevo і займається лише секретом, відповіддю і записом.
 *
 * Головна пастка тут — НЕ мапа подій, а їхній порядок. Brevo не гарантує, що
 * події прийдуть у тому порядку, в якому сталися: deferred може доїхати після
 * delivered, а повтор на таймаут прилітає з тим самим ts через хвилини. Тому
 * свіжість рахується за ts із самої події, а не за часом її отримання.
 */

export type DeliveryStatus =
    | 'delivered'
    | 'hard_bounce'
    | 'soft_bounce'
    | 'spam'
    | 'blocked'
    | 'deferred'
    | 'invalid_email';

/**
 * Назва події Brevo → наш статус.
 *
 * Написання дублюються (`hard_bounce` і `hardBounce`), бо назви полів у
 * вебхуках Brevo я не можу звірити з коду — інтеграції в репо не було. Приймати
 * обидва варіанти дешевше, ніж потім ловити тихий незбіг.
 */
const EVENT_TO_STATUS: Record<string, DeliveryStatus> = {
    delivered: 'delivered',
    hard_bounce: 'hard_bounce',
    hardbounce: 'hard_bounce',
    soft_bounce: 'soft_bounce',
    softbounce: 'soft_bounce',
    spam: 'spam',
    complaint: 'spam',
    blocked: 'blocked',
    deferred: 'deferred',
    invalid_email: 'invalid_email',
    invalid: 'invalid_email',
};

/**
 * Події, які ми свідомо пропускаємо.
 *
 * Вони справжні й очікувані, просто не кажуть нічого про долю листа: `request`
 * означає лише «Brevo прийняв», відкриття та кліки в цьому журналі не
 * потрібні, а `error` я навмисно НЕ мапаю ні на що — що саме Brevo вкладає в
 * цю назву, з коду не встановити, і вгадувати семантику означало б малювати
 * менеджеру червоне там, де його може не бути.
 *
 * Різниця між цим списком і невідомою подією лише в тому, що невідому варто
 * побачити в логах: вона означає, що Brevo додав щось нове.
 */
const IGNORED_EVENTS = new Set([
    'request',
    'opened',
    'unique_opened',
    'proxy_open',
    'loadedbyproxy',
    'click',
    'unsubscribed',
    'listaddition',
    'contact_updated',
    'contact_deleted',
    'error',
]);

/** Статуси, за яких лист точно не дійшов до людини. */
export const FAILED_DELIVERY: ReadonlySet<DeliveryStatus> = new Set<DeliveryStatus>([
    'hard_bounce',
    'blocked',
    'invalid_email',
]);

/**
 * Ідентифікатор листа в однаковому вигляді з обох боків.
 *
 * API відправки віддає messageId, вебхук присилає message-id, і формат може
 * відрізнятися кутовими дужками або регістром. Незбіг тут не помітний нічим:
 * події приходять, жоден рядок не оновлюється, і виглядає це як «вебхук не
 * працює». Тому обидва боки зводяться до одного вигляду.
 */
export function normaliseMessageId(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const clean = raw.trim().replace(/^<+/, '').replace(/>+$/, '').trim().toLowerCase();
    return clean ? clean.slice(0, 300) : null;
}

/**
 * Мить, коли подія СТАЛАСЯ.
 *
 * Brevo кладе її в ts_event або ts (секунди), а date — текстом. Секунди від
 * мілісекунд відрізняємо за порядком величини: усе, що менше за 1e12, — це
 * секунди, бо в мілісекундах таке число означало б 1970 рік.
 */
export function readEventTime(payload: any): Date | null {
    const numeric = payload?.ts_event ?? payload?.ts ?? payload?.['ts-event'];
    const n = Number(numeric);
    if (Number.isFinite(n) && n > 0) {
        const ms = n < 1e12 ? n * 1000 : n;
        const d = new Date(ms);
        if (!Number.isNaN(d.getTime())) return d;
    }
    const raw = payload?.date ?? payload?.['date_event'];
    if (typeof raw === 'string' && raw.trim()) {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) return d;
    }
    return null;
}

export interface DeliveryEvent {
    messageId: string;
    status: DeliveryStatus;
    detail: string | null;
    /** Коли подія сталася. Порожньо — коли Brevo часу не дав. */
    occurredAt: Date | null;
    /** Назва події як її прислав Brevo, для логів. */
    rawEvent: string;
}

export type ParsedEvent =
    | { kind: 'delivery'; event: DeliveryEvent }
    | { kind: 'ignored'; rawEvent: string }
    | { kind: 'unknown'; rawEvent: string }
    | { kind: 'unusable'; reason: string };

/** Розбирає одну подію. Нічого не кидає — вебхук має відповісти 2xx у будь-якому разі. */
export function parseDeliveryEvent(payload: any): ParsedEvent {
    if (!payload || typeof payload !== 'object') {
        return { kind: 'unusable', reason: 'подія не є обʼєктом' };
    }

    const rawEvent = String(payload.event ?? payload.type ?? '').trim();
    if (!rawEvent) return { kind: 'unusable', reason: 'у події немає поля event' };

    const key = rawEvent.toLowerCase().replace(/[\s-]+/g, '_');
    if (IGNORED_EVENTS.has(key) || IGNORED_EVENTS.has(rawEvent.toLowerCase())) {
        return { kind: 'ignored', rawEvent };
    }

    const status = EVENT_TO_STATUS[key];
    if (!status) return { kind: 'unknown', rawEvent };

    const messageId = normaliseMessageId(payload['message-id'] ?? payload.messageId ?? payload.message_id);
    if (!messageId) return { kind: 'unusable', reason: `подія ${rawEvent} без message-id` };

    const detailRaw = payload.reason ?? payload.error ?? payload.description ?? null;
    const detail = typeof detailRaw === 'string' && detailRaw.trim()
        ? detailRaw.trim().slice(0, 500)
        : null;

    return {
        kind: 'delivery',
        event: { messageId, status, detail, occurredAt: readEventTime(payload), rawEvent },
    };
}

/**
 * Чи має ця подія перезаписати те, що вже стоїть у рядку.
 *
 * Рахується за часом ПОДІЇ, не за часом отримання: подія, яка прийшла пізніше,
 * але сталася раніше, не має права затерти свіжішу. Саме так виглядає
 * deferred, що доїхав після delivered.
 *
 * Рівний час пропускається вперед навмисно. Повтор на таймаут приходить із тим
 * самим ts і переписує ті самі значення — тобто нічого не змінює, і це рівно та
 * ідемпотентність, якої ми хочемо. А от відкинути рівний час означало б
 * загубити справжній перехід, що стався в ту саму секунду.
 *
 * Подія без часу вважається свіжою тільки поки в рядку нема нічого: інакше
 * подія невідомої давності могла б затерти датований статус.
 */
export function shouldApplyEvent(
    incomingAt: Date | null,
    storedAt: string | Date | null | undefined,
): boolean {
    if (!storedAt) return true;
    if (!incomingAt) return false;
    const stored = storedAt instanceof Date ? storedAt : new Date(storedAt);
    if (Number.isNaN(stored.getTime())) return true;
    return incomingAt.getTime() >= stored.getTime();
}

/**
 * Як рядок журналу має виглядати в картці замовлення.
 *
 * Тут живе різниця, заради якої вся задача: «надіслано» і «доставлено» — це не
 * одне й те саме. Досі картка малювала два стани і при status === 'failed'
 * писала «НЕ ДОСТАВЛЕНО», хоча failed означає, що лист навіть не пішов. Тепер
 * «не надіслано» — це наша поразка, а «не дійшов» — чужа, і плутати їх не
 * можна: перше лагодить розробник, друге означає, що клієнту треба писати
 * іншим каналом.
 *
 * Функція чиста, щоб її можна було перевірити тестом без React.
 */
export type MailTone = 'neutral' | 'good' | 'warn' | 'bad';

export interface MailRowState {
    label: string;
    tone: MailTone;
    bg: string;
    fg: string;
    /** Рядок тла для всієї картки рядка — помітність bounce і спаму. */
    rowBg: string;
}

const TONES: Record<MailTone, { bg: string; fg: string; rowBg: string }> = {
    neutral: { bg: 'transparent', fg: '#94a3b8', rowBg: '#fff' },
    good: { bg: '#f0fdf4', fg: '#16a34a', rowBg: '#fff' },
    warn: { bg: '#fffbeb', fg: '#b45309', rowBg: '#fffbeb' },
    bad: { bg: '#fef2f2', fg: '#dc2626', rowBg: '#fef2f2' },
};

export function describeMailRow(row: {
    status?: string | null;
    failure_kind?: string | null;
    error?: string | null;
    delivery_status?: string | null;
    delivery_detail?: string | null;
}): MailRowState {
    const make = (label: string, tone: MailTone): MailRowState => ({ label, tone, ...TONES[tone] });

    // Наша поразка: до провайдера лист не дійшов узагалі.
    if (row?.status === 'failed') {
        if (row?.failure_kind === 'quota') {
            // Окрема причина навмисно: ліміт минає сам опівночі, і це єдиний
            // випадок, коли достатньо почекати або підняти тариф.
            return make('НЕ НАДІСЛАНО — вичерпано денний ліміт листів', 'bad');
        }
        return make(`НЕ НАДІСЛАНО${row?.error ? `: ${row.error}` : ''}`, 'bad');
    }

    const d = row?.delivery_status || null;
    const detail = row?.delivery_detail ? `: ${row.delivery_detail}` : '';

    if (d && FAILED_DELIVERY.has(d as DeliveryStatus)) {
        const why = d === 'invalid_email' ? 'адреса не існує'
            : d === 'blocked' ? 'адресу заблоковано'
            : 'адреса відмовила';
        return make(`НЕ ДІЙШОВ ДО КЛІЄНТА — ${why}${detail}`, 'bad');
    }
    if (d === 'spam') return make(`Потрапив у спам${detail}`, 'warn');
    if (d === 'soft_bounce' || d === 'deferred') return make(`Затримується${detail}`, 'warn');
    if (d === 'delivered') return make('Доставлено', 'good');

    // Події ще не було. Це не «не дійшов» — це «ще не знаємо».
    return make('Надіслано', 'neutral');
}
