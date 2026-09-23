import { describe, it, expect } from 'vitest';
import { ensurePhotoVariants } from '@/lib/editor/photo-variants';
import { displayPathFor, thumbPathFor } from '@/lib/editor/photo-variant-paths';

/**
 * Копії з того розкодування, яке вже відбулося на імпорті.
 *
 * ЧОМУ ЦІ ТЕСТИ ПРАЦЮЮТЬ У NODE, ДЕ НЕМАЄ CANVAS. `makeVariants` першим рядком
 * перевіряє `document` і `createImageBitmap`, і без них повертає порожнечу.
 * Тобто в цьому середовищі нарізка з оригіналу дати копію НЕ МОЖЕ ФІЗИЧНО.
 * Виходить безкоштовний і дуже точний доказ: якщо шлях копії повернувся, його
 * могли взяти тільки з готових байтів, і жодне розкодування не знадобилося.
 * Саме це й є зміст зміни — 117 мс на знімок 12 Мп проти 7 мс.
 */

const ORIGINAL = 'drafts/u/d/abc.jpg';

/** Мінімальний `data:`-JPEG заданої ваги. */
function jpegDataUrl(bytes: number): string {
    return 'data:image/jpeg;base64,' + Buffer.alloc(bytes, 7).toString('base64');
}

/** Сховище-заглушка: запамʼятовує, що і під яким шляхом до нього поклали. */
function fakeStorage() {
    const puts: Array<{ path: string; size: number; contentType: string }> = [];
    return {
        puts,
        sb: {
            storage: {
                from: () => ({
                    upload: async (path: string, blob: Blob, opts: any) => {
                        puts.push({ path, size: blob.size, contentType: opts?.contentType });
                        return { error: null };
                    },
                }),
            },
        },
    };
}

describe('готові копії замість повторного розкодування', () => {
    it('кладе обидві готові копії і не чіпає оригінал', async () => {
        const { sb, puts } = fakeStorage();
        const out = await ensurePhotoVariants(sb, 'photobook-uploads', ORIGINAL, 'unused-source', {
            display: jpegDataUrl(900),
            thumb: jpegDataUrl(120),
            originalWidth: 4032,
            originalHeight: 3024,
            originalBytes: 5_511_619,
        });

        expect(out.previewPath).toBe(displayPathFor(ORIGINAL));
        expect(out.thumbPath).toBe(thumbPathFor(ORIGINAL));
        // Оригінал не має права опинитися серед записаного: саме з нього
        // Railway збирає макет для друку.
        expect(puts.map(p => p.path)).not.toContain(ORIGINAL);
        expect(puts).toHaveLength(2);
        expect(puts.every(p => p.contentType === 'image/jpeg')).toBe(true);
    });

    it('підписане посилання на оригінал копією не вважається', async () => {
        const { sb, puts } = fakeStorage();
        const out = await ensurePhotoVariants(sb, 'photobook-uploads', ORIGINAL, 'unused-source', {
            // Так виглядає фото зі старого макета: у `preview` лежить ОРИГІНАЛ
            // із хмари. Покласти його під імʼям копії означало б віддавати
            // читачеві дванадцять мегапікселів замість екранної копії.
            display: 'https://yivfsicvaoewxrtkrfxr.supabase.co/storage/v1/object/sign/abc.jpg?token=x',
            thumb: 'https://yivfsicvaoewxrtkrfxr.supabase.co/storage/v1/object/sign/abc.jpg?token=y',
            originalWidth: 4032,
            originalHeight: 3024,
        });

        expect(out.previewPath).toBeUndefined();
        expect(out.thumbPath).toBeUndefined();
        expect(puts).toHaveLength(0);
    });

    it('PNG не лягає під імʼям .jpg', async () => {
        const { sb, puts } = fakeStorage();
        const out = await ensurePhotoVariants(sb, 'photobook-uploads', ORIGINAL, 'unused-source', {
            display: 'data:image/png;base64,' + Buffer.alloc(500, 3).toString('base64'),
            thumb: jpegDataUrl(120),
            originalWidth: 4032,
            originalHeight: 3024,
        });

        expect(out.previewPath).toBeUndefined();
        expect(out.thumbPath).toBe(thumbPathFor(ORIGINAL));
        expect(puts).toHaveLength(1);
    });

    it('фото, менше за межу, копії не отримує', async () => {
        const { sb, puts } = fakeStorage();
        const out = await ensurePhotoVariants(sb, 'photobook-uploads', ORIGINAL, 'unused-source', {
            display: jpegDataUrl(900),
            thumb: jpegDataUrl(120),
            // Менше і за 1600, і за 360: зменшувати нічого.
            originalWidth: 300,
            originalHeight: 200,
        });

        expect(out.previewPath).toBeUndefined();
        expect(out.thumbPath).toBeUndefined();
        expect(puts).toHaveLength(0);
    });

    it('між 360 і 1600 робиться тільки стрічкова копія', async () => {
        const { sb, puts } = fakeStorage();
        const out = await ensurePhotoVariants(sb, 'photobook-uploads', ORIGINAL, 'unused-source', {
            display: jpegDataUrl(900),
            thumb: jpegDataUrl(120),
            originalWidth: 1200,
            originalHeight: 900,
        });

        expect(out.previewPath).toBeUndefined();
        expect(out.thumbPath).toBe(thumbPathFor(ORIGINAL));
        expect(puts.map(p => p.path)).toEqual([thumbPathFor(ORIGINAL)]);
    });

    it('копія, важча за оригінал, відкидається', async () => {
        const { sb, puts } = fakeStorage();
        const out = await ensurePhotoVariants(sb, 'photobook-uploads', ORIGINAL, 'unused-source', {
            display: jpegDataUrl(9000),
            thumb: jpegDataUrl(120),
            originalWidth: 4032,
            originalHeight: 3024,
            originalBytes: 4000,
        });

        expect(out.previewPath).toBeUndefined();
        expect(out.thumbPath).toBe(thumbPathFor(ORIGINAL));
        expect(puts).toHaveLength(1);
    });

    it('без готових копій і без canvas нічого не вигадує', async () => {
        const { sb, puts } = fakeStorage();
        const out = await ensurePhotoVariants(sb, 'photobook-uploads', ORIGINAL, jpegDataUrl(5000), {
            originalWidth: 4032,
            originalHeight: 3024,
        });

        // Старий шлях лишився на місці: він просто не може відпрацювати там,
        // де немає розкодування. Головне — збереження не падає.
        expect(out.previewPath).toBeUndefined();
        expect(out.thumbPath).toBeUndefined();
        expect(puts).toHaveLength(0);
    });

    it('без шляху оригіналу копій не буває', async () => {
        const { sb, puts } = fakeStorage();
        const out = await ensurePhotoVariants(sb, 'photobook-uploads', '', 'unused-source', {
            display: jpegDataUrl(900),
            thumb: jpegDataUrl(120),
            originalWidth: 4032,
            originalHeight: 3024,
        });

        expect(out).toEqual({});
        expect(puts).toHaveLength(0);
    });
});
