import { describe, it, expect } from 'vitest';
import {
    sniffImageSignature,
    isBrowserRenderable,
    isRasterCandidate,
    SIGNATURE_BYTES,
    type ImageSignature,
} from '@/lib/image-signature';

/**
 * Межа тут стереже з обох боків, і обидва боки коштували замовлень.
 *
 * Не впізнати HEIC — це TM-001343 і TM-001244: одинадцять порожніх аркушів із
 * чотирнадцяти і дванадцять із п'ятнадцяти, бо знімки приїхали HEIC під іменем
 * `.jpg`. Помилково впізнати AVIF як HEIC — це перекодування формату, який
 * браузер читає сам, тобто втрата якості там, де її не мало бути. `mif1` і
 * `msf1` носить і те, і те, тож порядок перевірки — не деталь реалізації, а
 * саме те, що тут пінується.
 */

/** Заголовок ISO-BMFF: 'ftyp' на зсуві 4, основна марка, далі сумісні. */
function isoBmff(major: string, compatible: string[] = []): Uint8Array {
    const bytes = new Uint8Array(SIGNATURE_BYTES);
    const put = (at: number, text: string) => {
        for (let i = 0; i < 4; i++) bytes[at + i] = text.charCodeAt(i) || 0x20;
    };
    // байти 0..4 — розмір бокса, для розбору неважливий
    bytes[3] = SIGNATURE_BYTES;
    put(4, 'ftyp');
    put(8, major);
    // 12..16 — minor version
    compatible.forEach((brand, i) => {
        const at = 16 + i * 4;
        if (at + 4 <= SIGNATURE_BYTES) put(at, brand);
    });
    return bytes;
}

function bytesOf(...values: number[]): Uint8Array {
    const out = new Uint8Array(SIGNATURE_BYTES);
    out.set(values.slice(0, SIGNATURE_BYTES));
    return out;
}

function asciiBytes(text: string): Uint8Array {
    const out = new Uint8Array(Math.max(SIGNATURE_BYTES, text.length));
    for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i);
    return out;
}

describe('sniffImageSignature — HEIC', () => {
    it('упізнає HEIC незалежно від того, як файл названо', () => {
        // Назви у функції немає взагалі — це і є суть фіксу.
        expect(sniffImageSignature(isoBmff('heic', ['mif1', 'heic']))).toBe('heic');
        expect(sniffImageSignature(isoBmff('heix', ['mif1']))).toBe('heic');
    });

    it('упізнає решту марок сімейства HEIF', () => {
        for (const brand of ['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs', 'mif1', 'msf1']) {
            expect(sniffImageSignature(isoBmff(brand))).toBe('heic');
        }
    });

    it('бачить марку і тоді, коли вона лише серед сумісних', () => {
        // iPhone пише основною маркою послідовності, а heic — у списку сумісних.
        expect(sniffImageSignature(isoBmff('msf1', ['hevc', 'hevx']))).toBe('heic');
    });
});

describe('sniffImageSignature — AVIF не є HEIC', () => {
    it('avif із сумісною маркою mif1 лишається avif', () => {
        // Якби HEIC перевірявся першим, mif1 забрав би цей файл собі.
        expect(sniffImageSignature(isoBmff('avif', ['mif1', 'miaf']))).toBe('avif');
    });

    it('послідовність avis теж avif', () => {
        expect(sniffImageSignature(isoBmff('avis', ['avif', 'msf1', 'miaf']))).toBe('avif');
    });

    it('avif серед сумісних перемагає mif1 в основній марці', () => {
        expect(sniffImageSignature(isoBmff('mif1', ['miaf', 'avif']))).toBe('avif');
    });

    it('avif браузер малює сам, тож перемальовувати його не можна', () => {
        expect(isBrowserRenderable('avif')).toBe(true);
        expect(isBrowserRenderable('heic')).toBe(false);
    });
});

describe('sniffImageSignature — звичайні растрові формати', () => {
    it('JPEG за FF D8 FF', () => {
        expect(sniffImageSignature(bytesOf(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10))).toBe('jpeg');
    });

    it('PNG за повним підписом', () => {
        expect(sniffImageSignature(bytesOf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('png');
    });

    it('WebP за RIFF плюс WEBP на зсуві 8', () => {
        const webp = asciiBytes('RIFF____WEBPVP8 ');
        expect(sniffImageSignature(webp)).toBe('webp');
    });

    it('RIFF без WEBP не стає картинкою', () => {
        // RIFF носить і WAV, і AVI — самого контейнера замало.
        expect(sniffImageSignature(asciiBytes('RIFF____WAVEfmt '))).toBe('unknown');
    });

    it('GIF за GIF8', () => {
        expect(sniffImageSignature(asciiBytes('GIF89a'))).toBe('gif');
        expect(sniffImageSignature(asciiBytes('GIF87a'))).toBe('gif');
    });

    it('BMP за BM', () => {
        expect(sniffImageSignature(asciiBytes('BM'))).toBe('bmp');
    });

    it('усі вони малюються браузером і всі є растровими кандидатами', () => {
        for (const sig of ['jpeg', 'png', 'webp', 'gif', 'avif', 'bmp'] as ImageSignature[]) {
            expect(isBrowserRenderable(sig)).toBe(true);
            expect(isRasterCandidate(sig)).toBe(true);
        }
    });
});

describe('sniffImageSignature — PDF і SVG лишаються собою', () => {
    it('PDF за %PDF', () => {
        expect(sniffImageSignature(asciiBytes('%PDF-1.7'))).toBe('pdf');
    });

    it('SVG за <svg', () => {
        expect(sniffImageSignature(asciiBytes('<svg xmlns="http://w'))).toBe('svg');
    });

    it('SVG за оголошенням xml', () => {
        expect(sniffImageSignature(asciiBytes('<?xml version="1.0"'))).toBe('svg');
    });

    it('SVG із BOM і переносами рядків на початку', () => {
        const withBom = new Uint8Array(SIGNATURE_BYTES);
        withBom.set([0xef, 0xbb, 0xbf, 0x0a, 0x20, 0x09]);
        const tail = '<svg viewBox="0 0';
        for (let i = 0; i < tail.length; i++) withBom[6 + i] = tail.charCodeAt(i);
        expect(sniffImageSignature(withBom)).toBe('svg');
    });

    /**
     * Ці двоє ходять тим самим шляхом підготовки, що й фотографії
     * (prepareImageForUpload). Перемальовувати їх на canvas безглуздо, тож
     * вони мусять чесно випадати з растрової гілки.
     */
    it('pdf і svg не є растровими кандидатами', () => {
        expect(isRasterCandidate('pdf')).toBe(false);
        expect(isRasterCandidate('svg')).toBe(false);
        expect(isBrowserRenderable('pdf')).toBe(false);
        expect(isBrowserRenderable('svg')).toBe(false);
    });
});

describe('sniffImageSignature — нерозпізнане', () => {
    it('повертає unknown замість здогадки', () => {
        expect(sniffImageSignature(asciiBytes('{"order":"TM-001343"}'))).toBe('unknown');
        expect(sniffImageSignature(bytesOf(0x00, 0x01, 0x02, 0x03))).toBe('unknown');
    });

    it('контейнер ISO-BMFF із чужою маркою теж unknown', () => {
        // MP4-відео: той самий 'ftyp', але жодної картинкової марки.
        expect(sniffImageSignature(isoBmff('isom', ['iso2', 'mp41']))).toBe('unknown');
    });

    it('порожній і закороткий вхід не падає', () => {
        expect(sniffImageSignature(new Uint8Array(0))).toBe('unknown');
        expect(sniffImageSignature(new Uint8Array([0xff, 0xd8]))).toBe('unknown');
    });

    /**
     * unknown лишається растровим кандидатом свідомо: невпізнаний файл іде в
     * м'яку гілку перемальовування, яка на відмові повертає оригінал. Так
     * незвичний, але справжній формат має шанс, а json просто проходить наскрізь.
     */
    it('unknown лишається растровим кандидатом', () => {
        expect(isRasterCandidate('unknown')).toBe(true);
        expect(isBrowserRenderable('unknown')).toBe(false);
    });
});
