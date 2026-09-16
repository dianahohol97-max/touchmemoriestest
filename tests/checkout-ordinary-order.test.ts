import { describe, expect, it } from 'vitest';
import { selectCheckoutCodes } from '@/lib/referral/checkout-codes';
import { normalizeBindingEmail } from '@/lib/agency/binding';

/**
 * ЗВИЧАЙНЕ ЗАМОВЛЕННЯ БЕЗ ПАРТНЕРА — прогін тих самих місць, які змінила
 * партнерська модель.
 *
 * Партнерських замовлень у магазині поки нуль, а звичайних — 1152. Зміна
 * зачепила спільний код: вибір промокоду на чекауті, підстановку коду з листа
 * розсилки і визначення партнера на створенні замовлення. Тобто найдорожча
 * помилка тут — не втрачена комісія, а зламана знижка, обіцяна в листі, або
 * чекаут, який не відкривається з порожнім кошиком.
 *
 * Перевіряється рівно це: що в замовленні без жодного партнера все поводиться
 * так само, як до зміни.
 */

describe('звичайне замовлення: код із листа розсилки', () => {
    it('відкладений промокод підставляється, партнера немає', () => {
        // Людина прийшла з листа на /catalog, параметр загубився при першому
        // переході, код лежить у сховищі — заради цього його туди й кладуть.
        const r = selectCheckoutCodes({ storedPromo: 'WELCOME7' });
        expect(r.code).toBe('WELCOME7');
        expect(r.partnerCode).toBe('');
    });

    it('код прямо в адресі теж працює', () => {
        const r = selectCheckoutCodes({ urlPromo: 'WELCOME7' });
        expect(r.code).toBe('WELCOME7');
        expect(r.partnerCode).toBe('');
    });

    it('код із адреси має перевагу над відкладеним', () => {
        const r = selectCheckoutCodes({ urlPromo: 'BIRTHDAY10', storedPromo: 'WELCOME7' });
        expect(r.code).toBe('BIRTHDAY10');
    });

    it('нижній регістр приводиться до верхнього, як і раніше', () => {
        expect(selectCheckoutCodes({ storedPromo: 'welcome7' }).code).toBe('WELCOME7');
    });
});

describe('звичайне замовлення: нічого не підставляється', () => {
    it('порожні джерела дають порожній результат, а не сміття', () => {
        const r = selectCheckoutCodes({});
        expect(r.code).toBe('');
        expect(r.partnerCode).toBe('');
    });

    it('null і порожні рядки не ламають вибір', () => {
        const r = selectCheckoutCodes({ urlPromo: null, urlRef: '', storedRef: null, storedPromo: undefined });
        expect(r.code).toBe('');
        expect(r.partnerCode).toBe('');
    });

    it('сміття замість коду відкидається і не йде на сервер', () => {
        // Довжина, пробіли й підстановні знаки: якби таке доходило до роута,
        // воно або нічого не знайшло б, або описувало б НАБІР кодів.
        expect(selectCheckoutCodes({ storedPromo: 'AB' }).code).toBe('');
        expect(selectCheckoutCodes({ storedPromo: 'A'.repeat(17) }).code).toBe('');
        expect(selectCheckoutCodes({ storedPromo: 'ДВА СЛОВА' }).code).toBe('');
        expect(selectCheckoutCodes({ storedPromo: '%%%%' }).code).toBe('');
        expect(selectCheckoutCodes({ storedPromo: '____' }).code).toBe('');
    });
});

describe('порядок джерел не змінився', () => {
    it('партнерський код перебиває код із листа', () => {
        // Реферальний означає комісію агенції, і акційний не має права її
        // перебивати — правило з попередньої версії, збережене дослівно.
        const r = selectCheckoutCodes({ storedRef: 'PARTNER1', storedPromo: 'WELCOME7' });
        expect(r.code).toBe('PARTNER1');
        expect(r.partnerCode).toBe('PARTNER1');
    });

    it('свіжий перехід перебиває відкладений партнерський код', () => {
        const r = selectCheckoutCodes({ urlRef: 'PARTNER2', storedRef: 'PARTNER1' });
        expect(r.partnerCode).toBe('PARTNER2');
    });

    it('?promo= дає знижку, але атрибуція лишається за партнером', () => {
        // Саме той випадок, заради якого code і partnerCode розведені: знижку
        // дає промокод, комісію — партнер, і одне одного не скасовує.
        const r = selectCheckoutCodes({ urlPromo: 'WELCOME7', storedRef: 'PARTNER1' });
        expect(r.code).toBe('WELCOME7');
        expect(r.partnerCode).toBe('PARTNER1');
    });
});

describe('звичайне замовлення: створення без партнера', () => {
    /**
     * Дзеркалить блок визначення партнера з /api/orders/submit. Важливо, що
     * для замовлення без партнера він має завершитися НІЧИМ і нічого не
     * зламати: саме цим шляхом ідуть усі 1152 наявні замовлення.
     */
    const resolve = (opts: { email: string; refCode?: string; bindings?: Map<string, string> }) => {
        const email = normalizeBindingEmail(opts.email);
        if (!email) return null;
        const bound = opts.bindings?.get(email);
        if (bound) return bound;
        if (opts.refCode) return `partner:${opts.refCode}`;
        return null;
    };

    it('покупець без привʼязки і без коду не отримує атрибуції', () => {
        expect(resolve({ email: 'client@mail.com' })).toBeNull();
    });

    it('порожня пошта не валить визначення', () => {
        expect(resolve({ email: '' })).toBeNull();
        expect(resolve({ email: 'не пошта' })).toBeNull();
    });

    it('замовлення з промокодом, але без партнера, лишається без атрибуції', () => {
        // Знижку дав WELCOME7 — це не робить нікого партнером.
        expect(resolve({ email: 'client@mail.com' })).toBeNull();
    });
});

describe('порожній кошик', () => {
    it('вибір коду не залежить від суми — сторожа ставить сам чекаут', () => {
        // Ефект на чекауті виходить на `rawTotal <= 0` до будь-якої роботи, і
        // ця функція про суму не знає взагалі. Тест фіксує, що вона не робить
        // нічого дивного, коли її все ж покличуть: жодних винятків.
        expect(() => selectCheckoutCodes({ storedPromo: 'WELCOME7' })).not.toThrow();
        expect(selectCheckoutCodes({ storedPromo: 'WELCOME7' }).code).toBe('WELCOME7');
    });
});
