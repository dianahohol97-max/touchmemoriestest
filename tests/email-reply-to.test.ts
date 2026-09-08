import { afterEach, describe, expect, it } from 'vitest';
import { getReplyTo } from '@/lib/email/brevo';

/**
 * Скринька для відповідей.
 *
 * Листи сайту йдуть з hello@touchmemories.com.ua, а такої скриньки не існує:
 * домен у Brevo підтверджений, тож відправка працює і зовні все виглядає
 * справним, але кожен клієнт, який натиснув «Відповісти», писав у порожнечу.
 *
 * Тому головне тут — поведінка за замовчуванням. Поки адресу не задано,
 * заголовка не має бути ВЗАГАЛІ: обрати навмання чужу скриньку означало б
 * тихо надіслати туди листування з клієнтами.
 */
const KEYS = ['BREVO_REPLY_TO', 'BREVO_REPLY_TO_NAME', 'BREVO_FROM_NAME'] as const;
const saved: Record<string, string | undefined> = {};
for (const k of KEYS) saved[k] = process.env[k];

afterEach(() => {
    for (const k of KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k]!;
    }
});

describe('getReplyTo', () => {
    /**
     * Без налаштування відповіді йдуть на реальну скриньку магазину — ту, що
     * стоїть на сторінці контактів і приймає всі форми сайту. Порожня змінна
     * означає «як за замовчуванням», а не «нікуди».
     */
    it('falls back to the shop mailbox that actually exists', () => {
        delete process.env.BREVO_REPLY_TO;
        expect(getReplyTo()?.email).toBe('touch.memories3@gmail.com');
    });

    it('treats a blank value as not configured, not as no reply address', () => {
        process.env.BREVO_REPLY_TO = '   ';
        expect(getReplyTo()?.email).toBe('touch.memories3@gmail.com');
    });

    /** Друкарська помилка в налаштуваннях не має ставати заголовком листа. */
    it('refuses a value that is not an address', () => {
        process.env.BREVO_REPLY_TO = 'пошта магазину';
        expect(getReplyTo()).toBeNull();
    });

    it('returns the configured mailbox', () => {
        process.env.BREVO_REPLY_TO = 'orders@example.com';
        delete process.env.BREVO_REPLY_TO_NAME;
        delete process.env.BREVO_FROM_NAME;
        expect(getReplyTo()).toEqual({ email: 'orders@example.com' });
    });

    it('adds the display name when there is one', () => {
        process.env.BREVO_REPLY_TO = 'orders@example.com';
        process.env.BREVO_REPLY_TO_NAME = 'touch.memories';
        expect(getReplyTo()).toEqual({ email: 'orders@example.com', name: 'touch.memories' });
    });

    it('trims stray spaces around the address', () => {
        process.env.BREVO_REPLY_TO = '  orders@example.com  ';
        delete process.env.BREVO_REPLY_TO_NAME;
        delete process.env.BREVO_FROM_NAME;
        expect(getReplyTo()?.email).toBe('orders@example.com');
    });
});
