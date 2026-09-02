import { describe, expect, it } from 'vitest';
import { normalizeHex, projectPalette } from '@/lib/editor/project-palette';

/**
 * Палітра макета для панелі тексту.
 *
 * Панель роками показувала вісім кольорів, не повʼязаних з обраним шаблоном,
 * тож найпростіший рух клієнта — «додати підпис» — ламав єдність журналу.
 * Тести пиняють дві властивості, на яких тримається користь від нової стрічки:
 * порядок джерел (перед очима клієнта поточний розворот, а не сорок сторінок
 * далі) і те, що кольору фону поточної сторінки серед свотчів не буде, бо
 * підпис таким кольором просто зникає.
 */
describe('normalizeHex', () => {
    it('accepts long, short and alpha hex, always lowercase #rrggbb', () => {
        expect(normalizeHex('#FFAA00')).toBe('#ffaa00');
        expect(normalizeHex('  #Fa0 ')).toBe('#ffaa00');
        expect(normalizeHex('#12345678')).toBe('#123456');
    });

    it('rejects anything that cannot be painted on a swatch', () => {
        expect(normalizeHex('')).toBeNull();
        expect(normalizeHex('red')).toBeNull();
        expect(normalizeHex('linear-gradient(#fff, #000)')).toBeNull();
        expect(normalizeHex(undefined)).toBeNull();
        expect(normalizeHex(123)).toBeNull();
    });
});

describe('projectPalette', () => {
    it('puts the current spread first, then the cover, then the rest of the book', () => {
        expect(projectPalette({
            pageTexts: [{ color: '#c02030' }],
            coverBgColor: '#101820',
            coverTexts: [{ color: '#d4af37' }],
            otherTexts: [{ color: '#556677' }],
        })).toEqual(['#c02030', '#101820', '#d4af37', '#556677']);
    });

    it('never offers the current page background — that text would be invisible', () => {
        expect(projectPalette({
            pageBgColor: '#FFF8F0',
            pageTexts: [{ color: '#fff8f0' }, { color: '#333333' }],
        })).toEqual(['#333333']);
    });

    it('drops colours the fixed swatches already carry, and duplicates', () => {
        expect(projectPalette({
            pageTexts: [{ color: '#000000' }, { color: '#C09080' }, { color: '#c09080' }],
            exclude: ['#1e2d7d', '#000000'],
        })).toEqual(['#c09080']);
    });

    it('caps the row so it stays one line', () => {
        const many = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777']
            .map(color => ({ color }));
        expect(projectPalette({ pageTexts: many })).toHaveLength(6);
        expect(projectPalette({ pageTexts: many, max: 3 })).toEqual(['#111111', '#222222', '#333333']);
    });

    it('returns nothing for an empty project instead of throwing', () => {
        expect(projectPalette({})).toEqual([]);
    });
});
