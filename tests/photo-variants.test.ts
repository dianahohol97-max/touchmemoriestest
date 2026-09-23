import { describe, it, expect } from 'vitest';
import { displayPathFor, thumbPathFor, shouldDownscale, photoNeedsVariants, countPhotosNeedingVariants, missingVariantsOf, variantTriesOf, variantRetryExhausted, DISPLAY_MAX_EDGE, THUMB_MAX_EDGE } from '@/lib/editor/photo-variant-paths';

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

    it('не бере фото, для якого є ОБИДВІ копії', () => {
        expect(photoNeedsVariants({ path: 'a.jpg', previewPath: 'a_display.jpg', thumbPath: 'a_thumb.jpg' })).toBe(false);
    });

    /**
     * Раніше тут стояло протилежне: наявність БУДЬ-ЯКОЇ копії знімала фото з
     * черги назавжди. Через це 201 фото у сімнадцяти макетах зависло зі
     * стрічковою копією і без копії на полотно — маршрут їх не брав, бо
     * формально щось уже було, і догнати їх не міг ніхто.
     */
    it('бере фото, у якого є лише одна з двох копій', () => {
        expect(photoNeedsVariants({ path: 'a.jpg', thumbPath: 'a_thumb.jpg' })).toBe(true);
        expect(photoNeedsVariants({ path: 'a.jpg', previewPath: 'a_display.jpg' })).toBe(true);
    });

    it('каже саме те, чого бракує', () => {
        expect(missingVariantsOf({ path: 'a.jpg', thumbPath: 'a_thumb.jpg' })).toEqual(['previewPath']);
        expect(missingVariantsOf({ path: 'a.jpg', previewPath: 'a_display.jpg' })).toEqual(['thumbPath']);
        expect(missingVariantsOf({ path: 'a.jpg' })).toEqual(['previewPath', 'thumbPath']);
        expect(missingVariantsOf({ path: 'a.jpg', previewPath: 'x', thumbPath: 'y' })).toEqual([]);
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

/**
 * Межа на повтори. Без неї фото, для якого копія не робиться в принципі,
 * лишалося б у черзі вічно, і кабінет на КОЖНОМУ відкритті писав би «Готуємо
 * N фото до швидкого відкриття» — тобто рівно те очікування, заради усунення
 * якого копії й зʼявилися, тільки тепер назавжди.
 */
describe('межа на повторні спроби', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const now = Date.parse('2026-09-23T12:00:00.000Z');

    it('свіжа невдала спроба не повторюється того ж дня', () => {
        const p = { path: 'a.jpg', variantTries: 1, variantTriedAt: new Date(now - 60_000).toISOString() };
        expect(photoNeedsVariants(p, now)).toBe(false);
    });

    it('через добу пробуємо знову', () => {
        const p = { path: 'a.jpg', variantTries: 1, variantTriedAt: new Date(now - DAY - 1000).toISOString() };
        expect(photoNeedsVariants(p, now)).toBe(true);
    });

    it('після третьої спроби здаємося назавжди', () => {
        const p = { path: 'a.jpg', variantTries: 3, variantTriedAt: new Date(now - 30 * DAY).toISOString() };
        expect(photoNeedsVariants(p, now)).toBe(false);
        expect(variantRetryExhausted(p, now)).toBe(true);
    });

    it('позначка з майбутнього не замикає фото назавжди', () => {
        // Зіпсовані дані або розбіжність годинників не мають права стати
        // вічною відмовою: це причина спробувати, а не мовчати.
        const p = { path: 'a.jpg', variantTries: 1, variantTriedAt: new Date(now + 10 * DAY).toISOString() };
        expect(photoNeedsVariants(p, now)).toBe(true);
    });

    it('сміття в полях не рахується за спробу', () => {
        expect(variantTriesOf({ variantTries: -5 })).toBe(0);
        expect(variantTriesOf({ variantTries: Number.NaN })).toBe(0);
        expect(variantTriesOf({ variantTries: 'три' as unknown as number })).toBe(0);
        expect(photoNeedsVariants({ path: 'a.jpg', variantTriedAt: 'позавчора' }, now)).toBe(true);
    });

    it('фото з обома копіями не чекає жодної доби', () => {
        const p = { path: 'a.jpg', previewPath: 'x', thumbPath: 'y', variantTries: 1, variantTriedAt: new Date(now).toISOString() };
        expect(photoNeedsVariants(p, now)).toBe(false);
    });

    it('кабінет не рахує фото, які в паузі', () => {
        const photos = [
            { path: 'a.jpg' },
            { path: 'b.jpg', variantTries: 1, variantTriedAt: new Date(now - 60_000).toISOString() },
            { path: 'c.jpg', variantTries: 3 },
        ];
        expect(countPhotosNeedingVariants(photos, now)).toBe(1);
    });
});
