import { DPI_WARN, dpiFor, dpiLevel, type DpiLevel } from '@/lib/print/dpi';
import { pageMm } from '@/lib/print/geometry';

/**
 * Чи вистачить роздільності цього фото на замовлений виріб.
 *
 * ПРИВІД (Тома і Діана, 18.09.2026, TM-001336). Клієнтка замовила фотокнигу
 * 30×30 з велюровою обкладинкою за 3285 ₴ і надіслала сорок чотири фото,
 * викачані з Фейсбука: імена виду 783897896_1396318221861607_…_n.jpg, вага від
 * дев'ятнадцяти кілобайтів. У тому ж замовленні сім знімків зі звичайними
 * іменами важать усемеро більше — тобто стискали не ми, такими вони й прийшли.
 *
 * Але ми не сказали про це ЖОДНОГО слова. У конструкторі фотодруку під замалим
 * кадром світиться значок DPI, а на сторінці заявки з дизайнером перевірки не
 * було взагалі: людина завантажує сорок чотири фейсбукові копії на книгу за
 * три тисячі й дізнається про проблему аж тоді, коли дизайнер сідає верстати.
 *
 * ЩО САМЕ МІРЯЄМО. Фото проти ЦІЛОЇ сторінки: це найгірший випадок, бо в
 * колажі той самий знімок займе менше місця і вийде різкішим. Тому й
 * формулювання відповідне — «на всю сторінку буде мʼяко», а не «фото погане».
 * Обіцяти більше, ніж знаємо, тут не можна: як саме дизайнер розкладе кадр, на
 * цьому кроці ще ніхто не вирішив.
 */

/**
 * Ключі, під якими розмір виробу лежить у збереженій конфігурації.
 *
 * Їх кілька, бо різні конструктори називають те саме по-різному: фотокнига
 * пише «Розмір книги», велюровий альбом «Розмір», журнал «Формат».
 */
const SIZE_KEYS = ['Розмір книги', 'Розмір', 'Формат', 'size', 'format'];

/** Розмір однієї сторінки замовленого виробу в міліметрах, або null. */
export function orderedPageMm(config: Record<string, any> | null | undefined): { w: number; h: number } | null {
    if (!config || typeof config !== 'object') return null;
    for (const key of SIZE_KEYS) {
        const raw = config[key];
        if (raw === undefined || raw === null || raw === '') continue;
        const mm = pageMm(String(raw));
        if (mm) return mm;
    }
    return null;
}

export type PhotoCheck = { level: DpiLevel; dpi: number };

/**
 * Рівень цього фото для друку на цілу сторінку.
 *
 * Береться гірша вісь: сторінка квадратна не завжди, і фото теж. `null` —
 * розмірів не знаємо (наприклад HEIC, який браузер не декодує), і тоді краще
 * промовчати, ніж лякати навмання.
 */
export function checkPhotoForPage(
    photo: { width?: number; height?: number } | null | undefined,
    page: { w: number; h: number } | null | undefined,
): PhotoCheck | null {
    if (!photo || !page) return null;
    const { width, height } = photo;
    if (!(width! > 0) || !(height! > 0)) return null;

    // Кадр можна покласти на сторінку в будь-якій орієнтації, тож беремо ту,
    // яка дає більше DPI: інакше горизонтальне фото на вертикальній сторінці
    // отримало б попередження на рівному місці.
    const straight = Math.min(dpiFor(width!, page.w), dpiFor(height!, page.h));
    const turned = Math.min(dpiFor(width!, page.h), dpiFor(height!, page.w));
    const dpi = Math.max(straight, turned);

    const level = dpiLevel(dpi);
    return level ? { level, dpi: Math.round(dpi) } : null;
}

/** Скільки пікселів треба, щоб ця сторінка вийшла різкою. */
export function neededPixels(page: { w: number; h: number }): { w: number; h: number } {
    return {
        w: Math.round((page.w / 25.4) * DPI_WARN),
        h: Math.round((page.h / 25.4) * DPI_WARN),
    };
}

/** Підпис під конкретним фото. Порожньо — сказати нема чого. */
export function describePhoto(check: PhotoCheck | null): string {
    if (!check || check.level === 'ok') return '';
    return check.level === 'bad'
        ? `${check.dpi} DPI — на всю сторінку буде помітно розмито`
        : `${check.dpi} DPI — на всю сторінку буде мʼяко, у колажі нормально`;
}

/**
 * Один рядок про всю пачку. Саме він і є тим, чого бракувало: окремі значки
 * легко пропустити, а «12 фото з 44 замалі» прочитається одразу.
 */
export function summarisePhotos(checks: Array<PhotoCheck | null>, page: { w: number; h: number } | null): string {
    const judged = checks.filter((c): c is PhotoCheck => !!c);
    if (!judged.length || !page) return '';
    const weak = judged.filter(c => c.level !== 'ok').length;
    if (!weak) return '';
    const need = neededPixels(page);
    return `${weak} фото з ${judged.length} замалі для друку на всю сторінку. `
        + `Для сторінки ${Math.round(page.w / 10)}×${Math.round(page.h / 10)} см потрібно приблизно ${need.w}×${need.h} пікселів. `
        + 'Найчастіша причина — фото збережені з Фейсбука чи Інстаграма: там вони стискаються. '
        + 'Надішліть оригінали з галереї телефона або від фотографа, і буде різко.';
}
