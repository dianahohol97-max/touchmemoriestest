import { describe, it, expect } from 'vitest';
import { formatWeddingDate } from '@/lib/wedding/format';

describe('formatWeddingDate', () => {
    it('дата весілля пари з пайлота', () => {
        expect(formatWeddingDate('2026-10-10')).toBe('10 жовтня 2026');
    });

    it('день без провідного нуля', () => {
        // «01 січня» виглядало б як машинний рядок, а не як підпис під фото.
        expect(formatWeddingDate('2026-01-01')).toBe('1 січня 2026');
    });

    it('усі місяці стоять у родовому відмінку і на своїх місцях', () => {
        expect(formatWeddingDate('2026-02-14')).toBe('14 лютого 2026');
        expect(formatWeddingDate('2026-07-07')).toBe('7 липня 2026');
        expect(formatWeddingDate('2026-12-31')).toBe('31 грудня 2026');
    });

    it('дата не зсувається на день назад у західних поясах', () => {
        // Саме заради цього рядок розбирається вручну, а не через new Date():
        // конструктор прочитав би «2026-10-10» як північ за UTC, і в гостя з
        // від'ємним зсувом весілля показалося б дев'ятим жовтня.
        const previousTz = process.env.TZ;
        try {
            process.env.TZ = 'America/Los_Angeles';
            expect(formatWeddingDate('2026-10-10')).toBe('10 жовтня 2026');
        } finally {
            process.env.TZ = previousTz;
        }
    });

    it('сміття повертається як є, а не падає', () => {
        expect(formatWeddingDate('')).toBe('');
        expect(formatWeddingDate('коли-небудь')).toBe('коли-небудь');
        // Тринадцятого місяця не буває, і вигадувати для нього назву не можна.
        expect(formatWeddingDate('2026-13-01')).toBe('2026-13-01');
    });
});
