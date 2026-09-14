import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    DUPLICATE_WINDOW_HOURS,
    duplicateWindowStart,
    isDuplicateGuardedAction,
} from '@/lib/email/log-outgoing';
import { SHOP_CONTACT_EMAIL } from '@/lib/email/contact-address';

/**
 * Два однакові листи про одну подію, і мертва адреса в підвалі.
 *
 * Перше ловиться правилом «та сама дія за тим самим замовленням уже пішла
 * успішно». Правило живе в одному місці — у маршруті /api/email/transactional,
 * куди сходяться всі чотири шляхи підтвердження оплати, — саме тому, що чотири
 * окремі перевірки по маршрутах якраз і не бачили одна одну.
 *
 * Друге — це запрошення написати на hello@touchmemories.com.ua. Скриньки за
 * цією адресою не існує взагалі: домен підтверджений у Brevo, тож листи з неї
 * ВІДПРАВЛЯЮТЬСЯ, і зовні все справне, а кожна відповідь клієнта летить у
 * порожнечу.
 */

describe('правило повторів', () => {
    it('дії про одноразову подію захищені', () => {
        // Гроші зайшли один раз, посилка поїхала один раз. Другий такий лист —
        // завжди помилка, а не новина.
        expect(isDuplicateGuardedAction('paid')).toBe(true);
        expect(isDuplicateGuardedAction('shipped')).toBe(true);
    });

    it('«замовлення прийнято» свідомо поза правилом', () => {
        // За цією дією стоїть кнопка «Надіслати посилання клієнту», і менеджер
        // тисне її навмисно, коли клієнт каже, що листа не бачив. Захист
        // перетворив би робочу кнопку на кнопку, яка мовчки нічого не робить.
        expect(isDuplicateGuardedAction('placed')).toBe(false);
    });

    it('довільний лист і невідома дія теж поза правилом', () => {
        expect(isDuplicateGuardedAction('custom')).toBe(false);
        expect(isDuplicateGuardedAction('')).toBe(false);
        expect(isDuplicateGuardedAction('teleported')).toBe(false);
    });

    it('поріг — доба, і він константа, а не число в коді маршруту', () => {
        expect(DUPLICATE_WINDOW_HOURS).toBe(24);
    });

    it('вікно рахується назад від поточного моменту', () => {
        const now = new Date('2026-09-13T12:00:00.000Z');
        expect(duplicateWindowStart(now)).toBe('2026-09-12T12:00:00.000Z');
    });

    it('поріг можна звузити для окремої перевірки, не чіпаючи константу', () => {
        const now = new Date('2026-09-13T12:00:00.000Z');
        expect(duplicateWindowStart(now, 2)).toBe('2026-09-13T10:00:00.000Z');
    });
});

describe('контактна адреса в шаблонах листів', () => {
    const dirs = ['emails', 'components/email'];
    const files: string[] = [];
    for (const dir of dirs) {
        const full = path.resolve(process.cwd(), dir);
        for (const name of readdirSync(full)) {
            if (name.endsWith('.tsx')) files.push(path.join(dir, name));
        }
    }

    it('шаблони взагалі знайшлися — інакше тест нічого не перевіряє', () => {
        expect(files.length).toBeGreaterThan(10);
    });

    it.each(files)('%s не кличе писати на неіснуючу скриньку', (file) => {
        const source = readFileSync(path.resolve(process.cwd(), file), 'utf8');
        expect(source).not.toContain('hello@touchmemories');
    });

    /**
     * Шаблони, які досі КЛИЧУТЬ писати, мусять брати адресу з константи.
     *
     * Список коротший за початкові шість: у трьох маркетингових листах
     * запрошення прибрано зовсім, і причина не в адресі. Воно було написане як
     * інструкція з відписки («Якщо більше не хочете отримувати такі листи —
     * напишіть нам на …») і конкурувало з робочим посиланням, яке
     * withUnsubscribeFooter() і так додає в кожен маркетинговий лист разом із
     * заголовками List-Unsubscribe. Двох виходів бути не має, а той, що просив
     * написати листа, був гіршим навіть із живою адресою: він вимагав від
     * людини дії, на яку хтось мусить відповісти вручну.
     */
    it('шаблони, які кличуть писати, беруть адресу з константи', () => {
        const fixed = [
            'emails/OrderCancelledEmail.tsx',
            'emails/PaymentReminderEmail.tsx',
            'emails/ReviewRequestEmail.tsx',
        ];
        for (const file of fixed) {
            const source = readFileSync(path.resolve(process.cwd(), file), 'utf8');
            expect(source).toContain("from '@/lib/email/contact-address'");
            expect(source).toContain('SHOP_CONTACT_EMAIL');
        }
    });

    /**
     * У маркетингових листах відписка живе у футері, а не в тілі.
     *
     * Тест стежить саме за тим, щоб текстова інструкція не повернулася: її
     * легко дописати назад, бо вона виглядає турботливою.
     */
    it.each([
        'emails/AbandonedCartEmail.tsx',
        'emails/WelcomeSeriesEmail.tsx',
        'emails/WinBackEmail.tsx',
    ])('%s не просить писати листа замість посилання відписки', (file) => {
        const source = readFileSync(path.resolve(process.cwd(), file), 'utf8');
        expect(source).not.toContain('більше не хочете отримувати');
    });

    it('константа вказує на скриньку, яку справді читають', () => {
        expect(SHOP_CONTACT_EMAIL).toBe('touch.memories3@gmail.com');
    });
});
