import { describe, expect, it } from 'vitest';
import {
    INLINE_BUDGET_BYTES,
    MAX_ATTACHMENT_BYTES,
    STORAGE_CEILING_BYTES,
    formatBytes,
    rejectAttachment,
} from '@/lib/email/attachment-limits';

/**
 * Три межі листа стоять одна за одною, і плутати їх дорого.
 *
 * 17.09.2026 Діана дочекалася кінця завантаження PDF на 128,9 МБ, щоб побачити
 * англійське «The object exceeded the maximum allowed size» (TM-001309).
 * Перевірки в браузері не було зовсім, хоча межа була відома заздалегідь.
 */

const MB = 1024 * 1024;
const file = (name: string, mb: number) => ({ name, size: Math.round(mb * MB) });

describe('відмова до завантаження', () => {
    it('той самий макет на 128,9 МБ відсівається одразу', () => {
        const why = rejectAttachment(file('TM-001309_макет (1).pdf', 128.9));
        expect(why).toContain('TM-001309_макет (1).pdf');
        expect(why).toContain('128,9 МБ');
        expect(why).toContain('25,0 МБ');
    });

    it('попередній випадок — макет 14244 на 65 МБ — теж', () => {
        expect(rejectAttachment(file('14244 (1).pdf', 65))).not.toBeNull();
    });

    it('повідомлення каже, ЩО РОБИТИ, а не лише що не можна', () => {
        const why = rejectAttachment(file('x.pdf', 100))!;
        expect(why).toMatch(/150 dpi/);
        expect(why).toMatch(/З файлів замовлення/);
    });

    it('звичайний макет проходить', () => {
        for (const mb of [0.5, 6, 12, 24.9]) {
            expect(rejectAttachment(file('ok.pdf', mb))).toBeNull();
        }
    });

    it('рівно на межі — ще можна', () => {
        expect(rejectAttachment({ name: 'edge.pdf', size: MAX_ATTACHMENT_BYTES })).toBeNull();
        expect(rejectAttachment({ name: 'edge.pdf', size: MAX_ATTACHMENT_BYTES + 1 })).not.toBeNull();
    });

    it('зіпсований розмір не вигадує відмови', () => {
        expect(rejectAttachment({ name: 'x.pdf', size: NaN })).toBeNull();
        expect(rejectAttachment({ name: 'x.pdf', size: 0 })).toBeNull();
    });
});

describe('межі не переплутані між собою', () => {
    it('вкладення в лист найменше, наше правило посередині, стеля сховища найбільша', () => {
        expect(INLINE_BUDGET_BYTES).toBeLessThan(MAX_ATTACHMENT_BYTES);
        expect(MAX_ATTACHMENT_BYTES).toBeLessThan(STORAGE_CEILING_BYTES);
    });

    it('стеля сховища лежить між найбільшим, що доїхав, і найменшим, що впав', () => {
        // Живі числа: найбільший обʼєкт за всю історію проєкту — 44,5 МБ;
        // макет на 65 МБ відмовили. 150 МБ у налаштуваннях бакета — це не межа.
        expect(STORAGE_CEILING_BYTES).toBeGreaterThan(44.5 * MB);
        expect(STORAGE_CEILING_BYTES).toBeLessThan(65 * MB);
    });
});

describe('formatBytes', () => {
    it('мегабайти з комою, як заведено в українському тексті', () => {
        expect(formatBytes(128.9 * MB)).toBe('128,9 МБ');
        expect(formatBytes(25 * MB)).toBe('25,0 МБ');
    });

    it('дрібне показується кілобайтами, а не нулем', () => {
        expect(formatBytes(400 * 1024)).toBe('400 КБ');
        expect(formatBytes(10)).toBe('1 КБ');
    });
});
