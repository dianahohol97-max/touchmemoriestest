/**
 * Read a production deadline out of what people actually wrote.
 *
 * The structured fields say when an order was paid and how many pages it has.
 * They do not say "потрібно до 12 жовтня, весілля" — and that sentence is the
 * real deadline. Until now it lived only in a comment nobody's calendar could
 * see, so an urgent order looked exactly like a calm one right up until it was
 * late.
 *
 * Two things are extracted: an explicit date the customer asked for, and a
 * plain statement of urgency with no date attached.
 *
 * The hard part is not the parsing but knowing what to read. The notes field
 * carries system-generated text as well as human text — warning banners, the
 * delivery address, the designer brief header — and those contain numbers and
 * words that look exactly like deadlines. A banner saying "оплачене замовлення
 * з дизайнером понад 24 год без виконавця" must not become a one-day deadline.
 * So system lines are stripped before a single pattern is applied.
 */

export type DeadlineHint = {
    /** A date the customer asked for, at the end of that day. */
    requestedDate: Date | null;
    /** Said it has to be fast, without naming a date. */
    urgent: boolean;
    /** The exact words this was read from, so a human can check the machine. */
    evidence: string[];
};

// Lines the system writes into `notes` itself. Everything from such a marker to
// the end of its line is dropped before parsing.
const SYSTEM_LINE_MARKERS = [
    '⚠️',
    'УВАГА:',
    'Доставка:',
    'Замовлення з дизайнером',
    'Скасовано на сайті',
    'ТТН',
    'Без звірки з номенклатурою',
];

const URGENCY_PATTERNS = [
    /терміново/i,
    /якнайшвидше/i,
    /якомога швидше/i,
    /чим швидше/i,
    /дуже потрібно швидко/i,
    /горить/i,
    /\bасап\b/i,
    /\basap\b/i,
    /встиг(ти|нути|ли|ну)/i,
    /устиг(ти|нути|ли|ну)/i,
    /швидше/i,
    /терміном/i,
    /експрес/i,
];

const MONTHS: Record<string, number> = {
    'січня': 0, 'січень': 0,
    'лютого': 1, 'лютий': 1,
    'березня': 2, 'березень': 2,
    'квітня': 3, 'квітень': 3,
    'травня': 4, 'травень': 4,
    'червня': 5, 'червень': 5,
    'липня': 6, 'липень': 6,
    'серпня': 7, 'серпень': 7,
    'вересня': 8, 'вересень': 8,
    'жовтня': 9, 'жовтень': 9,
    'листопада': 10, 'листопад': 10,
    'грудня': 11, 'грудень': 11,
};

/** Everything a human wrote, with the system's own text removed. */
export function humanTextOnly(...sources: Array<string | null | undefined>): string {
    return sources
        .filter(Boolean)
        .join('\n')
        .split('\n')
        .filter(line => {
            const trimmed = line.trim();
            if (!trimmed) return false;
            return !SYSTEM_LINE_MARKERS.some(marker => trimmed.startsWith(marker));
        })
        .join('\n');
}

/**
 * The next time this day-and-month occurs, counting today as valid.
 *
 * A customer writing "12.10" in August means this October; the same note in
 * November means next October. Anchoring to the nearest future occurrence gets
 * both right without anyone typing a year.
 */
function nearestFuture(day: number, month: number, now: Date): Date | null {
    if (day < 1 || day > 31 || month < 0 || month > 11) return null;

    for (const year of [now.getFullYear(), now.getFullYear() + 1]) {
        // End of the named day: a deadline "до 12 жовтня" is met by finishing
        // on the twelfth, not by the twelfth having started.
        const candidate = new Date(year, month, day, 23, 59, 0, 0);
        if (candidate.getMonth() !== month) return null; // 31 April and friends
        if (candidate.getTime() >= now.getTime() - 12 * 3600_000) return candidate;
    }

    return null;
}

/**
 * Pull a requested date and any statement of urgency out of free text.
 *
 * `now` is a parameter rather than read from the clock so the same note always
 * parses the same way in a test.
 */
export function extractDeadlineHint(text: string, now: Date = new Date()): DeadlineHint {
    const clean = text || '';
    const evidence: string[] = [];
    const candidates: Date[] = [];

    // "до 12.10", "12.10.2026", "на 5/11" — numeric day and month, optional year.
    const numeric = /\b(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?\b/g;
    for (const match of clean.matchAll(numeric)) {
        const day = Number(match[1]);
        const month = Number(match[2]) - 1;
        const rawYear = match[3] ? Number(match[3]) : null;

        let parsed: Date | null;
        if (rawYear) {
            const year = rawYear < 100 ? 2000 + rawYear : rawYear;
            const candidate = new Date(year, month, day, 23, 59, 0, 0);
            parsed = candidate.getMonth() === month ? candidate : null;
        } else {
            parsed = nearestFuture(day, month, now);
        }

        if (parsed) {
            candidates.push(parsed);
            evidence.push(match[0]);
        }
    }

    // "до 12 жовтня", "на 5 листопада"
    const named = /\b(\d{1,2})\s+([а-яіїєґ]+)/gi;
    for (const match of clean.matchAll(named)) {
        const day = Number(match[1]);
        const month = MONTHS[match[2].toLowerCase()];
        if (month === undefined) continue;

        const parsed = nearestFuture(day, month, now);
        if (parsed) {
            candidates.push(parsed);
            evidence.push(match[0]);
        }
    }

    const urgentMatch = URGENCY_PATTERNS.find(pattern => pattern.test(clean));
    if (urgentMatch) {
        const found = clean.match(urgentMatch);
        if (found) evidence.push(found[0]);
    }

    // When several dates appear — "весілля 12.10, забираємо 10.10" — the
    // earliest is the one that binds. Being early for the later date is free;
    // being late for the earlier one is the failure.
    const requestedDate = candidates.length
        ? candidates.reduce((earliest, d) => (d < earliest ? d : earliest))
        : null;

    return { requestedDate, urgent: Boolean(urgentMatch), evidence };
}

/** Convenience wrapper: strip system text, then parse. */
export function readOrderDeadlineHint(order: any, now: Date = new Date()): DeadlineHint {
    return extractDeadlineHint(
        humanTextOnly(order?.client_comment, order?.notes, order?.designer_note),
        now,
    );
}
