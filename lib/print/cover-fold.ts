import { deriveGeometry } from '@/lib/print/geometry';
import { COVER_FOLD_MM } from '@/lib/print/trim-guides';

/**
 * Де на аркуші обкладинки лежить те, що видно на готовій книзі.
 *
 * Аркуш ширший і вищий за саму обкладинку: по краях поле загину, яке
 * загортається на картон, а посередині корінець. Для тревелбука аркуш
 * 470×328 мм, поле загину 20 мм з кожного боку, сторінка 210×297 мм, тож на
 * корінець лишається рівно 10 мм — по пʼять на кожну половину.
 *
 * Ці числа потрібні двом дуже різним місцям: конструктор вписує в цю площину
 * готову обкладинку, а адмінка вирізає з неї передню обкладинку окремим
 * файлом. Тому вони живуть тут, поруч із рештою друкарської геометрії, а не в
 * якомусь одному зі споживачів. Ширина корінця не задана ніде окремо: вона є
 * рештою аркуша після двох сторінок і двох полів загину.
 */

export type FrontCoverInset = { top: number; bottom: number; left: number; right: number };

/** Коли специфікація загину невідома — стільки ж, скільки показує конструктор для 23×23. */
const FALLBACK_INSET = 0.06;

/**
 * Відступи видимої площини від країв ПЕРЕДНЬОЇ ПОЛОВИНИ аркуша, у частках цієї
 * половини. Зліва половина корінця, справа й по вертикалі — поле загину.
 */
export function frontCoverInset(sizeKey: string): FrontCoverInset {
    const g = deriveGeometry(sizeKey);
    const fold = COVER_FOLD_MM[g?.sizeKey || sizeKey];
    if (!g || !fold || !(g.cover.w > 0 && g.cover.h > 0)) {
        return { top: FALLBACK_INSET, bottom: FALLBACK_INSET, left: FALLBACK_INSET, right: FALLBACK_INSET };
    }
    const halfW = g.cover.w / 2;
    const spine = Math.max(0, g.cover.w - 2 * fold.lr - 2 * g.page.w);
    return {
        top: fold.tb / g.cover.h,
        bottom: fold.tb / g.cover.h,
        left: (spine / 2) / halfW,
        right: fold.lr / halfW,
    };
}

/**
 * Що саме вирізати з готового файлу обкладинки, у частках цього файлу.
 *
 * `bleed` — уся права половина аркуша: половина корінця, сама обкладинка і поле
 * загину. Це рівно те, що поїде в друкарню, тож таким файлом звіряються.
 *
 * `trimmed` — лише видима площина: те, як обкладинка виглядатиме в руках.
 *
 * Права половина, а не ліва, бо у файлі зліва задня обкладинка, справа
 * передня — так її малює BookPreviewModal і так знімає рендер-сервіс.
 */
export type FrontCoverCropMode = 'bleed' | 'trimmed';

export function frontCoverCropFractions(
    sizeKey: string,
    mode: FrontCoverCropMode,
): { left: number; top: number; width: number; height: number } {
    if (mode === 'bleed') return { left: 0.5, top: 0, width: 0.5, height: 1 };
    const inset = frontCoverInset(sizeKey);
    return {
        left: 0.5 + inset.left / 2,
        top: inset.top,
        width: (1 - inset.left - inset.right) / 2,
        height: 1 - inset.top - inset.bottom,
    };
}

/**
 * Той самий виріз у пікселях конкретного файлу.
 *
 * Округлення свідомо різне для початку і для розміру: беремо цілий піксель
 * початку, а ширину рахуємо від округленого краю. Інакше сума «лівий край плюс
 * ширина» інколи вилазить за межі файлу на один піксель, і sharp відмовляє
 * цілим запитом.
 */
export function frontCoverCropPx(
    sizeKey: string,
    mode: FrontCoverCropMode,
    imageW: number,
    imageH: number,
): { left: number; top: number; width: number; height: number } | null {
    if (!(imageW > 0 && imageH > 0)) return null;
    const f = frontCoverCropFractions(sizeKey, mode);
    const left = Math.round(f.left * imageW);
    const top = Math.round(f.top * imageH);
    const right = Math.round((f.left + f.width) * imageW);
    const bottom = Math.round((f.top + f.height) * imageH);
    const width = Math.min(imageW, right) - left;
    const height = Math.min(imageH, bottom) - top;
    if (!(width > 0 && height > 0) || left < 0 || top < 0) return null;
    return { left, top, width, height };
}
