import { describe, it, expect } from 'vitest';
import {
    MAX_RENDER_ATTEMPTS,
    RENDER_RETRY_DELAYS_MS,
    failedEntries,
    failedIndexOf,
    isTransientRenderFailure,
    isTransientRenderStatus,
    renderRetryDelayMs,
    transientFailedIndexes,
} from '@/lib/print/render-retry';

/**
 * Межа «що вважати обривом» — єдине, що вирішує, повторювати прогін чи ні, і
 * помилка в ній коштує по-різному в обидва боки: зайвий повтор з'їдає час
 * функції на макеті, який однаково не збереться, а пропущений лишає в друку
 * книгу з діркою. Тексти нижче — не вигадані: усі до одного взяті з журналу
 * помилок за 20–22.09.2026.
 */

const CLOSED_BROWSER =
    'page.goto: Target page, context or browser has been closed\n'
    + 'Call log:\n'
    + '  - navigating to "https://touchmemories.com.ua/uk/print/7b2d5f50?token=xxx&page=7&w=2480", waiting until "networkidle"\n';

describe('обрив проти справжньої відмови', () => {
    it('мертвий Chromium — це обрив', () => {
        expect(isTransientRenderFailure(CLOSED_BROWSER)).toBe(true);
        expect(isTransientRenderFailure('browser.newPage: Target page, context or browser has been closed')).toBe(true);
    });

    it('502 від Railway — це обрив', () => {
        expect(isTransientRenderFailure({
            status: 'error', code: 502, message: 'Application failed to respond', request_id: 'MrGehueFRkqoc3I6WUN5dQ',
        })).toBe(true);
    });

    it('обірвана мережа — це обрив', () => {
        expect(isTransientRenderFailure(new Error('fetch failed'))).toBe(true);
        expect(isTransientRenderFailure('socket hang up')).toBe(true);
    });

    it('не той розмір аркуша обривом НЕ є — повтор дасть те саме', () => {
        expect(isTransientRenderFailure(
            'aspect mismatch on spread 3: captured 5563x4164 (1.336) vs page content 5551x3874 (1.433). '
            + 'The /print page rendered the wrong page size.',
        )).toBe(false);
    });

    it('відсутній елемент розвороту і відмова сховища обривом НЕ є', () => {
        expect(isTransientRenderFailure('no spread element for page 4')).toBe(false);
        expect(isTransientRenderFailure('upload drafts/x/print/04.jpg: The resource already exists')).toBe(false);
    });

    it('порожнеча не читається як обрив', () => {
        expect(isTransientRenderFailure('')).toBe(false);
        expect(isTransientRenderFailure(null)).toBe(false);
        expect(isTransientRenderFailure(undefined)).toBe(false);
    });
});

describe('код відповіді', () => {
    it('502, 503 і 504 приходять від Railway, а не від сервісу — завжди повторюємо', () => {
        expect(isTransientRenderStatus(502)).toBe(true);
        expect(isTransientRenderStatus(503)).toBe(true);
        expect(isTransientRenderStatus(504)).toBe(true);
    });

    it('500 віддає вже наш сервіс, тож рішення бере з тіла', () => {
        expect(isTransientRenderStatus(500, { error: 'browser.newPage: Target page, context or browser has been closed' })).toBe(true);
        expect(isTransientRenderStatus(500, { error: 'print API 404' })).toBe(false);
        expect(isTransientRenderStatus(500)).toBe(false);
    });

    it('400 і 401 — це наша помилка у запиті, повтор не допоможе', () => {
        expect(isTransientRenderStatus(400, { error: 'projectId required' })).toBe(false);
        expect(isTransientRenderStatus(401, { error: 'Unauthorized' })).toBe(false);
    });
});

describe('які аркуші просити ще раз', () => {
    it('книга звітує spread, календар — page, і обидва читаються', () => {
        expect(failedIndexOf({ spread: 7, error: CLOSED_BROWSER })).toBe(7);
        expect(failedIndexOf({ page: 0, error: CLOSED_BROWSER })).toBe(0);
        expect(failedIndexOf({ error: 'щось' })).toBe(null);
    });

    it('повторюються тільки обірвані аркуші, і номери йдуть по порядку без повторів', () => {
        const entries = failedEntries({
            failed: [
                { spread: 7, error: CLOSED_BROWSER },
                { spread: 3, error: 'aspect mismatch on spread 3: captured 5563x4164' },
                { spread: 2, error: CLOSED_BROWSER },
                { spread: 2, error: CLOSED_BROWSER },
            ],
        });
        expect(transientFailedIndexes(entries)).toEqual([2, 7]);
    });

    it('обірваний аркуш без номера повторити неможливо, тож він лишається невдалим', () => {
        expect(transientFailedIndexes([{ error: CLOSED_BROWSER }])).toEqual([]);
    });

    it('відповідь без поля failed — це не список невдач', () => {
        expect(failedEntries({ ok: true, uploaded: ['a.jpg'] })).toEqual([]);
        expect(failedEntries(null)).toEqual([]);
        expect(transientFailedIndexes(failedEntries({ ok: true }))).toEqual([]);
    });
});

describe('скільки разів і як довго чекати', () => {
    it('перша спроба йде без паузи', () => {
        expect(renderRetryDelayMs(1)).toBe(0);
    });

    it('пауза росте, бо після 502 сервіс піднімається не миттєво', () => {
        expect(renderRetryDelayMs(2)).toBe(RENDER_RETRY_DELAYS_MS[0]);
        expect(renderRetryDelayMs(3)).toBe(RENDER_RETRY_DELAYS_MS[1]);
        expect(renderRetryDelayMs(3)).toBeGreaterThan(renderRetryDelayMs(2));
    });

    it('пауз рівно стільки, скільки повторів після першої спроби', () => {
        expect(RENDER_RETRY_DELAYS_MS.length).toBe(MAX_RENDER_ATTEMPTS - 1);
    });

    it('усі паузи разом вкладаються в час функції, інакше повтор нікуди не встигне', () => {
        const total = RENDER_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0);
        expect(total).toBeLessThan(120_000);
    });
});
