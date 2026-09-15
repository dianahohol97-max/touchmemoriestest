import { describe, expect, it } from 'vitest';
import { isRenderComplete, failedSpreadCount } from '@/lib/print/render-result';

/**
 * Частковий рендер не має права зносити цілий макет.
 *
 * Сервіс рендеру раніше вмирав на першій невдалій сторінці: помилка виходила
 * з циклу, і все, що йшло далі, не рендерилось узагалі. TM-001301 — 14-сторінковий
 * Travel Book, у якого в сховищі лежать cover, f1, 01, 02, 03 і більше нічого,
 * причому двічі поспіль: другий прогін помер на тому самому місці за двадцять
 * секунд. Фотографії клієнта при цьому були цілі, всі 17 завантажень на місці.
 *
 * Тепер сервіс пропускає невдалий аркуш і йде далі, тож відповідь 200 більше не
 * означає «зібралося все». Ця функція — те місце, де різниця читається, і від
 * неї залежить прибирання: неповний набір реєструємо, але старі файли лишаємо.
 */
describe('isRenderComplete', () => {
    it('повний прогін нового сервісу', () => {
        expect(isRenderComplete({ ok: true, uploaded: ['a', 'b'], failed: [] })).toBe(true);
        expect(failedSpreadCount({ failed: [] })).toBe(0);
    });

    it('частковий прогін не вважається повним — випадок TM-001301', () => {
        const detail = {
            ok: false,
            uploaded: ['cover.jpg', 'f1.jpg', '01.jpg', '02.jpg', '03.jpg'],
            failed: [{ spread: 3, error: 'Target page, context or browser has been closed' }],
        };
        expect(isRenderComplete(detail)).toBe(false);
        expect(failedSpreadCount(detail)).toBe(1);
    });

    it('досить самого переліку невдалих аркушів, навіть якщо ok відсутній', () => {
        expect(isRenderComplete({ uploaded: ['a'], failed: [{ spread: 7, error: 'upload failed' }] })).toBe(false);
    });

    it('досить самого ok:false, навіть якщо переліку немає', () => {
        expect(isRenderComplete({ ok: false, uploaded: ['a'] })).toBe(false);
    });

    it('старіший деплой сервісу без нових полів читається як повний', () => {
        // Він або віддавав 200 і повний набір, або падав у 500 і сюди не доходив.
        expect(isRenderComplete({ ok: true, uploaded: ['a'] })).toBe(true);
        expect(isRenderComplete({ uploaded: ['a'] })).toBe(true);
    });

    it('порожня або відсутня відповідь — не повна', () => {
        expect(isRenderComplete(null)).toBe(false);
        expect(isRenderComplete(undefined)).toBe(false);
    });

    it('failed не масив — рахується як нуль, а не як помилка', () => {
        expect(failedSpreadCount({ failed: 'нема' as unknown })).toBe(0);
        expect(isRenderComplete({ ok: true, failed: null })).toBe(true);
    });
});
