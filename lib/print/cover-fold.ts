import { deriveGeometry, mmToPx } from '@/lib/print/geometry';
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

/**
 * Чи підходить файл обкладинки під друкарський формат, і що з ним станеться.
 *
 * Два різні прямокутники, і плутати їх не можна.
 *
 * АРКУШ — уся передня половина друкованого файлу, 235×328 мм для тревелбука,
 * тобто 2776×3874 пікселі у 300 DPI. Це ідеал для підготовленого файлу: він
 * покриває і те, що видно, і поле загину, яке загортається на картон.
 *
 * ВИДИМА ПЛОЩИНА — те, що лишається на передній стінці книги після загину,
 * 210×288 мм. Саме в неї вписується готова обкладинка в теперішньому режимі
 * (`contain`), тож файл, чия пропорція не збігається з площиною, не ріжеться —
 * з боків або згори лишається смуга кольору тла.
 *
 * Ці числа потрібні формі завантаження, щоб сказати людині правду до того, як
 * обкладинка потрапить у каталог, а не після першого надрукованого примірника.
 */
export type CoverArtworkFit = {
    /** Ідеал: повна передня половина аркуша в пікселях. */
    sheetPx: { w: number; h: number };
    /** Видима площина в пікселях і міліметрах. */
    facePx: { w: number; h: number };
    faceMm: { w: number; h: number };
    /** Роздільність, з якою файл ляже на друк. 300 і більше — добре. */
    dpi: number;
    /** Пропорція файлу збігається з аркушем (з допуском у півпроцента). */
    matchesSheet: boolean;
    /** Файл не менший за аркуш по обох сторонах. */
    coversSheet: boolean;
    /** Смуга кольору тла, яка лишиться при вписуванні у видиму площину. */
    band: { axis: 'x' | 'y'; mm: number; pct: number } | null;
    /** Скільки зрізалося б, якби картинка заповнювала аркуш повністю. */
    legacyCrop: { axis: 'x' | 'y'; pctPerSide: number } | null;
};

export function coverArtworkFit(sizeKey: string, imageW: number, imageH: number): CoverArtworkFit | null {
    if (!(imageW > 0 && imageH > 0)) return null;
    const g = deriveGeometry(sizeKey);
    if (!g || !(g.cover.w > 0 && g.cover.h > 0)) return null;

    const inset = frontCoverInset(sizeKey);
    const halfMm = { w: g.cover.w / 2, h: g.cover.h };
    const faceMm = {
        w: halfMm.w * (1 - inset.left - inset.right),
        h: halfMm.h * (1 - inset.top - inset.bottom),
    };
    // Половина аркуша рахується з ЦІЛОГО аркуша і ділиться навпіл — саме так
    // ділить його рендер-сервіс (Math.round(pxW / 2)). Округлити половину
    // окремо означало б розійтися з ним на піксель.
    const sheetPx = { w: Math.round(mmToPx(g.cover.w) / 2), h: mmToPx(g.cover.h) };
    const facePx = { w: mmToPx(faceMm.w), h: mmToPx(faceMm.h) };

    const imgAspect = imageW / imageH;
    const sheetAspect = sheetPx.w / sheetPx.h;
    const matchesSheet = Math.abs(imgAspect - sheetAspect) / sheetAspect <= 0.005;
    const coversSheet = imageW >= sheetPx.w && imageH >= sheetPx.h;

    // Вписування у видиму площину: менший із двох коефіцієнтів.
    const k = Math.min(facePx.w / imageW, facePx.h / imageH);
    const drawn = { w: imageW * k, h: imageH * k };
    const dpi = Math.round(300 / k);

    let band: CoverArtworkFit['band'] = null;
    const gapX = facePx.w - drawn.w;
    const gapY = facePx.h - drawn.h;
    if (gapX > 1) {
        band = { axis: 'x', mm: (gapX / facePx.w) * faceMm.w / 2, pct: (gapX / facePx.w) * 100 / 2 };
    } else if (gapY > 1) {
        band = { axis: 'y', mm: (gapY / facePx.h) * faceMm.h / 2, pct: (gapY / facePx.h) * 100 / 2 };
    }

    // Те саме для старого режиму, коли картинка заповнює аркуш і виступ
    // ріжеться. Уже оформлені замовлення досі так і рендеряться.
    let legacyCrop: CoverArtworkFit['legacyCrop'] = null;
    const kc = Math.max(sheetPx.w / imageW, sheetPx.h / imageH);
    const over = { w: imageW * kc - sheetPx.w, h: imageH * kc - sheetPx.h };
    if (over.h > 1) legacyCrop = { axis: 'y', pctPerSide: (over.h / (imageH * kc)) * 100 / 2 };
    else if (over.w > 1) legacyCrop = { axis: 'x', pctPerSide: (over.w / (imageW * kc)) * 100 / 2 };

    return { sheetPx, facePx, faceMm, dpi, matchesSheet, coversSheet, band, legacyCrop };
}
