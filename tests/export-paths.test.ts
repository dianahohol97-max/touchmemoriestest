import { describe, expect, it } from 'vitest';
import { projectIdFromExportPath } from '@/lib/print/register-export-files';

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
