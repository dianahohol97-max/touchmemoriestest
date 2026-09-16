import { describe, expect, it } from 'vitest';
import {
    SERVER_ORDER_FLOW_FLAGS,
    isFlagOn,
    isServerOrderFlowEnabled,
    orderFlowMarker,
} from '@/lib/orders/server-order-flow';

/**
 * Вимикач переносу оформлення на сервер і помітка джерела.
 *
 * Перевіряється передусім бік відмови: усе незрозуміле має означати «старий
 * шлях». Вимикач, який за замовчуванням вмикає нове, — це не відкат.
 */
describe('вимикач серверного оформлення', () => {
    it('увімкнено тільки на явно ствердних значеннях', () => {
        for (const on of [true, 'true', 'TRUE', ' true ', 'on', 'yes', '1', 1, { enabled: true }, { value: 'true' }]) {
            expect(isFlagOn(on), String(JSON.stringify(on))).toBe(true);
        }
    });

    it('усе інше — вимкнено, зокрема відсутнє і незрозуміле', () => {
        for (const off of [undefined, null, false, 'false', 'off', '', 'колись потім', 0, 2, [], {}, { enabled: false }]) {
            expect(isFlagOn(off), String(JSON.stringify(off))).toBe(false);
        }
    });

    const reader = (row: { value?: unknown } | null, seen?: string[]) => ({
        from: () => ({
            select: () => ({
                eq: (_c: string, key: string) => {
                    seen?.push(key);
                    return { maybeSingle: async () => ({ data: row }) };
                },
            }),
        }),
    });

    it('немає рядка в settings — потік іде старим шляхом', async () => {
        expect(await isServerOrderFlowEnabled(reader(null), 'magazine-text-brief')).toBe(false);
    });

    it('рядок зі ствердним значенням вмикає саме свій потік', async () => {
        const seen: string[] = [];
        expect(await isServerOrderFlowEnabled(reader({ value: true }, seen), 'magazine-text-brief')).toBe(true);
        expect(seen).toEqual([SERVER_ORDER_FLOW_FLAGS['magazine-text-brief']]);
        expect(SERVER_ORDER_FLOW_FLAGS['magazine-text-brief']).not.toBe(SERVER_ORDER_FLOW_FLAGS['designer']);
    });

    /**
     * Недоступна таблиця налаштувань не має ламати оформлення: замовлення
     * оформиться старим шляхом, який і зараз працює.
     */
    it('помилка читання — це вимкнено, а не виняток', async () => {
        const broken = {
            from: () => ({
                select: () => ({
                    eq: () => ({ maybeSingle: async () => { throw new Error('PGRST301'); } }),
                }),
            }),
        };
        await expect(isServerOrderFlowEnabled(broken, 'designer')).resolves.toBe(false);
    });
});

describe('помітка джерела замовлення', () => {
    it('обидва шляхи пишуть однакові ключі, різниться тільки order_path', () => {
        const old = orderFlowMarker({ flow: 'magazine-text-brief', path: 'client', at: '2026-09-16T10:00:00.000Z' });
        const fresh = orderFlowMarker({ flow: 'magazine-text-brief', path: 'server', at: '2026-09-16T10:00:00.000Z' });
        expect(Object.keys(old).sort()).toEqual(Object.keys(fresh).sort());
        expect(old.order_path).toBe('client');
        expect(fresh.order_path).toBe('server');
        expect(old.order_flow).toBe('magazine-text-brief');
    });

    it('заявлена і порахована ціни лежать окремо, щоб розбіжність було видно', () => {
        const marker = orderFlowMarker({
            flow: 'magazine-text-brief',
            path: 'server',
            declaredTotal: 2400,
            computedTotal: 2600,
        });
        expect(marker.price_declared).toBe(2400);
        expect(marker.price_computed).toBe(2600);
    });

    /**
     * Ціни немає, коли сторінка не змогла її порахувати (немає кількості
     * сторінок). Нуль і відсутність — різні речі, і нуль у звіті виглядав би
     * як безкоштовне замовлення.
     */
    it('непорахована ціна не пишеться зовсім', () => {
        const marker = orderFlowMarker({ flow: 'magazine-text-brief', path: 'client', declaredTotal: null });
        expect('price_declared' in marker).toBe(false);
        expect('price_computed' in marker).toBe(false);
        expect(orderFlowMarker({ flow: 'designer', path: 'client', declaredTotal: NaN }).price_declared).toBeUndefined();
    });

    it('час помітки ставиться сам, якщо його не передали', () => {
        const marker = orderFlowMarker({ flow: 'designer', path: 'client' });
        expect(String(marker.order_flow_at)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
});
