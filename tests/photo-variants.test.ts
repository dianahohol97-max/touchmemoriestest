import { describe, it, expect } from 'vitest';
import { displayPathFor, thumbPathFor, shouldDownscale, photoNeedsVariants, countPhotosNeedingVariants, DISPLAY_MAX_EDGE, THUMB_MAX_EDGE } from '@/lib/editor/photo-variant-paths';

/**
 * Шляхи зменшених копій мусять лежати поруч із оригіналом і НЕ збігатися з
 * ним. Збіг означав би, що збереження копії затирає оригінал, а оригінал це
 * єдине, з чого Railway збирає макет для друку.
 */
describe('photo-variants paths', () => {
    it('вставляє суфікс перед розширенням', () => {
        expect(displayPathFor('drafts/u/d/abc.jpg')).toBe('drafts/u/d/abc_display.jpg');
        expect(thumbPathFor('drafts/u/d/abc.jpg')).toBe('drafts/u/d/abc_thumb.jpg');
    });

    it('не плутає крапку в назві теки з розширенням', () => {
        expect(displayPathFor('guest/order.1/originals/abc')).toBe('guest/order.1/originals/abc_display.jpg');
    });

    it('ніколи не повертає шлях оригіналу', () => {
        const original = 'drafts/u/d/abc.jpg';
        expect(displayPathFor(original)).not.toBe(original);
        expect(thumbPathFor(original)).not.toBe(original);
        expect(displayPathFor(original)).not.toBe(thumbPathFor(original));
    });

    /**
     * Ідентифікатор фото сервер відновлює з імені файлу (resolve-photo-paths),
     * відрізаючи розширення. Копія не має права прикинутися оригіналом у тому
     * покажчику, інакше макет друкуватиметься з екранної копії.
     */
    it('копія не має того самого ідентифікатора, що й оригінал', () => {
        const idFromPath = (path: string) => (path.split('/').pop() || '').replace(/\.[a-z0-9]+$/i, '');
        expect(idFromPath(displayPathFor('drafts/u/d/abc.jpg'))).not.toBe('abc');
        expect(idFromPath(thumbPathFor('drafts/u/d/abc.jpg'))).not.toBe('abc');
    });
});

describe('shouldDownscale', () => {
    it('зменшує тільки те, що більше за межу', () => {
        expect(shouldDownscale(4032, DISPLAY_MAX_EDGE)).toBe(true);
        expect(shouldDownscale(1200, DISPLAY_MAX_EDGE)).toBe(false);
        expect(shouldDownscale(1200, THUMB_MAX_EDGE)).toBe(true);
    });

    it('безглузді числа не дають копії', () => {
        expect(shouldDownscale(0, DISPLAY_MAX_EDGE)).toBe(false);
        expect(shouldDownscale(Number.NaN, DISPLAY_MAX_EDGE)).toBe(false);
    });
});

/**
 * Черга серверної догонки. Помилка тут коштує або зайвої роботи функції на
 * тому, що вже зроблено, або мовчазного пропуску фото, яке так і лишиться
 * важким.
 */
describe('черга фото на зменшені копії', () => {
    it('бере фото зі шляхом і без копій', () => {
        expect(photoNeedsVariants({ path: 'drafts/u/d/a.jpg' })).toBe(true);
    });

    it('не бере фото, яке взагалі не доїхало у сховище', () => {
        expect(photoNeedsVariants({ name: 'a.jpg' })).toBe(false);
        expect(photoNeedsVariants({ path: '' })).toBe(false);
        expect(photoNeedsVariants(null)).toBe(false);
    });

    it('не бере фото, для якого копія вже є', () => {
        expect(photoNeedsVariants({ path: 'a.jpg', previewPath: 'a_display.jpg' })).toBe(false);
        expect(photoNeedsVariants({ path: 'a.jpg', thumbPath: 'a_thumb.jpg' })).toBe(false);
    });

    it('рахує лише ті, які справді чекають', () => {
        expect(countPhotosNeedingVariants([
            { path: 'a.jpg' },
            { path: 'b.jpg', previewPath: 'b_display.jpg', thumbPath: 'b_thumb.jpg' },
            { name: 'c.jpg' },
            { path: 'd.jpg' },
        ])).toBe(2);
        expect(countPhotosNeedingVariants(null)).toBe(0);
        expect(countPhotosNeedingVariants([])).toBe(0);
    });
});
