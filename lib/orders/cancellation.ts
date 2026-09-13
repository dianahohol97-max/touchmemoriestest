/**
 * Причина скасування замовлення — один словник і один формат запису на всі
 * шляхи, якими замовлення стає скасованим.
 *
 * Привід: на 13.09.2026 в базі було 19 скасованих замовлень, і жодне з них не
 * відповідало на питання «чому». Історія зберігала рівно рядок «Зміна статусу:
 * new → cancelled» без автора і без пояснення, а на дзеркалених із KeyCRM не
 * було й цього. Через півроку відрізнити «клієнт передумав» від «ми не встигли
 * і самі відмовили» вже неможливо, а це різні висновки для роботи.
 *
 * Скасовує замовлення не лише людина, тож станів причини два роди:
 *
 *  сім причин для ЛЮДИНИ — їх обирають у картці, і без вибору перехід у
 *  «Скасовано» не проходить узагалі;
 *
 *  not_provided — причини немає і не буде. Так скасовують у KeyCRM, звідки в
 *  дзеркало не приїжджає нічого, крім англійського ключа стадії `canceled`
 *  (перевірено 13.09.2026 на всій вибірці стадій: описових назв на кшталт
 *  «Очікування відповіді від клієнта» CRM вживає, а на скасуванні — ні).
 *  Чесний окремий стан кращий за підставлену причину: порожнє поле в картці
 *  читалося б як недогляд менеджера, а вигадана причина — як факт.
 *
 * Модуль навмисно чистий: ні запитів, ні React. Той самий рядок історії пишуть
 * адмінка, крон несплачених і дзеркало CRM, і саме спільний формат дає картці
 * змогу показати причину однаково, звідки б замовлення не прийшло.
 */

/** Дія в order_history. Окрема від «Зміна статусу» — її шукає картка. */
export const CANCELLATION_ACTION = 'order_cancelled';

export type CancellationReasonCode =
    | 'no_response'
    | 'client_refused'
    | 'not_paid'
    | 'deadline_missed'
    | 'duplicate'
    | 'test_order'
    | 'other';

/** Стан «причину не передано». Не причина, і в списку вибору його немає. */
export const NOT_PROVIDED = 'not_provided' as const;
export type CancellationState = CancellationReasonCode | typeof NOT_PROVIDED;

export interface CancellationReason {
    code: CancellationReasonCode;
    /** Підпис у випадайці адмінки. */
    label: string;
    /** Чи обовʼязковий вільний текст при цьому виборі. */
    noteRequired: boolean;
}

/**
 * Сім причин, які обирає людина.
 *
 * «Клієнт не відповідає» стоїть першим свідомо (Diana, 13.09.2026): це
 * найчастіший випадок, і він мусить бути окремим рядком, а не ховатися в
 * «іншому» — саме на ньому видно, чи допомагає нагадування про оплату.
 *
 * Вільний текст дозволено скрізь, але обовʼязковий лише для «іншої причини»:
 * вимагати опис там, де вибір уже все сказав, означає навчити команду писати
 * крапку, аби форма закрилася.
 */
export const CANCELLATION_REASONS: readonly CancellationReason[] = [
    { code: 'no_response', label: 'Клієнт не відповідає', noteRequired: false },
    { code: 'client_refused', label: 'Клієнт відмовився від замовлення', noteRequired: false },
    { code: 'not_paid', label: 'Замовлення не оплачене вчасно', noteRequired: false },
    { code: 'deadline_missed', label: 'Не встигаємо у потрібний клієнту строк', noteRequired: false },
    { code: 'duplicate', label: 'Дубль уже наявного замовлення', noteRequired: false },
    { code: 'test_order', label: 'Тестове замовлення, у звітах не рахувати', noteRequired: false },
    { code: 'other', label: 'Інша причина, опишу словами', noteRequired: true },
] as const;

const BY_CODE = new Map<string, CancellationReason>(CANCELLATION_REASONS.map(r => [r.code, r]));

/** Підпис стану, включно з тим, який людина обрати не може. */
export function cancellationLabel(state: string | null | undefined): string {
    if (state === NOT_PROVIDED) return 'Причину не передано';
    return BY_CODE.get(String(state || ''))?.label || 'Причину не записано';
}

/** Чи це причина, яку людина має право обрати в картці. */
export function isSelectableReason(code: unknown): code is CancellationReasonCode {
    return typeof code === 'string' && BY_CODE.has(code);
}

/** Довжина вільного тексту. Причина — це речення, а не стаття. */
export const NOTE_MAX_LENGTH = 500;

export type CancellationInput = { reason?: unknown; note?: unknown };
export type CancellationValidation =
    | { ok: true; reason: CancellationReasonCode; note: string | null }
    | { ok: false; error: string };

/**
 * Перевіряє причину, яку прислала картка.
 *
 * Порожній або невідомий код — це відмова, а не «інша причина»: мовчазна
 * підстановка 'other' зробила б обовʼязкове поле необовʼязковим за один реліз.
 */
export function validateCancellation(input: CancellationInput): CancellationValidation {
    const code = typeof input?.reason === 'string' ? input.reason.trim() : '';
    const reason = BY_CODE.get(code);
    if (!reason) {
        return { ok: false, error: 'Оберіть причину скасування — без неї замовлення не скасовується.' };
    }

    const raw = typeof input?.note === 'string' ? input.note.trim() : '';
    if (reason.noteRequired && !raw) {
        return { ok: false, error: 'Опишіть причину словами — для «іншої причини» це обовʼязково.' };
    }

    return { ok: true, reason: reason.code, note: raw ? raw.slice(0, NOTE_MAX_LENGTH) : null };
}

/** Звідки прийшло скасування. Впливає лише на підпис у картці. */
export type CancellationSource = 'admin' | 'cron' | 'keycrm';

export interface CancellationEntry {
    state: CancellationState;
    note?: string | null;
    source: CancellationSource;
    /** Хто натиснув. Порожньо в крона і в дзеркала — там людини немає. */
    actor?: { id?: string | null; name?: string | null } | null;
}

/**
 * Рядок order_history у форматі, спільному для всіх трьох шляхів.
 *
 * notes лишається читабельним текстом, бо панель історії показує саме його, а
 * details несе код — за ним причину знаходить картка і за ним же колись можна
 * буде порахувати, скільки замовлень втрачено через мовчання клієнта.
 */
export function buildCancellationHistoryRow(orderId: string, entry: CancellationEntry): Record<string, any> {
    const note = typeof entry.note === 'string' && entry.note.trim()
        ? entry.note.trim().slice(0, NOTE_MAX_LENGTH)
        : null;

    return {
        order_id: orderId,
        action: CANCELLATION_ACTION,
        notes: note ? `Скасовано: ${cancellationLabel(entry.state)}. ${note}` : `Скасовано: ${cancellationLabel(entry.state)}`,
        added_by: entry.actor?.id || null,
        details: {
            reason: entry.state,
            note,
            source: entry.source,
            by: entry.actor?.name || null,
        },
    };
}

export interface ResolvedCancellation {
    state: CancellationState;
    label: string;
    note: string | null;
    source: CancellationSource | null;
    by: string | null;
    at: string | null;
    /** Рядка про причину в історії немає — замовлення скасували до цієї зміни. */
    missing: boolean;
}

/**
 * Дістає причину з уже завантаженої історії замовлення.
 *
 * Картка не робить заради цього ні нового запиту, ні нової колонки: історія і
 * так приїжджає з карткою цілком. Береться НАЙСВІЖІШИЙ запис — замовлення
 * можна скасувати, повернути в роботу і скасувати знову, і показувати треба
 * чинну причину.
 *
 * Скасоване замовлення без такого рядка — це все, що встигли скасувати до
 * появи причин. Тоді missing = true, і картка каже саме це, а не мовчить.
 */
export function readCancellation(history: any[] | null | undefined): ResolvedCancellation {
    const rows = Array.isArray(history) ? history : [];
    const found = rows
        .filter(r => r?.action === CANCELLATION_ACTION)
        .sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())[0];

    if (!found) {
        return { state: NOT_PROVIDED, label: 'Причину не записано', note: null, source: null, by: null, at: null, missing: true };
    }

    const details = (found.details && typeof found.details === 'object') ? found.details as Record<string, any> : {};
    const state = (details.reason === NOT_PROVIDED || isSelectableReason(details.reason))
        ? details.reason as CancellationState
        : NOT_PROVIDED;

    return {
        state,
        label: cancellationLabel(state),
        note: typeof details.note === 'string' && details.note.trim() ? details.note.trim() : null,
        source: ['admin', 'cron', 'keycrm'].includes(details.source) ? details.source as CancellationSource : null,
        by: typeof details.by === 'string' && details.by.trim() ? details.by.trim() : null,
        at: found.created_at || null,
        missing: false,
    };
}

/** Підпис автора під причиною: людина, крон або CRM. */
export function cancellationAuthorLabel(entry: ResolvedCancellation): string {
    if (entry.by) return entry.by;
    if (entry.source === 'cron') return 'Автоматичне скасування через несплату';
    if (entry.source === 'keycrm') return 'Скасовано в KeyCRM';
    return 'Автор не записаний';
}
