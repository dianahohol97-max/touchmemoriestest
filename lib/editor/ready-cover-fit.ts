import { deriveGeometry } from '@/lib/print/geometry';
import { COVER_FOLD_MM } from '@/lib/print/trim-guides';

/**
 * Як готова обкладинка з каталогу лягає на передню половину аркуша.
 *
 * `cover` — стара поведінка: картинка заповнює половину аркуша з обрізанням.
 * Файли каталогу мають пропорцію 2:3, а передня половина аркуша тревелбука —
 * 235×328 мм, тобто 0,7165. Картинка вужча, тож вона розтягується по ширині, а
 * висота вилазить і ріжеться: 3,49 % згори і стільки ж знизу ще до друку, а
 * потім по 20 мм з кожного боку загортається на картон. Від зображення до
 * передньої площини книги доживає близько 73 %, і верхній та нижній ряди
 * декоративної рамки зникають гарантовано (TM-001354, книга 4, «Аргентина»).
 *
 * `contain` — картинка вписується у ВИДИМУ площину, тобто всередину лінії
 * загину, а решта аркуша заливається кольором тла. Нічого не ріжеться.
 *
 * ЧОМУ РЕЖИМ ЗБЕРІГАЄТЬСЯ В МАКЕТІ, А НЕ ПРОСТО МІНЯЄТЬСЯ В КОДІ. Уже оформлені
 * замовлення клієнтки бачили і погодили в старому вигляді. Перерендер таких
 * макетів — справа звичайна (заміна файлу, доповнення набору), і він мусить
 * дати те саме, що вже погоджено. Тому режим призначається в мить вибору
 * обкладинки і живе в cover_data: нові макети дістають `contain`, старі
 * лишаються на `cover`, бо поля в них просто немає.
 */
export type ReadyCoverFit = 'cover' | 'contain';

/** Макет без збереженого режиму — це макет, зроблений до цієї зміни. */
export const READY_COVER_FIT_LEGACY: ReadyCoverFit = 'cover';
/** Режим, який дістає кожна щойно обрана готова обкладинка. */
export const READY_COVER_FIT_NEW: ReadyCoverFit = 'contain';

export type FrontCoverInset = { top: number; bottom: number; left: number; right: number };

/** Коли специфікація загину невідома — стільки ж, скільки показує конструктор для 23×23. */
const FALLBACK_INSET = 0.06;

/**
 * Відступи видимої площини від країв ПЕРЕДНЬОЇ ПОЛОВИНИ аркуша, у частках цієї
 * половини.
 *
 * Зліва це половина корінця, справа — поле загину, згори й знизу — воно ж.
 * Ширина корінця не задана окремо ніде: вона є рештою аркуша після двох
 * сторінок і двох полів загину, і для тревелбука виходить 10 мм.
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
 * Готова розмітка картинки готової обкладинки на передній половині аркуша.
 *
 * Повертає стиль обгортки (заливка) і стиль самої картинки. Одна функція на
 * конструктор, прев'ю і друк: три копії цієї арифметики розійшлися б, і тоді
 * клієнтка бачила б одне, а друкарня отримувала інше.
 */
export function readyCoverLayout(
    fit: ReadyCoverFit | undefined,
    sizeKey: string,
    fillColor: string | undefined,
): { wrap: React.CSSProperties; image: React.CSSProperties } {
    if ((fit || READY_COVER_FIT_LEGACY) !== 'contain') {
        return {
            wrap: { position: 'absolute', inset: 0 },
            image: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
        };
    }
    const inset = frontCoverInset(sizeKey);
    const pct = (v: number) => `${v * 100}%`;
    return {
        wrap: { position: 'absolute', inset: 0, background: fillColor || '#ffffff', overflow: 'hidden' },
        image: {
            position: 'absolute',
            left: pct(inset.left),
            top: pct(inset.top),
            width: pct(1 - inset.left - inset.right),
            height: pct(1 - inset.top - inset.bottom),
            objectFit: 'contain',
        },
    };
}
