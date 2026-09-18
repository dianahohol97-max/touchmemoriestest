import { describe, expect, it } from 'vitest';
import { TTN_DISABLED_MESSAGE, TTN_SWITCH_KEY, readTtnSwitch } from '@/lib/shipping/ttn-switch';

/**
 * Накладні з сайту вимкнені, доки відправник береться не з тієї налаштовки.
 *
 * Привід — TM-001320: накладна вийшла на Діану замість ФОП Коблик Тамара, та
 * ще й із післяплатою при вже отриманій передоплаті. Ту конкретну накладну
 * зробили в KeyCRM, але наша кнопка зробила б не краще: `np_accounts`, де
 * заведено відправника, не читається жодним кодом створення накладних.
 *
 * Тут закріплено головне — що будь-яка невизначеність означає «не створювати».
 */
const reader = (result: { data?: unknown; error?: unknown } | Error) => ({
    from: () => ({
        select: () => ({
            eq: () => ({
                maybeSingle: async () => {
                    if (result instanceof Error) throw result;
                    return { data: result.data ?? null, error: result.error ?? null };
                },
            }),
        }),
    }),
});

describe('вимикач накладних', () => {
    it('немає рядка — заборонено, і це стан за замовчуванням', async () => {
        expect(await readTtnSwitch(reader({ data: null }))).toEqual({ enabled: false, reason: 'no-row' });
    });

    it('налаштування не читаються — теж заборонено, а не «мабуть можна»', async () => {
        expect(await readTtnSwitch(reader({ error: { message: 'boom' } })))
            .toEqual({ enabled: false, reason: 'unreadable' });
        expect(await readTtnSwitch(reader(new Error('мережа впала'))))
            .toEqual({ enabled: false, reason: 'unreadable' });
    });

    it('явне false — заборонено', async () => {
        for (const value of [false, 'false', 'off', 0, { enabled: false }]) {
            expect((await readTtnSwitch(reader({ data: { value } }))).enabled).toBe(false);
        }
    });

    it('увімкнути можна в тих виглядах, у яких значення реально пишуть руками', async () => {
        for (const value of [true, 'true', 'on', 'yes', '1', 1, { enabled: true }, { value: 'true' }]) {
            expect((await readTtnSwitch(reader({ data: { value } }))).enabled).toBe(true);
        }
    });

    it('незрозуміле значення читається як заборона', async () => {
        for (const value of ['хтозна', null, [], 42]) {
            expect((await readTtnSwitch(reader({ data: { value } }))).enabled).toBe(false);
        }
    });

    it('відмова каже, що робити далі, а не лише що не можна', () => {
        expect(TTN_DISABLED_MESSAGE).toContain('KeyCRM');
        expect(TTN_DISABLED_MESSAGE).toContain(TTN_SWITCH_KEY);
    });
});
