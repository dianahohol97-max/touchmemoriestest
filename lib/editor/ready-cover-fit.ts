import { coverArtworkFit, frontCoverInset, type FrontCoverInset } from '@/lib/print/cover-fold';

// Геометрія загину живе в lib/print, бо це специфікація друкарні, а не
// редакторська дрібниця: на тих самих числах стоїть вирізання передньої
// обкладинки окремим файлом для адмінки.
export { frontCoverInset };
export type { FrontCoverInset };

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

/**
 * Який режим дістає обкладинка, судячи з самого файлу.
 *
 * ПРАВИЛО ОДНЕ: збігається пропорція з аркушем — заповнюємо аркуш, не
 * збігається — вписуємо у видиму площину.
 *
 * Чому так. Заповнення ріже рівно стільки, на скільки пропорція файлу
 * розходиться з пропорцією аркуша. Коли вони збігаються, різати нема чого, і
 * тоді заповнення строго краще за вписування: картинка накриває і поле загину,
 * яке загортається на картон, замість лишати там рівну заливку. Коли ж
 * пропорції різні — а такі всі сто нинішніх файлів каталогу, вони 2:3 проти
 * 0,717 в аркуша, — заповнення зрізало б орнамент, і виграє вписування.
 *
 * Допуск у півпроцента лишає місце на округлення: 2776×3874 і будь-який файл,
 * підготовлений під той самий аркуш у іншому масштабі, читаються однаково.
 *
 * Роздільність на рішення НЕ впливає. Малий файл із правильною пропорцією
 * заповнить аркуш без жодного зрізу, просто нерізко, і вписування його
 * різкішим не зробить — воно лише додасть смуг.
 */
export function readyCoverFitForArtwork(sizeKey: string, imageW: number, imageH: number): ReadyCoverFit {
    const fit = coverArtworkFit(sizeKey, imageW, imageH);
    return fit?.matchesSheet ? 'cover' : READY_COVER_FIT_NEW;
}

/**
 * Те саме, але для картинки, яку ще треба виміряти.
 *
 * Розміри читаються з самого файлу, а не з бази: у каталозі їх немає, а
 * картинка на цей момент уже в кеші браузера — її щойно показали в переліку
 * обкладинок. Будь-яка невдача повертає вписування, бо воно не ріже нічого:
 * помилитися в бік цілої картинки зі смугами дешевше, ніж у бік зрізаного
 * орнаменту.
 */
export function resolveReadyCoverFit(imageUrl: string, sizeKey: string): Promise<ReadyCoverFit> {
    return new Promise(resolve => {
        if (typeof document === 'undefined' || !imageUrl) return resolve(READY_COVER_FIT_NEW);
        try {
            const img = new window.Image();
            img.onload = () => resolve(readyCoverFitForArtwork(sizeKey, img.naturalWidth, img.naturalHeight));
            img.onerror = () => resolve(READY_COVER_FIT_NEW);
            img.src = imageUrl;
        } catch { resolve(READY_COVER_FIT_NEW); }
    });
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
