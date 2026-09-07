import { describe, expect, it } from 'vitest';
import { decoFileName, parseDecoVariantMm } from '@/lib/print/deco-variant';
import { fitTextBlock, wrapLines } from '@/lib/print/text-wrap';

/**
 * Розмір оздоблення й розкладка напису.
 *
 * Помилка в цих двох місцях не видно ні на сайті, ні в картці замовлення: вона
 * доїжджає до верстата у майстерні. TM-001288 замовив металеву вставку 90×50,
 * а файл для лазера пішов квадратом 60×60 з написом в один волосяний рядок.
 */
const METAL_FALLBACK = { w: 90, h: 50, round: false };

describe('parseDecoVariantMm', () => {
    it('reads the sides out of a customer-facing label', () => {
        expect(parseDecoVariantMm('90×50 золотий', METAL_FALLBACK)).toEqual({ w: 90, h: 50, round: false });
        expect(parseDecoVariantMm('250×70 срібний', METAL_FALLBACK)).toEqual({ w: 250, h: 70, round: false });
        expect(parseDecoVariantMm('100×100 мм', METAL_FALLBACK)).toEqual({ w: 100, h: 100, round: false });
    });

    it('accepts all three spellings of the separator', () => {
        // Латинська x, кирилична х і знак × — усі три є в збережених варіантах.
        expect(parseDecoVariantMm('90x50', METAL_FALLBACK).w).toBe(90);
        expect(parseDecoVariantMm('90х50', METAL_FALLBACK).w).toBe(90);
        expect(parseDecoVariantMm('90 × 50', METAL_FALLBACK).h).toBe(50);
    });

    it('recognises a round insert instead of guessing a rectangle', () => {
        expect(parseDecoVariantMm('Ø145 мм', METAL_FALLBACK)).toEqual({ w: 145, h: 145, round: true });
    });

    it('falls back to what the CALLER passes, never to a shared default', () => {
        // Це і є суть модуля: для металу розумний запас один, для акрилу інший.
        expect(parseDecoVariantMm('', METAL_FALLBACK)).toEqual(METAL_FALLBACK);
        expect(parseDecoVariantMm('золотий', { w: 100, h: 100, round: false }))
            .toEqual({ w: 100, h: 100, round: false });
        expect(parseDecoVariantMm(null, METAL_FALLBACK)).toEqual(METAL_FALLBACK);
        expect(parseDecoVariantMm(undefined, METAL_FALLBACK)).toEqual(METAL_FALLBACK);
    });

    it('does not return a zero side from a malformed label', () => {
        expect(parseDecoVariantMm('0×50', METAL_FALLBACK)).toEqual(METAL_FALLBACK);
    });
});

describe('decoFileName', () => {
    it('names the file by the size that is actually engraved', () => {
        expect(decoFileName('metal', { w: 90, h: 50, round: false })).toBe('metal_90x50.jpg');
        expect(decoFileName('metal', { w: 60, h: 60, round: false })).toBe('metal_60x60.jpg');
        expect(decoFileName('akryl', { w: 145, h: 145, round: true })).toBe('akryl_d145.jpg');
    });
});

/** Модель ширини: кожна літера ~0.5 кегля. Досить, щоб перевірити розкладку. */
const measureAt = (line: string, fontPx: number) => line.length * fontPx * 0.5;

describe('wrapLines', () => {
    it('breaks a long line on spaces', () => {
        const lines = wrapLines('одна привела нас одне до одного', 15, l => l.length);
        expect(lines.length).toBeGreaterThan(1);
        expect(lines.every(l => l.length <= 15)).toBe(true);
        expect(lines.join(' ')).toBe('одна привела нас одне до одного');
    });

    it('keeps the author own line breaks', () => {
        expect(wrapLines('Наталя\nта Олег', 1000, l => l.length)).toEqual(['Наталя', 'та Олег']);
    });

    it('never splits a word in the middle, even when it does not fit', () => {
        expect(wrapLines('одногоодногоодного', 10, l => l.length)).toEqual(['одногоодногоодного']);
    });

    it('survives empty and whitespace-only text', () => {
        expect(wrapLines('', 100, l => l.length)).toEqual([]);
        expect(wrapLines('   \n  ', 100, l => l.length)).toEqual([]);
    });
});

describe('fitTextBlock', () => {
    /** Саме випадок TM-001288: довгий підпис на пластині 90×50 мм. */
    it('wraps a long inscription instead of shrinking it to a hairline', () => {
        const text = 'Із тисячі доріг - одна привела нас одне до одного 11.07.2026';
        // Пластина 90×50 мм при 300 DPI: 1063×591 px, текстова зона 80 %.
        const fit = fitTextBlock({
            text, maxWidth: 1063 * 0.8, maxHeight: 591 * 0.86,
            startFontPx: 591 * 0.18, minFontPx: 8, measureAt,
        });
        expect(fit.lines.length).toBeGreaterThan(1);
        // Головне: кегль лишається придатним для гравіювання, а не волосиною.
        expect(fit.fontPx).toBeGreaterThan(40);
        const widest = Math.max(...fit.lines.map(l => measureAt(l, fit.fontPx)));
        expect(widest).toBeLessThanOrEqual(1063 * 0.8);
        expect(fit.lines.length * fit.fontPx * 1.2).toBeLessThanOrEqual(591 * 0.86);
    });

    it('leaves a short inscription at the largest allowed size', () => {
        const fit = fitTextBlock({
            text: 'Наталя', maxWidth: 1000, maxHeight: 500,
            startFontPx: 100, minFontPx: 8, measureAt,
        });
        expect(fit.fontPx).toBe(100);
        expect(fit.lines).toEqual(['Наталя']);
    });

    it('stops at the floor rather than looping forever on text that cannot fit', () => {
        const fit = fitTextBlock({
            text: 'одногоодногоодногоодного', maxWidth: 10, maxHeight: 10,
            startFontPx: 100, minFontPx: 8, measureAt,
        });
        expect(fit.fontPx).toBe(8);
        expect(fit.lines).toEqual(['одногоодногоодногоодного']);
    });

    it('returns no lines for empty text', () => {
        expect(fitTextBlock({
            text: '   ', maxWidth: 100, maxHeight: 100,
            startFontPx: 20, minFontPx: 8, measureAt,
        }).lines).toEqual([]);
    });
});
