import { describe, expect, it } from 'vitest';
import {
    decide,
    fingerprint,
    formatAlert,
    groupRows,
    isReportable,
    pruneStore,
    SILENCE_BEFORE_NEW_HOURS,
    type AlertStore,
    type LogRow,
} from '@/lib/alerts/error-alerts';

/**
 * Сповіщення про помилки в проді.
 *
 * Головне тут — правило проти повторів. Сигнал, який щочверть години пише те
 * саме, перестають читати так само надійно, як не читають порожній чат, і
 * тоді наступна поломка знову лежатиме годинами.
 */

const HOUR = 3600_000;
const row = (over: Partial<LogRow> = {}): LogRow => ({
    requestPath: '/api/admin/orders',
    responseStatusCode: 500,
    message: 'Could not embed because more than one relationship was found',
    timestampInMs: 1_000_000,
    ...over,
});

describe('isReportable', () => {
    it('пʼятисотки беремо', () => {
        expect(isReportable(row({ responseStatusCode: 500 }))).toBe(true);
        expect(isReportable(row({ responseStatusCode: 503 }))).toBe(true);
    });

    /** Чотиристатки — це здебільшого чужий бот або старе посилання. */
    it('усе інше не беремо', () => {
        expect(isReportable(row({ responseStatusCode: 404 }))).toBe(false);
        expect(isReportable(row({ responseStatusCode: 200 }))).toBe(false);
        expect(isReportable(row({ responseStatusCode: null }))).toBe(false);
    });
});

describe('fingerprint', () => {
    it('той самий шлях і той самий текст дають той самий відбиток', () => {
        expect(fingerprint(row())).toBe(fingerprint(row({ timestampInMs: 9_999 })));
    });

    /** Без цього кожна поява була б «новою» і правило не спрацювало б ніколи. */
    it('номери й ідентифікатори не роблять помилку новою', () => {
        const a = row({ message: 'order 1487 failed for f47ac10b-58cc-4372-a567-0e02b2c3d479' });
        const b = row({ message: 'order 9002 failed for 550e8400-e29b-41d4-a716-446655440000' });
        expect(fingerprint(a)).toBe(fingerprint(b));
    });

    it('різні шляхи — різні помилки', () => {
        expect(fingerprint(row())).not.toBe(fingerprint(row({ requestPath: '/api/admin/clients' })));
    });

    it('параметри запиту не враховуються', () => {
        expect(fingerprint(row({ requestPath: '/api/admin/orders?page=2' }))).toBe(fingerprint(row()));
    });
});

describe('groupRows', () => {
    it('зводить однакові рядки в одну групу з лічильником', () => {
        const groups = groupRows([row(), row(), row({ requestPath: '/api/admin/clients' })]);
        expect(groups).toHaveLength(2);
        expect(groups[0].occurrences).toBe(2);
        expect(groups[0].path).toBe('/api/admin/orders');
    });

    it('успішні відповіді до груп не потрапляють', () => {
        expect(groupRows([row({ responseStatusCode: 200 }), row({ responseStatusCode: 404 })])).toHaveLength(0);
    });

    it('порожній журнал не ламає', () => {
        expect(groupRows([])).toEqual([]);
    });
});

describe('правило проти повторів', () => {
    const now = 10 * 24 * HOUR;

    it('нову помилку показуємо', () => {
        const { decisions } = decide(groupRows([row(), row()]), {}, now);
        expect(decisions[0].report).toBe(true);
        expect(decisions[0].totalCount).toBe(2);
    });

    /** Те саме повідомлення вдруге — і чат перестають читати. */
    it('ту саму помилку вдруге не показуємо', () => {
        const groups = groupRows([row()]);
        const first = decide(groups, {}, now);
        const second = decide(groups, first.nextStore, now + HOUR);
        expect(second.decisions[0].report).toBe(false);
    });

    it('лічильник росте, навіть коли мовчимо', () => {
        const first = decide(groupRows([row()]), {}, now);
        const second = decide(groupRows([row(), row(), row()]), first.nextStore, now + HOUR);
        expect(second.decisions[0].report).toBe(false);
        expect(second.decisions[0].totalCount).toBe(4);
    });

    it('після доби тиші помилка знову новина', () => {
        const first = decide(groupRows([row()]), {}, now);
        const later = decide(groupRows([row()]), first.nextStore, now + (SILENCE_BEFORE_NEW_HOURS + 1) * HOUR);
        expect(later.decisions[0].report).toBe(true);
        expect(later.decisions[0].returning).toBe(true);
    });

    it('за годину до доби ще мовчимо', () => {
        const first = decide(groupRows([row()]), {}, now);
        const later = decide(groupRows([row()]), first.nextStore, now + (SILENCE_BEFORE_NEW_HOURS - 1) * HOUR);
        expect(later.decisions[0].report).toBe(false);
    });
});

describe('formatAlert', () => {
    it('називає код, шлях і кількість повторів', () => {
        const { decisions } = decide(groupRows([row(), row(), row()]), {}, 0);
        const text = formatAlert(decisions[0]);
        expect(text).toContain('500');
        expect(text).toContain('/api/admin/orders');
        expect(text).toContain('Повторів за це вікно: 3');
    });

    /** Спільний відправник не передає parse_mode, тож теги приїхали б як текст. */
    it('розмітки не додає — текст іде як є', () => {
        const { decisions } = decide(groupRows([row({ message: 'bad <script> & co' })]), {}, 0);
        const text = formatAlert(decisions[0]);
        expect(text).toContain('bad <script> & co');
        expect(text).not.toContain('<pre>');
        expect(text).not.toContain('<b>');
    });

    it('повернення після тиші називає себе окремо', () => {
        const first = decide(groupRows([row()]), {}, 0);
        const later = decide(groupRows([row()]), first.nextStore, (SILENCE_BEFORE_NEW_HOURS + 1) * HOUR);
        expect(formatAlert(later.decisions[0])).toContain('повернулася');
    });
});

describe('pruneStore', () => {
    it('забуває те, про що давно не чути', () => {
        const now = 100 * 24 * HOUR;
        const store: AlertStore = {
            свіжа: { count: 1, lastReportedAt: now - 2 * 24 * HOUR, countAtLastReport: 1 },
            стара: { count: 1, lastReportedAt: now - 90 * 24 * HOUR, countAtLastReport: 1 },
        };
        const kept = pruneStore(store, now);
        expect(Object.keys(kept)).toEqual(['свіжа']);
    });
});
