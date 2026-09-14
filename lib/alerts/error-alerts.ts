/**
 * Сповіщення про помилки в проді — вирішальна частина, без мережі.
 *
 * Навіщо. 14.09.2026 міграція зробила неоднозначним звʼязок orders із
 * customers, і список замовлень в адмінці відповідав п'ятисоткою кілька
 * годин. Дізналися випадково, читаючи журнал заради іншого. Сигналу про
 * помилки в проді не було жодного: ні Sentry, ні сповіщення, нічого.
 *
 * Чому саме так, а не гачком на неперехоплені винятки. Та поломка НЕ кидала
 * винятку: маршрут спіймав помилку сам, записав її в консоль і чесно віддав
 * 500. Гачок на винятки — це instrumentation.ts — її б не побачив. Тому
 * дивимося на КОД ВІДПОВІДІ в журналі, а не на викинуті винятки.
 *
 * Правило проти повторів (Diana, 14.09.2026): кожну помилку — один раз, із
 * лічильником повторів. Одна й та сама поломка може дати тисячі рядків за
 * пʼятнадцять хвилин, і чат, у який щочверть години падає те саме, перестають
 * читати рівно так само, як не читають порожній чат.
 */

/** Скільки годин тиші робить помилку знову новиною. */
export const SILENCE_BEFORE_NEW_HOURS = 24;

export interface LogRow {
    requestPath?: string | null;
    responseStatusCode?: number | null;
    message?: string | null;
    timestampInMs?: number | null;
    level?: string | null;
}

export interface AlertState {
    /** Скільки разів помилку бачили за весь час спостереження. */
    count: number;
    /** Коли про неї востаннє писали в чат, у мілісекундах. */
    lastReportedAt: number;
    /** Скільки повторів було на момент останнього повідомлення. */
    countAtLastReport: number;
}

export type AlertStore = Record<string, AlertState>;

/**
 * Чи це та помилка, про яку варто будити людей.
 *
 * Лише пʼятисотки: чотиристатки — це найчастіше чужий бот або застаріле
 * посилання, і будити на них означає привчити не дивитися.
 */
export function isReportable(row: LogRow): boolean {
    const code = Number(row?.responseStatusCode ?? 0);
    return code >= 500 && code <= 599;
}

/**
 * Ключ, за яким дві появи вважаються тією самою помилкою.
 *
 * Шлях плюс код плюс початок тексту. Числа з тексту вирізаються: ідентифікатор
 * замовлення чи рядок з датою робили б кожну появу «новою», і правило проти
 * повторів не спрацювало б жодного разу.
 */
export function fingerprint(row: LogRow): string {
    const path = (row?.requestPath || '(без шляху)').split('?')[0];
    const code = Number(row?.responseStatusCode ?? 0);
    const text = (row?.message || '')
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
        .replace(/\d+/g, '<n>')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
    return `${code} ${path} ${text}`;
}

/** Помилка, зведена з багатьох рядків журналу. */
export interface ErrorGroup {
    key: string;
    path: string;
    statusCode: number;
    sample: string;
    occurrences: number;
    lastSeenAt: number;
}

/** Зводить рядки журналу в групи за відбитком. */
export function groupRows(rows: LogRow[]): ErrorGroup[] {
    const groups = new Map<string, ErrorGroup>();
    for (const row of rows || []) {
        if (!isReportable(row)) continue;
        const key = fingerprint(row);
        const existing = groups.get(key);
        const at = Number(row?.timestampInMs ?? 0);
        if (existing) {
            existing.occurrences++;
            if (at > existing.lastSeenAt) existing.lastSeenAt = at;
        } else {
            groups.set(key, {
                key,
                path: (row?.requestPath || '(без шляху)').split('?')[0],
                statusCode: Number(row?.responseStatusCode ?? 0),
                sample: (row?.message || '').replace(/\s+/g, ' ').trim().slice(0, 400),
                occurrences: 1,
                lastSeenAt: at,
            });
        }
    }
    return [...groups.values()].sort((a, b) => b.occurrences - a.occurrences);
}

export interface Decision {
    group: ErrorGroup;
    /** Скільки разів помилку бачили за весь час, разом із цим вікном. */
    totalCount: number;
    /** Чи писати про неї в чат зараз. */
    report: boolean;
    /** Чи повернулася вона після доби тиші. */
    returning: boolean;
}

/**
 * Що з цими групами робити, і який вигляд матиме стан після.
 *
 * Пишемо, якщо помилку бачимо вперше, або якщо вона поверталася після доби
 * тиші. У решті випадків мовчимо і лише збільшуємо лічильник: повідомлення
 * про неї вже є, і друге нічого не додає.
 */
export function decide(
    groups: ErrorGroup[],
    store: AlertStore,
    now: number,
): { decisions: Decision[]; nextStore: AlertStore } {
    const nextStore: AlertStore = { ...store };
    const decisions: Decision[] = [];

    for (const group of groups) {
        const previous = store[group.key];
        const totalCount = (previous?.count ?? 0) + group.occurrences;
        const silentFor = previous ? now - previous.lastReportedAt : Infinity;
        const returning = Boolean(previous) && silentFor >= SILENCE_BEFORE_NEW_HOURS * 3600_000;
        const report = !previous || returning;

        decisions.push({ group, totalCount, report, returning });
        nextStore[group.key] = {
            count: totalCount,
            lastReportedAt: report ? now : (previous?.lastReportedAt ?? now),
            countAtLastReport: report ? totalCount : (previous?.countAtLastReport ?? totalCount),
        };
    }
    return { decisions, nextStore };
}

/**
 * Текст повідомлення в чат.
 *
 * Звичайний текст, без розмітки: спільний відправник sendViaPublicBot не
 * передає parse_mode, тож будь-які теги приїхали б у чат як є.
 */
export function formatAlert(decision: Decision): string {
    const { group, totalCount, returning } = decision;
    const head = returning
        ? 'Помилка повернулася після доби тиші'
        : 'Помилка в проді';

    const repeats = group.occurrences > 1
        ? `\nПовторів за це вікно: ${group.occurrences}.`
        : '';
    const history = totalCount > group.occurrences
        ? ` Разом із попередніми — ${totalCount}.`
        : '';

    return `${head}\n${group.statusCode} ${group.path}${repeats}${history}\n\n${group.sample}`;
}

/**
 * Прибирає з памʼяті те, про що давно не чути.
 *
 * Без цього рядок у налаштуваннях ріс би вічно, а помилка, полагоджена три
 * місяці тому, лишалася б «уже відомою» назавжди.
 */
export function pruneStore(store: AlertStore, now: number, keepDays = 30): AlertStore {
    const cutoff = now - keepDays * 86400_000;
    const kept: AlertStore = {};
    for (const [key, value] of Object.entries(store || {})) {
        if ((value?.lastReportedAt ?? 0) >= cutoff) kept[key] = value;
    }
    return kept;
}
