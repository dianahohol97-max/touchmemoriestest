import { describe, expect, it } from 'vitest';
import {
    isBrowserRenderable,
    isRasterCandidate,
    sniffImageSignature,
    type ImageSignature,
} from '@/lib/image-signature';

/**
 * Правило: формат вирішують байти, а не ім'я файлу (Діана, 2026-09-22).
 *
 * Тест стереже межу з обох боків, і обидві сторони коштують дорого. Не
 * впізнати HEIC означає повторити TM-001343: сорок фото в макеті, три
 * надрукованих, одинадцять порожніх аркушів у друкарню і жодного сигналу про
 * це. Впізнати HEIC там, де його немає, означає перемалювати камерний JPEG
 * через canvas — подвійне стиснення, тобто та сама «розмитість», яку ми вже
 * одного разу ловили і прибирали.
 *
 * Найтонше місце — AVIF. Він лежить у тому самому контейнері ISO-BMFF і несе
 * ті самі загальні марки `mif1`/`msf1`, що й HEIF, а браузери його читають.
 */

/** Заголовок ISO-BMFF: довжина боксу, `ftyp`, основна марка, версія, сумісні. */
const isoHeader = (major: string, compatible: string[] = []): Uint8Array => {
    const text = `ftyp${major}\0\0\0\0${compatible.join('')}`;
    const bytes = new Uint8Array(4 + text.length);
    bytes.set([0, 0, 0, 4 + text.length], 0);
    for (let i = 0; i < text.length; i++) bytes[4 + i] = text.charCodeAt(i);
    return bytes;
};

const ofText = (s: string): Uint8Array => Uint8Array.from([...s].map(c => c.charCodeAt(0)));

describe('sniffImageSignature', () => {
    it('reads a camera JPEG from its first three bytes', () => {
        expect(sniffImageSignature(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a]))).toBe('jpeg');
    });

    it('reads PNG, GIF, WebP and BMP', () => {
        expect(sniffImageSignature(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
        expect(sniffImageSignature(ofText('GIF89a'))).toBe('gif');
        expect(sniffImageSignature(ofText('RIFF\0\0\0\0WEBPVP8 '))).toBe('webp');
        expect(sniffImageSignature(ofText('BM\0\0\0\0'))).toBe('bmp');
    });

    /** Саме цей випадок і зламав TM-001343: HEIC, названий `.jpg`. */
    it('recognises an iPhone HEIC whatever the file is called', () => {
        expect(sniffImageSignature(isoHeader('heic', ['mif1', 'miaf']))).toBe('heic');
        expect(sniffImageSignature(isoHeader('heix'))).toBe('heic');
        expect(sniffImageSignature(isoHeader('mif1', ['heic']))).toBe('heic');
        expect(sniffImageSignature(isoHeader('hevc'))).toBe('heic');
    });

    it('does NOT mistake AVIF for HEIC, even when it carries the shared brands', () => {
        expect(sniffImageSignature(isoHeader('avif', ['mif1', 'miaf']))).toBe('avif');
        expect(sniffImageSignature(isoHeader('mif1', ['avif']))).toBe('avif');
    });

    it('leaves PDF and SVG as themselves', () => {
        expect(sniffImageSignature(ofText('%PDF-1.7'))).toBe('pdf');
        expect(sniffImageSignature(ofText('<svg xmlns="http://www'))).toBe('svg');
        expect(sniffImageSignature(ofText('<?xml version="1.0"?>'))).toBe('svg');
        expect(sniffImageSignature(ofText('  \n<svg viewBox="0 0 1 1">'))).toBe('svg');
    });

    it('answers unknown rather than guessing', () => {
        expect(sniffImageSignature(ofText('{"cartItemId":"pb-1"}'))).toBe('unknown');
        expect(sniffImageSignature(Uint8Array.from([0x49, 0x49, 0x2a, 0x00]))).toBe('unknown'); // TIFF
        expect(sniffImageSignature(new Uint8Array(0))).toBe('unknown');
        expect(sniffImageSignature(Uint8Array.from([0xff]))).toBe('unknown');
    });

    it('does not read a truncated ISO box as an image', () => {
        expect(sniffImageSignature(ofText('\0\0\0\x18ftyp'))).toBe('unknown');
    });
});

describe('isBrowserRenderable', () => {
    it('lets through exactly what a browser draws without our help', () => {
        const renderable: ImageSignature[] = ['jpeg', 'png', 'webp', 'gif', 'avif', 'bmp'];
        for (const s of renderable) expect(isBrowserRenderable(s)).toBe(true);
    });

    /** HEIC у цьому списку означав би порожній аркуш у друкарні. */
    it('keeps HEIC and unknown out, so they get redrawn before upload', () => {
        for (const s of ['heic', 'unknown', 'pdf', 'svg'] as ImageSignature[]) {
            expect(isBrowserRenderable(s)).toBe(false);
        }
    });
});

describe('isRasterCandidate', () => {
    it('protects PDF and SVG from being redrawn through canvas', () => {
        expect(isRasterCandidate('pdf')).toBe(false);
        expect(isRasterCandidate('svg')).toBe(false);
        expect(isRasterCandidate('heic')).toBe(true);
        expect(isRasterCandidate('unknown')).toBe(true);
    });
});
