import { describe, expect, it } from 'vitest';
import { DIRECT_UPLOAD_FROM_BYTES, needsDirectUpload, safeImageContentType } from '@/lib/storage-upload';

/**
 * Стеля Vercel на тіло запиту — це те, об що тихо гинули фото клієнтів.
 *
 * Функція приймає близько 4,5 МБ, і запит ріжеться ще до нашого коду, тож у
 * відповідь приходить голе 413 без пояснення. Межу видно в живих числах з
 * upload_attempt_log до байта:
 *
 *   найбільший файл, який доїхав   4 487 593 Б
 *   найменший файл, який упав      4 497 036 Б
 *
 * Між ними девʼять кілобайтів. З восьмого серпня по сімнадцяте вересня 2026
 * так загубилися фото в шістнадцяти замовленнях; найгірше в TM-001305
 * (девʼять знімків із двадцяти шести) і TM-001306 (десять із двадцяти семи).
 *
 * Даунскейл не рятував: downscaleImageIfLarge дивиться на сторону в пікселях,
 * а не на вагу, тож знімок 4032×3024 з айфона летів як є.
 */

/** Живі числа з бази, заради яких усе це й робилося. */
const LARGEST_THAT_ARRIVED = 4_487_593;
const SMALLEST_THAT_FAILED = 4_497_036;

describe('межа, після якої файл іде прямо в сховище', () => {
    it('поріг стоїть нижче за найменший файл, який колись упав', () => {
        expect(DIRECT_UPLOAD_FROM_BYTES).toBeLessThan(SMALLEST_THAT_FAILED);
    });

    it('поріг має запас, а не стоїть упритул до обриву', () => {
        // Півмегабайта на обгортку multipart і на те, що точної межі ніхто не
        // документував. Впритул до обриву — це знову лотерея.
        expect(SMALLEST_THAT_FAILED - DIRECT_UPLOAD_FROM_BYTES).toBeGreaterThan(400_000);
    });

    it('обидва файли Юлії, які впали з 413, тепер ідуть прямим шляхом', () => {
        expect(needsDirectUpload(5_030_717)).toBe(true); // IMG_8286.jpg
        expect(needsDirectUpload(4_834_853)).toBe(true); // IMG_8529.jpg
    });

    it('найбільший файл, який раніше ледве пролазив, теж іде прямим шляхом', () => {
        expect(needsDirectUpload(LARGEST_THAT_ARRIVED)).toBe(true);
    });

    it('звичайні фото лишаються на старому шляху з перевіркою обрізаного тіла', () => {
        for (const size of [1, 853_787, 2_413_538, 3_360_487, DIRECT_UPLOAD_FROM_BYTES - 1]) {
            expect(needsDirectUpload(size)).toBe(false);
        }
    });

    it('рівно на порозі — уже прямий шлях', () => {
        expect(needsDirectUpload(DIRECT_UPLOAD_FROM_BYTES)).toBe(true);
    });
});

describe('тип, з яким файл лягає у сховище', () => {
    it('image/jpg з телефона зводиться до канонічного image/jpeg', () => {
        expect(safeImageContentType(new File([], 'a.jpg', { type: 'image/jpg' }))).toBe('image/jpeg');
    });

    it('невідомий тип не видається за картинку', () => {
        expect(safeImageContentType(new File([], 'a.bin', { type: 'application/x-thing' })))
            .toBe('application/octet-stream');
    });
});
