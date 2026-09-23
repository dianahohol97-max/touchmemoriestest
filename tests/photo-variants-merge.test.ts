import { describe, it, expect } from 'vitest';

/**
 * Злиття шляхів копій у ПОТОЧНУ версію рядка.
 *
 * ЧОМУ ЦЕ ВАЖЛИВІШЕ ЗА САМІ КОПІЇ. Маршрут ріже копії до чотирьох хвилин
 * (`deadline` 240 с при `maxDuration` 300). Раніше він записував назад той
 * масив `uploaded_photos`, який прочитав НА ПОЧАТКУ, тож усе, що людина
 * встигала зберегти за ці чотири хвилини, зникало — додала фото в
 * конструкторі, а воно щезло, бо поверх ліг застарілий знімок. Копія, якої
 * немає, коштує секунд очікування. Фото, якого немає, коштує замовлення.
 *
 * Тест тримає саме логіку злиття. Вона живе в маршруті (`storeVariantPaths`),
 * а маршрут тягне за собою Next і клієнт Supabase, тож тут відтворено ту саму
 * функцію злиття в чистому вигляді: перевіряємо правила, а не проводку.
 */

type Photo = { id?: string; path?: string; previewPath?: string; thumbPath?: string; [k: string]: unknown };

/** Те саме правило, що в storeVariantPaths: дописати тільки бракуюче, за id і за path. */
function mergeVariantPaths(current: Photo[], made: Photo[]): { merged: Photo[]; changed: number } {
    const byId = new Map<string, Photo>();
    for (const p of made) {
        if (!p?.id || (!p.previewPath && !p.thumbPath)) continue;
        byId.set(String(p.id), p);
    }
    let changed = 0;
    const merged = current.map(p => {
        const add = p && p.id ? byId.get(String(p.id)) : undefined;
        if (!add) return p;
        if (add.path && p.path && String(p.path) !== String(add.path)) return p;
        const patch: Record<string, string> = {};
        if (add.previewPath && !p.previewPath) patch.previewPath = add.previewPath;
        if (add.thumbPath && !p.thumbPath) patch.thumbPath = add.thumbPath;
        if (Object.keys(patch).length === 0) return p;
        changed++;
        return { ...p, ...patch };
    });
    return { merged, changed };
}

const photo = (id: string, extra: Partial<Photo> = {}): Photo => ({ id, path: `drafts/u/d/${id}.jpg`, ...extra });

describe('злиття шляхів копій', () => {
    it('фото, додані під час нарізки, не зникають', () => {
        // Маршрут прочитав два фото і чотири хвилини різав копії.
        const made = [
            photo('a', { previewPath: 'drafts/u/d/a_display.jpg', thumbPath: 'drafts/u/d/a_thumb.jpg' }),
            photo('b', { previewPath: 'drafts/u/d/b_display.jpg', thumbPath: 'drafts/u/d/b_thumb.jpg' }),
        ];
        // Людина тим часом додала ще три.
        const current = [photo('a'), photo('b'), photo('c'), photo('d'), photo('e')];

        const { merged, changed } = mergeVariantPaths(current, made);

        expect(merged).toHaveLength(5);
        expect(merged.map(p => p.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
        expect(changed).toBe(2);
        expect(merged[0].previewPath).toBe('drafts/u/d/a_display.jpg');
        // Нові фото лишаються без копій — їх догонять наступного разу.
        expect(merged[4].previewPath).toBeUndefined();
    });

    it('фото, видалені під час нарізки, не воскресають', () => {
        const made = [
            photo('a', { previewPath: 'drafts/u/d/a_display.jpg' }),
            photo('b', { previewPath: 'drafts/u/d/b_display.jpg' }),
        ];
        const current = [photo('b')]; // «a» людина видалила

        const { merged } = mergeVariantPaths(current, made);

        expect(merged.map(p => p.id)).toEqual(['b']);
    });

    it('не чіпає оригінал у path', () => {
        const made = [photo('a', { previewPath: 'drafts/u/d/a_display.jpg', thumbPath: 'drafts/u/d/a_thumb.jpg' })];
        const current = [photo('a')];

        const { merged } = mergeVariantPaths(current, made);

        expect(merged[0].path).toBe('drafts/u/d/a.jpg');
    });

    it('не перебиває копію, яку людина зберегла сама', () => {
        const made = [photo('a', { previewPath: 'серверна', thumbPath: 'серверна-стрічка' })];
        const current = [photo('a', { previewPath: 'своя' })];

        const { merged, changed } = mergeVariantPaths(current, made);

        expect(merged[0].previewPath).toBe('своя');
        expect(merged[0].thumbPath).toBe('серверна-стрічка');
        expect(changed).toBe(1);
    });

    it('перезавантажене фото копій не отримує', () => {
        // Той самий id, але оригінал уже за іншим шляхом: наші копії стосуються
        // старого файлу, і підставити їх означало б показати не той знімок.
        const made = [{ id: 'a', path: 'drafts/u/d/a.jpg', previewPath: 'drafts/u/d/a_display.jpg' }];
        const current = [{ id: 'a', path: 'guest/order-9/originals/a.jpg' }];

        const { merged, changed } = mergeVariantPaths(current, made);

        expect(merged[0].previewPath).toBeUndefined();
        expect(changed).toBe(0);
    });

    it('коли все вже на місці, запису не потрібно', () => {
        const made = [photo('a', { previewPath: 'x', thumbPath: 'y' })];
        const current = [photo('a', { previewPath: 'x', thumbPath: 'y' })];

        expect(mergeVariantPaths(current, made).changed).toBe(0);
    });

    it('фото без id не зливається наосліп', () => {
        // Без ідентифікатора зіставити нема за чим. Відмова краща за запис не
        // тому фото — та сама асиметрія, що в гочі 18.
        const made = [{ path: 'drafts/u/d/a.jpg', previewPath: 'drafts/u/d/a_display.jpg' }];
        const current = [{ path: 'drafts/u/d/a.jpg' }];

        expect(mergeVariantPaths(current, made).changed).toBe(0);
    });
});
