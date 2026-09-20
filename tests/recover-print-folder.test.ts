import { describe, expect, it } from 'vitest';
import {
    FOLDER_WINDOW_MS,
    cartIdTimestamp,
    expectedPhotoCount,
    folderTimestamp,
    pickPrintFolder,
    type FolderCandidate,
} from '@/lib/print/recover-print-folder';

/**
 * TM-001347: 126 відбитків зібрано 17.09 о 16:29, оплачено 20.09 о 17:13
 * сертифікатом на 1000 ₴. Файли лежали у сховищі цілі, а в замовленні не було
 * жодного: ключ у сховищі вкладки за три доби зник.
 *
 * Ціна помилки тут несиметрична і неприємна саме в один бік. Не впізнати теку
 * означає порожнє замовлення, яке побачить менеджерка. Впізнати ЧУЖУ означає
 * конверт із чужими фотографіями, і побачить це вже клієнт.
 */
const cartId = '99a39b86-95db-4e74-a2c3-f7ba7fe46d93_1789662580954';
const cartTs = 1789662580954;

const folder = (name: string, files: number, taken = false): FolderCandidate =>
    ({ folder: name, root: 'anon', files, taken });

describe('час із ідентифікаторів', () => {
    it('читає час позиції кошика', () => {
        expect(cartIdTimestamp(cartId)).toBe(cartTs);
    });

    it('читає час теки', () => {
        expect(folderTimestamp('pp_1789662580990')).toBe(1789662580990);
    });

    it('не вигадує час там, де його немає', () => {
        expect(cartIdTimestamp('pb-1789836517172-73gbee')).toBeNull();
        expect(cartIdTimestamp(null)).toBeNull();
        expect(folderTimestamp('drafts')).toBeNull();
        expect(folderTimestamp('pp_')).toBeNull();
    });
});

describe('скільки відбитків у позиції', () => {
    it('бере кількість з опції', () => {
        expect(expectedPhotoCount({ options: { 'Кількість фото': '126' } })).toBe(126);
    });

    it('бере кількість із примітки, коли опції немає', () => {
        expect(expectedPhotoCount({ personalization_note: '126 фото для друку' })).toBe(126);
    });

    it('мовчить, коли числа немає ніде', () => {
        expect(expectedPhotoCount({ options: {} })).toBeNull();
        expect(expectedPhotoCount(null)).toBeNull();
        expect(expectedPhotoCount({ options: { 'Кількість фото': '0' } })).toBeNull();
    });
});

describe('вибір теки', () => {
    const pick = (cands: FolderCandidate[], expected: number | null = 126) =>
        pickPrintFolder(cands, { cartTs, expected });

    it('впізнає теку TM-001347 за часом і кількістю', () => {
        const hit = pick([folder('pp_1789662580990', 126)]);
        expect(hit?.folder).toBe('pp_1789662580990');
    });

    it('не бере теку з іншою кількістю файлів', () => {
        expect(pick([folder('pp_1789662580990', 125)])).toBeNull();
        expect(pick([folder('pp_1789662580990', 127)])).toBeNull();
    });

    it('не бере теку, яку вже забрало інше замовлення', () => {
        expect(pick([folder('pp_1789662580990', 126, true)])).toBeNull();
    });

    it('не бере теку поза вікном часу', () => {
        const far = `pp_${cartTs + FOLDER_WINDOW_MS + 1000}`;
        expect(pick([folder(far, 126)])).toBeNull();
    });

    it('без кількості відбитків не вибирає нічого', () => {
        expect(pick([folder('pp_1789662580990', 126)], null)).toBeNull();
    });

    it('бере ближчу з двох придатних', () => {
        const hit = pick([
            folder(`pp_${cartTs + 600_000}`, 126),
            folder(`pp_${cartTs + 36}`, 126),
        ]);
        expect(hit?.folder).toBe(`pp_${cartTs + 36}`);
    });

    /** Два однаково близькі кандидати — це жереб, а не вибір. */
    it('відмовляється вибирати між двома однаково близькими', () => {
        expect(pick([
            folder(`pp_${cartTs - 5000}`, 126),
            folder(`pp_${cartTs + 5000}`, 126),
        ])).toBeNull();
    });

    it('переживає порожній список і сміття', () => {
        expect(pick([])).toBeNull();
        expect(pick([folder('щось', 126)])).toBeNull();
    });
});
