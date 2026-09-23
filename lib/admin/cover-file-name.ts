import { transliterateUk } from '@/lib/shipping/transliterate';

/**
 * Осмислена назва файлу для скачаної обкладинки.
 *
 * Сто обкладинок, які вже лежать у сховищі, названі людяно — `lviv.png`,
 * `country_argentina.png`, — і саме такі назви треба зберегти: за ними видно,
 * що де, і з ними файл можна покласти назад у сховище без перейменування.
 *
 * А от НОВІ завантаження людяної назви не мають і мати не можуть. Шлях у
 * сховищі видає /api/admin/signed-upload, і він навмисно генерує його сам —
 * `1790178527889-k3f9a1.png`, — щоб два однойменні файли не затирали один
 * одного. Назва, яку обрала людина на своєму комп'ютері, туди не доходить
 * узагалі. Тому для таких файлів назва збирається з того, що ми про обкладинку
 * знаємо: тип і англійська назва, а коли її немає — транслітерована українська.
 *
 * Однакові назви в архіві неприпустимі: zip мовчки лишає один файл із двох.
 * У каталозі вже є два «Бухарест» і два «Нью-Йорк», тож повтори нумеруються.
 */

export interface NamedCover {
    name: string;
    name_en?: string | null;
    kind: 'city' | 'country' | string;
    image_url: string;
}

/** Шлях у сховищі, виданий signed-upload: мітка часу, дефіс, випадковий хвіст. */
const GENERATED_PATH = /^\d{10,}-[a-z0-9]+\.[a-z0-9]+$/i;

const slug = (s: string) =>
    transliterateUk(s)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

export function coverFileName(cover: NamedCover): string {
    const base = (cover.image_url || '').split('/').pop() || '';
    const ext = (base.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';

    if (base && !GENERATED_PATH.test(base)) return base;

    const label = slug(String(cover.name_en || cover.name || '')) || 'cover';
    const prefix = cover.kind === 'country' ? 'country_' : '';
    return `${prefix}${label}.${ext}`;
}

/** Ті самі назви для цілого набору, з нумерацією повторів. */
export function coverFileNames(covers: NamedCover[]): string[] {
    const used = new Map<string, number>();
    return covers.map(c => {
        const wanted = coverFileName(c);
        const seen = used.get(wanted.toLowerCase()) || 0;
        used.set(wanted.toLowerCase(), seen + 1);
        if (seen === 0) return wanted;
        const dot = wanted.lastIndexOf('.');
        return dot > 0
            ? `${wanted.slice(0, dot)}_${seen + 1}${wanted.slice(dot)}`
            : `${wanted}_${seen + 1}`;
    });
}
