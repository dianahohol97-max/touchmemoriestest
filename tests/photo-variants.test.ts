import { describe, it, expect } from 'vitest';
import { displayPathFor, thumbPathFor, shouldDownscale, DISPLAY_MAX_EDGE, THUMB_MAX_EDGE } from '@/lib/editor/photo-variants';

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
