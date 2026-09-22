import { describe, expect, it } from 'vitest';
import { GAP_DAYS, kyivMorningAfter, kyivMorningUtc, nextSlot, PUBLISH_HOUR } from '@/lib/blog/schedule';
import { publishNow, readDuePost, reschedule } from '@/lib/blog/queue';

/**
 * Розклад черги блогу.
 *
 * ЩО ТУТ ВАЖЛИВО ПЕРЕВІРИТИ. Дві речі ламаються тихо. Перша — перехід на
 * літній час: захардкоджений зсув на три години дав би восьму ранку пів року,
 * і побачити це можна лише за фактом публікації. Друга — слот у минулому:
 * якщо черга довго стояла порожньою, наступна стаття могла б дістати дату,
 * яка вже минула, і крон випустив би її тієї ж ночі замість ранку.
 */

/** Котра година в Києві в цей момент. */
function kyivHour(at: Date): number {
    return Number(new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Kyiv', hour: '2-digit', hour12: false,
    }).format(at)) % 24;
}

describe('сьома ранку за Києвом', () => {
    it('влітку це 04:00 UTC', () => {
        // Літній час, UTC+3.
        expect(kyivMorningUtc(2026, 7, 15).toISOString()).toBe('2026-07-15T04:00:00.000Z');
    });

    it('взимку це 05:00 UTC', () => {
        // Зимовий час, UTC+2. Саме тут захардкоджений зсув і помилявся б.
        expect(kyivMorningUtc(2026, 1, 15).toISOString()).toBe('2026-01-15T05:00:00.000Z');
    });

    it('лишається сьомою по обидва боки переходу', () => {
        // Україна переводить годинник в останню неділю жовтня.
        for (const day of [24, 25, 26, 27]) {
            expect(kyivHour(kyivMorningUtc(2026, 10, day))).toBe(PUBLISH_HOUR);
        }
    });

    it('зсув по добах не гублить годину в ніч переходу', () => {
        const before = kyivMorningUtc(2026, 10, 24);
        expect(kyivHour(kyivMorningAfter(before, 1))).toBe(PUBLISH_HOUR);
        expect(kyivHour(kyivMorningAfter(before, 2))).toBe(PUBLISH_HOUR);
        expect(kyivHour(kyivMorningAfter(before, 3))).toBe(PUBLISH_HOUR);
    });
});

describe('інтервали чергуються, а не повторюються', () => {
    const now = new Date('2026-09-22T09:00:00Z');

    it('перший слот після якоря — через два дні', () => {
        const anchor = kyivMorningUtc(2026, 10, 1);
        expect(nextSlot(anchor, 0, now).toISOString()).toBe(kyivMorningUtc(2026, 10, 3).toISOString());
    });

    it('другий — через три', () => {
        const anchor = kyivMorningUtc(2026, 10, 3);
        expect(nextSlot(anchor, 1, now).toISOString()).toBe(kyivMorningUtc(2026, 10, 6).toISOString());
    });

    it('десять слотів поспіль дають 2, 3, 2, 3 і жодного дубля', () => {
        let anchor = kyivMorningUtc(2026, 10, 1);
        const gaps: number[] = [];
        for (let i = 0; i < 10; i++) {
            const slot = nextSlot(anchor, i, now);
            gaps.push(Math.round((slot.getTime() - anchor.getTime()) / 86_400_000));
            anchor = slot;
        }
        expect(gaps).toEqual([2, 3, 2, 3, 2, 3, 2, 3, 2, 3]);
        expect(GAP_DAYS).toEqual([2, 3]);
    });
});

describe('слот ніколи не опиняється в минулому', () => {
    it('порожня черга з давнім якорем підтягується вперед', () => {
        // Черга стояла порожньою пів року: якір далеко позаду, і наївне
        // «якір плюс два дні» віддало б квітень. Крон випустив би статтю
        // тієї ж ночі, а не вранці за розкладом.
        const now = new Date('2026-09-22T09:00:00Z');
        const slot = nextSlot(new Date('2026-04-01T04:00:00Z'), 0, now);
        expect(slot.getTime()).toBeGreaterThan(now.getTime());
        expect(kyivHour(slot)).toBe(PUBLISH_HOUR);
    });

    it('без якоря рахує від «зараз»', () => {
        const now = new Date('2026-09-22T09:00:00Z');
        expect(nextSlot(null, 0, now).toISOString()).toBe(kyivMorningUtc(2026, 9, 24).toISOString());
    });

    it('слот у той самий день, але вже по обіді, переїжджає на наступний ранок', () => {
        // Якір о 07:00, «зараз» 09:00 того ж дня: доданий інтервал усе одно
        // дає майбутнє, тож підтягувати нічого не треба.
        const now = new Date('2026-09-22T09:00:00Z');
        const anchor = kyivMorningUtc(2026, 9, 22);
        expect(nextSlot(anchor, 0, now).toISOString()).toBe(kyivMorningUtc(2026, 9, 24).toISOString());
    });
});

/**
 * Двійник PostgREST: запам'ятовує ланцюжок викликів і віддає підставлений рядок.
 * Потрібен, бо саме форма запиту тут і є предметом перевірки.
 */
function fakeDb(row: any = null) {
    const calls: Array<[string, ...any[]]> = [];
    const builder: any = new Proxy({}, {
        get: (_t, prop: string) => {
            if (prop === 'then') return undefined;
            return (...args: any[]) => {
                calls.push([prop, ...args]);
                if (prop === 'maybeSingle' || prop === 'single') {
                    return Promise.resolve({ data: row, error: null });
                }
                if (prop === 'update' || prop === 'insert') return builder;
                if (prop === 'eq' && calls.filter(c => c[0] === 'update').length) {
                    // update().eq() завершує запит — PostgREST виконує його тут.
                    return Promise.resolve({ data: null, error: null });
                }
                return builder;
            };
        },
    });
    return { db: { from: (t: string) => { calls.push(['from', t]); return builder; } }, calls };
}

describe('черга відбирає статті в самому запиті, а не після нього', () => {
    it('умови стоять до .limit(), інакше вибірка стає лотереєю', async () => {
        // Гоча 13 у CLAUDE.md: відсів у JavaScript після ліміту вже спиняв
        // звірку з KeyCRM, і виглядало це як успішний прогін.
        const { db, calls } = fakeDb(null);
        await readDuePost(db as any, new Date('2026-09-28T05:00:00Z'));

        const names = calls.map(c => c[0]);
        expect(names.indexOf('eq')).toBeLessThan(names.indexOf('limit'));
        expect(names.indexOf('lte')).toBeLessThan(names.indexOf('limit'));
        expect(calls).toContainEqual(['eq', 'status', 'scheduled']);
        expect(calls).toContainEqual(['lte', 'publish_at', '2026-09-28T05:00:00.000Z']);
        expect(calls).toContainEqual(['order', 'publish_at', { ascending: true }]);
    });
});

describe('публікація пише всі три поля видимості разом', () => {
    it('status, прапорець і дата — одним оновленням', async () => {
        const { db, calls } = fakeDb();
        await publishNow(db as any, { id: 'abc', publish_at: '2026-09-28T04:00:00.000Z' },
            new Date('2026-09-28T05:00:00Z'));

        const update = calls.find(c => c[0] === 'update')![1];
        expect(update).toEqual({
            status: 'published',
            is_published: true,
            // Дата з наміру, а не з моменту запуску: стаття, запланована на
            // сьому, має показувати сьому, навіть якщо крон дійшов о восьмій.
            published_at: '2026-09-28T04:00:00.000Z',
        });
    });

    it('намір у майбутньому не стає датою публікації', async () => {
        // Публікація руками з адмінки: `publish_at` ще попереду, і поставити
        // його в `published_at` означало б статтю, датовану завтрашнім днем.
        const { db, calls } = fakeDb();
        const now = new Date('2026-09-28T05:00:00Z');
        await publishNow(db as any, { id: 'abc', publish_at: '2026-10-05T04:00:00.000Z' }, now);
        expect((calls.find(c => c[0] === 'update')![1] as any).published_at).toBe(now.toISOString());
    });
});

describe('перенесення повертає статтю в чергу, а не лишає її відкритою', () => {
    it('гасить прапорець, щоб відкрив її саме крон', async () => {
        const { db, calls } = fakeDb();
        await reschedule(db as any, 'abc', new Date('2026-10-30T05:00:00Z'));
        expect(calls.find(c => c[0] === 'update')![1]).toEqual({
            status: 'scheduled',
            is_published: false,
            publish_at: '2026-10-30T05:00:00.000Z',
        });
    });
});
