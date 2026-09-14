import { describe, it, expect } from 'vitest';
import {
    buildCoverColorIndex,
    coverColorRequirement,
    coverTypeFromSlug,
    matchCoverColor,
    readCoverSelection,
} from '@/lib/cover-colors';

/**
 * Колір обкладинки має доїхати до майстерні.
 *
 * TM-001296: фотокнига зі шкірзамінника, у позиції немає жодного ключа з
 * кольором, і картка замовлення про це мовчала. Причин було дві. Перша — на
 * картці товару перший зразок підсвічувався сам, тож клієнтка бачила обраний
 * колір і не клікала по ньому, а в замовлення не потрапляло нічого. Друга —
 * навіть коли колір обирали, адмінка шукала його лише під ключем «Колір
 * обкладинки», а картка товару пише «Колір шкірзамінника».
 */
describe('coverTypeFromSlug', () => {
    it('впізнає матеріал в артикулі товару', () => {
        expect(coverTypeFromSlug('photobook-leatherette')).toBe('Шкірзамінник');
        expect(coverTypeFromSlug('photobook-velour')).toBe('Велюр');
        expect(coverTypeFromSlug('photobook-fabric')).toBe('Тканина');
    });

    it('впізнає матеріал у назві опції', () => {
        expect(coverTypeFromSlug('Велюр')).toBe('Велюр');
        expect(coverTypeFromSlug('Шкірзамінник')).toBe('Шкірзамінник');
    });

    it('друковані та випускні обкладинки кольору не мають', () => {
        expect(coverTypeFromSlug('photobook-printed')).toBe('');
        expect(coverTypeFromSlug('photobook-graduation')).toBe('');
        expect(coverTypeFromSlug('Друкована тверда')).toBe('');
        expect(coverTypeFromSlug('')).toBe('');
    });
});

describe('coverColorRequirement', () => {
    it('фотокнига зі шкірзамінника мусить нести колір', () => {
        expect(coverColorRequirement('photobook-leatherette')).toEqual({
            key: 'Колір шкірзамінника',
            coverType: 'Шкірзамінник',
        });
    });

    it('обраний матеріал важить більше за артикул', () => {
        // Книга побажань: матеріал обирають опцією, артикул про нього мовчить.
        expect(coverColorRequirement('guestbook-wedding', { 'Матеріал обкладинки': 'Велюр' })?.key)
            .toBe('Колір велюру');
        expect(coverColorRequirement('photobook-velour', { 'Матеріал обкладинки': 'Друкована тверда' }))
            .toBeNull();
    });

    it('там, де кольору немає, вимоги теж немає', () => {
        expect(coverColorRequirement('photobook-printed')).toBeNull();
        expect(coverColorRequirement('photomagnets')).toBeNull();
    });
});

describe('readCoverSelection', () => {
    it('читає колір, названий матеріалом, і сам виводить тип обкладинки', () => {
        const sel = readCoverSelection({ 'Колір шкірзамінника': 'Темно-зелений (Ш-21)' });
        expect(sel.colorName).toBe('Темно-зелений (Ш-21)');
        expect(sel.coverType).toBe('Шкірзамінник');
    });

    it('явний матеріал у позиції перемагає здогадку з ключа', () => {
        const sel = readCoverSelection({
            'Колір велюру': 'Молочний (В-01)',
            'Матеріал обкладинки': 'Велюр (файликові альбоми) 200',
        });
        expect(sel.coverType).toBe('Велюр (файликові альбоми) 200');
    });

    it('колір сторінок і колір напису обкладинки не стосуються', () => {
        const sel = readCoverSelection({ 'Колір сторінок': 'Чорні', 'Колір напису': 'Золото' });
        expect(sel.colorName).toBe('');
        expect(sel.coverType).toBe('');
    });

    it('артикул для майстерні тепер резолвиться і для ключа з матеріалом', () => {
        const index = buildCoverColorIndex([
            { code: 'Ш-21', name: 'Темно-зелений', hex_approx: '#2f4f3a', cover_type: { name: 'Шкірзамінник' } },
            { code: 'В-13', name: 'Темно-зелений', hex_approx: '#3f5e50', cover_type: { name: 'Велюр' } },
        ]);
        const sel = readCoverSelection({ 'Колір шкірзамінника': 'Темно-зелений' });
        expect(matchCoverColor(index, sel.coverType, sel.colorName)?.code).toBe('Ш-21');
    });
});
