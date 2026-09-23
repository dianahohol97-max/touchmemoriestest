import { describe, expect, it } from 'vitest';
import { coverFileName, coverFileNames, type NamedCover } from '@/lib/admin/cover-file-name';

const cover = (over: Partial<NamedCover>): NamedCover => ({
    name: 'Львів', name_en: 'Lviv', kind: 'city',
    image_url: 'https://x.supabase.co/storage/v1/object/public/travel-covers/lviv.png',
    ...over,
});

describe('coverFileName', () => {
    it('людяну назву зі сховища лишає як є', () => {
        expect(coverFileName(cover({}))).toBe('lviv.png');
        expect(coverFileName(cover({
            name: 'Аргентина', name_en: 'Argentina', kind: 'country',
            image_url: 'https://x/travel-covers/country_argentina.png',
        }))).toBe('country_argentina.png');
    });

    it('шлях, згенерований signed-upload, замінює на осмислений', () => {
        expect(coverFileName(cover({
            image_url: 'https://x/travel-covers/1790178527889-k3f9a1.png',
        }))).toBe('lviv.png');
        expect(coverFileName(cover({
            name: 'Перу', name_en: 'Peru', kind: 'country',
            image_url: 'https://x/travel-covers/1790178527889-k3f9a1.webp',
        }))).toBe('country_peru.webp');
    });

    it('без англійської назви бере транслітеровану українську', () => {
        expect(coverFileName(cover({
            name: 'Чернівці', name_en: null,
            image_url: 'https://x/travel-covers/1790178527889-aa11bb.png',
        }))).toBe('chernivtsi.png');
    });
});

describe('coverFileNames', () => {
    it('нумерує повтори, бо однойменні файли в архіві затирають один одного', () => {
        const list = [
            cover({ name: 'Бухарест', name_en: 'Bucharest', image_url: 'https://x/t/1790178527889-a1.png' }),
            cover({ name: 'Бухарест', name_en: 'Bucharest', image_url: 'https://x/t/1790178527890-b2.png' }),
            cover({ name: 'Бухарест', name_en: 'Bucharest', image_url: 'https://x/t/1790178527891-c3.png' }),
        ];
        expect(coverFileNames(list)).toEqual(['bucharest.png', 'bucharest_2.png', 'bucharest_3.png']);
    });

    it('різні людяні назви зі сховища лишаються недоторканими', () => {
        const list = [
            cover({ image_url: 'https://x/t/bucharest.png' }),
            cover({ image_url: 'https://x/t/bucharest_2.png' }),
        ];
        expect(coverFileNames(list)).toEqual(['bucharest.png', 'bucharest_2.png']);
    });
});
