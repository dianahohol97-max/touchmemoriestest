import { describe, expect, it } from 'vitest';
import { exportRowsFromPaths, projectIdFromExportPath } from '@/lib/print/register-export-files';

/**
 * Розпізнавання макета за шляхом друкованого файлу.
 *
 * На цій функції тримається прибирання файлів від'єднаних макетів, тобто
 * рішення «цей файл замовленню вже не належить, видаляємо». Помилка тут коштує
 * дорого в обидва боки: не впізнали — у картці дублюються всі сторінки й у
 * друк іде вдвічі більше аркушів; впізнали не те — видалили готовий макет.
 * Тому невпізнаний шлях має давати null, а не здогадку.
 */
describe('projectIdFromExportPath', () => {
    const project = '7d9ac4e4-99ea-42de-b887-187143a55d54';

    it('reads the project id out of a render path', () => {
        expect(projectIdFromExportPath(
            `drafts/a7e8756c-fa8b-4a1c-a200-444416693c6e/${project}/print/01.jpg`,
        )).toBe(project);
    });

    it('reads it for cover and endpaper files too', () => {
        expect(projectIdFromExportPath(`drafts/u/${project}/print/00_cover_front.jpg`)).toBe(project);
        expect(projectIdFromExportPath(`drafts/u/${project}/print/f2.jpg`)).toBe(project);
    });

    it('returns null when the segment before print is not an id', () => {
        expect(projectIdFromExportPath('orders/TM-001257/print/01.jpg')).toBeNull();
    });

    it('returns null for paths with no print folder at all', () => {
        expect(projectIdFromExportPath(`drafts/u/${project}/01.jpg`)).toBeNull();
        expect(projectIdFromExportPath('order-files/whatever.jpg')).toBeNull();
    });

    it('returns null for junk instead of guessing', () => {
        expect(projectIdFromExportPath('')).toBeNull();
        expect(projectIdFromExportPath('print/01.jpg')).toBeNull();
        expect(projectIdFromExportPath(undefined as any)).toBeNull();
    });
});

/**
 * Нумерація файлів експорту тревелбука.
 *
 * Друкарня отримує плоскі імена — cover.jpg, f1.jpg, 01.jpg… f2.jpg, — у яких
 * порядку немає взагалі. Номер проставляємо ми, і саме за ним картка
 * замовлення, ZIP і PDF шикують аркуші. Помилка тут означає книжку, зшиту не
 * в тому порядку.
 */
describe('exportRowsFromPaths — нумерація тревелбука', () => {
    const paths = (names: string[]) => names.map(n => `drafts/u/p/print/${n}`);
    const numbers = (names: string[]) => {
        const rows = exportRowsFromPaths('o1', 'travelbook', paths(names));
        return Object.fromEntries(rows.map(r => [r.file_name, r.page_number]));
    };

    it('numbers cover, front endpaper, pages and back endpaper in physical order', () => {
        const n = numbers(['cover.jpg', 'f1.jpg', '01.jpg', '02.jpg', '03.jpg', 'f2.jpg']);
        expect(n['cover.jpg']).toBe(1);
        expect(n['f1.jpg']).toBe(2);
        expect(n['01.jpg']).toBe(3);
        expect(n['03.jpg']).toBe(5);
        // Задній форзац — одразу після останньої сторінки, а не 999.
        expect(n['f2.jpg']).toBe(6);
    });

    /** Саме форма TM-001244: дванадцять сторінок плюс два форзаци. */
    it('gives the back endpaper a real number on a twelve-page book', () => {
        const names = ['cover.jpg', 'f1.jpg', ...Array.from({ length: 12 }, (_, i) => `${String(i + 1).padStart(2, '0')}.jpg`), 'f2.jpg'];
        const n = numbers(names);
        expect(n['12.jpg']).toBe(14);
        expect(n['f2.jpg']).toBe(15);
    });

    it('keeps the back endpaper last even so', () => {
        const names = ['cover.jpg', 'f1.jpg', '01.jpg', '02.jpg', 'f2.jpg'];
        const rows = exportRowsFromPaths('o1', 'travelbook', paths(names));
        const sorted = [...rows].sort((a, b) => (a.page_number ?? 0) - (b.page_number ?? 0));
        expect(sorted[sorted.length - 1].file_name).toBe('f2.jpg');
    });

    it('falls back to the sentinel when there are no numbered pages at all', () => {
        expect(numbers(['cover.jpg', 'f1.jpg', 'f2.jpg'])['f2.jpg']).toBe(999);
    });

    it('leaves photobook spread numbering untouched', () => {
        const n = numbers(['00_cover.jpg', '01_spread.jpg', '02_spread.jpg']);
        expect(n['00_cover.jpg']).toBe(1);
        expect(n['01_spread.jpg']).toBe(2);
        expect(n['02_spread.jpg']).toBe(3);
    });
});
