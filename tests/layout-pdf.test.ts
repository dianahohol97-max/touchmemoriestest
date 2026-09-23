import { describe, expect, it } from 'vitest';
import {
    buildPdfSheets,
    isSoftCoverMagazineSet,
    pageSizeMm,
    sortPagesForPdf,
    type PdfPageFile,
    type PdfSheet,
} from '@/lib/export/layout-pdf';

/**
 * Збірка макета в один PDF.
 *
 * Помилка тут не косметична: друкарня бере файл і друкує його як є. Сторінка
 * не на своєму місці означає брошуру не в тому порядку, а неправильний розмір
 * сторінки — білі поля навколо макета або обрізаний край.
 */
describe('pageSizeMm', () => {
    it('turns 300 DPI pixels into the millimetres that were ordered', () => {
        // A4 при 300 DPI — 2480×3508 px.
        const p = pageSizeMm(2480, 3508);
        expect(p.w).toBeCloseTo(210, 0);
        expect(p.h).toBeCloseTo(297, 0);
        expect(p.orientation).toBe('portrait');
    });

    it('calls a spread landscape, because jsPDF swaps the sides otherwise', () => {
        // Розворот A4 — удвічі ширший.
        const p = pageSizeMm(4961, 3508);
        expect(p.w).toBeGreaterThan(p.h);
        expect(p.orientation).toBe('landscape');
    });

    it('treats a square page as portrait rather than leaving it undecided', () => {
        expect(pageSizeMm(2953, 2953).orientation).toBe('portrait');
    });

    it('does not produce a zero-sized page from broken dimensions', () => {
        const p = pageSizeMm(0, -5);
        expect(p.w).toBeGreaterThan(0);
        expect(p.h).toBeGreaterThan(0);
    });
});

describe('sortPagesForPdf', () => {
    it('puts the cover first, then the pages in order', () => {
        const out = sortPagesForPdf([
            { name: '02_spread.jpg', page_number: 3 },
            { name: '00_cover.jpg', page_number: 1, isCover: true },
            { name: '01_spread.jpg', page_number: 2 },
        ]);
        expect(out.map(f => f.name)).toEqual(['00_cover.jpg', '01_spread.jpg', '02_spread.jpg']);
    });

    /** Саме тут ламається звичайне сортування рядків. */
    it('sorts unnumbered pages naturally, so 10 comes after 9', () => {
        const out = sortPagesForPdf([
            { name: '10.jpg' }, { name: '9.jpg' }, { name: '1.jpg' }, { name: '2.jpg' },
        ]);
        expect(out.map(f => f.name)).toEqual(['1.jpg', '2.jpg', '9.jpg', '10.jpg']);
    });

    it('keeps numbered pages ahead of ones with no number at all', () => {
        const out = sortPagesForPdf([
            { name: 'zzz.jpg' },
            { name: '05.jpg', page_number: 5 },
        ]);
        expect(out.map(f => f.name)).toEqual(['05.jpg', 'zzz.jpg']);
    });

    it('leaves the caller array untouched', () => {
        const input = [{ name: 'b.jpg' }, { name: 'a.jpg' }];
        sortPagesForPdf(input);
        expect(input.map(f => f.name)).toEqual(['b.jpg', 'a.jpg']);
    });

    it('survives an empty list', () => {
        expect(sortPagesForPdf([])).toEqual([]);
    });
});

/**
 * ПОРЯДОК АРКУШІВ ЖУРНАЛУ З М'ЯКОЮ ОБКЛАДИНКОЮ.
 *
 * Специфікація друкарні: передня обкладинка → форзац 1 → сторінки 01…NN →
 * форзац 2 → задня обкладинка, один PDF на весь журнал. Помилка тут коштує
 * тиражу: аркуш не на своєму місці — це брошура не в тому порядку, а пропущене
 * місце форзаца зсуває всі сторінки на одну.
 *
 * Живі дані, на яких це загорілося, — TM-001352: у теці 00_cover_back,
 * 00_cover_front, 01…08 і f2, форзац f1 порожній і файлу не має.
 */
const TM001352 = [
    { name: '00_cover_back.jpg', page_number: 1, isCover: true },
    { name: '00_cover_front.jpg', page_number: 1, isCover: true },
    { name: '01.jpg', page_number: 3 },
    { name: '02.jpg', page_number: 4 },
    { name: '03.jpg', page_number: 5 },
    { name: '04.jpg', page_number: 6 },
    { name: '05.jpg', page_number: 7 },
    { name: '06.jpg', page_number: 8 },
    { name: '07.jpg', page_number: 9 },
    { name: '08.jpg', page_number: 10 },
    { name: 'f2.jpg', page_number: 11 },
];

/** Коротке читання аркуша: ім'я файлу або «(білий f1)». */
const readSheets = (sheets: PdfSheet<PdfPageFile>[]) =>
    sheets.map(s => (s.kind === 'file' ? String(s.file.name) : `(білий ${s.label})`));

describe('isSoftCoverMagazineSet', () => {
    it('recognises the soft cover by its two halves', () => {
        expect(isSoftCoverMagazineSet(TM001352)).toBe(true);
    });

    /** Тверда обкладинка — один аркуш-розворот, різати його не можна. */
    it('does not claim a hard cover, which is one wrap sheet', () => {
        expect(isSoftCoverMagazineSet([
            { name: 'cover.jpg', isCover: true }, { name: '01.jpg' },
        ])).toBe(false);
    });

    it('does not claim a photobook, which exports spreads', () => {
        expect(isSoftCoverMagazineSet([
            { name: '00_cover.jpg', isCover: true }, { name: '01_spread.jpg' },
        ])).toBe(false);
    });

    /** Задня половина без передньої — це все одно м'яка обкладинка. */
    it('recognises the set when only one half rendered', () => {
        expect(isSoftCoverMagazineSet([{ name: '00_cover_back.jpg', isCover: true }])).toBe(true);
    });
});

describe('buildPdfSheets — журнал з м\'якою обкладинкою', () => {
    it('puts the front cover first and the back cover last', () => {
        const out = readSheets(buildPdfSheets(TM001352));
        expect(out[0]).toBe('00_cover_front.jpg');
        expect(out[out.length - 1]).toBe('00_cover_back.jpg');
    });

    /** Саме та поломка, яку побачили на TM-001352. */
    it('gives TM-001352 the printer\'s order, with a blank where f1 is missing', () => {
        expect(readSheets(buildPdfSheets(TM001352))).toEqual([
            '00_cover_front.jpg',
            '(білий f1)',
            '01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg',
            'f2.jpg',
            '00_cover_back.jpg',
        ]);
    });

    it('uses both forzat files when both were rendered', () => {
        const out = readSheets(buildPdfSheets([
            { name: '00_cover_back.jpg', isCover: true },
            { name: '00_cover_front.jpg', isCover: true },
            { name: 'f1.jpg' }, { name: 'f2.jpg' },
            { name: '01.jpg' }, { name: '02.jpg' },
        ]));
        expect(out).toEqual([
            '00_cover_front.jpg', 'f1.jpg', '01.jpg', '02.jpg', 'f2.jpg', '00_cover_back.jpg',
        ]);
    });

    it('fills BOTH forzat slots with blanks when neither was rendered', () => {
        const out = readSheets(buildPdfSheets([
            { name: '00_cover_back.jpg', isCover: true },
            { name: '00_cover_front.jpg', isCover: true },
            { name: '01.jpg' }, { name: '02.jpg' },
        ]));
        expect(out).toEqual([
            '00_cover_front.jpg', '(білий f1)', '01.jpg', '02.jpg', '(білий f2)', '00_cover_back.jpg',
        ]);
    });

    /** «10.jpg» після «9.jpg» — там же, де ламається сортування рядків. */
    it('sorts the pages naturally inside the magazine order', () => {
        const out = readSheets(buildPdfSheets([
            { name: '10.jpg' }, { name: '00_cover_front.jpg', isCover: true },
            { name: '9.jpg' }, { name: '1.jpg' }, { name: 'f1.jpg' }, { name: 'f2.jpg' },
        ]));
        expect(out).toEqual([
            '00_cover_front.jpg', 'f1.jpg', '1.jpg', '9.jpg', '10.jpg', 'f2.jpg',
        ]);
    });

    /**
     * Набір із самої обкладинки — це впалий рендер, а не журнал без форзаців.
     * Білі аркуші зробили б поломку схожою на справний виріб.
     */
    it('adds no blanks when the render produced no pages at all', () => {
        expect(readSheets(buildPdfSheets([
            { name: '00_cover_back.jpg', isCover: true },
            { name: '00_cover_front.jpg', isCover: true },
        ]))).toEqual(['00_cover_front.jpg', '00_cover_back.jpg']);
    });

    /** Викинути файл із макета гірше, ніж поставити його не туди. */
    it('loses nothing it does not recognise', () => {
        const out = readSheets(buildPdfSheets([
            { name: '00_cover_front.jpg', isCover: true },
            { name: '01.jpg' }, { name: 'f1.jpg' }, { name: 'f2.jpg' },
            { name: 'akryl_1.jpg' },
        ]));
        expect(out).toContain('akryl_1.jpg');
        expect(out.length).toBe(5);
    });

    it('leaves the caller array untouched', () => {
        const input = [{ name: '00_cover_back.jpg' }, { name: '00_cover_front.jpg' }];
        buildPdfSheets(input);
        expect(input.map(f => f.name)).toEqual(['00_cover_back.jpg', '00_cover_front.jpg']);
    });
});

describe('buildPdfSheets — решта виробів не змінюється', () => {
    /** Тверда обкладинка: один аркуш-розворот попереду, далі сторінки. */
    it('keeps a hard-cover journal exactly as sortPagesForPdf had it', () => {
        const files = [
            { name: '02.jpg', page_number: 4 },
            { name: 'cover.jpg', page_number: 1, isCover: true },
            { name: '01.jpg', page_number: 3 },
        ];
        expect(readSheets(buildPdfSheets(files)))
            .toEqual(sortPagesForPdf(files).map(f => String(f.name)));
    });

    it('keeps a photobook on spreads, cover first', () => {
        const files = [
            { name: '02_spread.jpg', page_number: 3 },
            { name: '00_cover.jpg', page_number: 1, isCover: true },
            { name: '01_spread.jpg', page_number: 2 },
        ];
        expect(readSheets(buildPdfSheets(files)))
            .toEqual(['00_cover.jpg', '01_spread.jpg', '02_spread.jpg']);
    });

    /** Жодного білого аркуша там, де форзаців немає за будовою виробу. */
    it('never invents a blank sheet outside the soft-cover magazine', () => {
        const out = buildPdfSheets([
            { name: '00_cover.jpg', isCover: true }, { name: '01_spread.jpg' },
        ]);
        expect(out.every(s => s.kind === 'file')).toBe(true);
    });

    it('survives an empty list', () => {
        expect(buildPdfSheets([])).toEqual([]);
    });
});
