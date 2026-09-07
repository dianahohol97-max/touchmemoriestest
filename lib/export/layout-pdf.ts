/**
 * Готовий макет одним PDF замість купи окремих JPEG.
 *
 * Друкарня просила саме це (Мацьопа, 07.09.2026): «якщо журнал з сайту і
 * зроблений ок, у нас всеодно подвійна робота — прогнати всі сторінки через
 * канву, бо чат скачує окремі зображення. можна щоб генерувало pdf?». Тобто
 * макет міг бути бездоганним, а зайва година роботи на кожне замовлення
 * витрачалася лише тому, що сторінки їхали россипом і хтось збирав їх у файл
 * руками.
 *
 * Складання відбувається в браузері з тих самих підписаних посилань, з яких
 * уже збирається ZIP. Сервер тут не потрібен: рендер сторінок давно зроблено,
 * PDF лише кладе готові JPEG по одному на сторінку, не перекодовуючи їх.
 *
 * ГЕОМЕТРІЯ. Сторінка PDF робиться рівно під розмір зображення при 300 DPI, а
 * зображення кладеться в неї від краю до краю. Не «A4 і вписати всередину»:
 * розворот журналу ширший за A4, і вписування дало б білі поля навколо
 * макета, тобто той самий брак, від якого ми тікаємо. Друкарня отримує аркуш
 * тих міліметрів, які замовлено.
 */

/** Усі експорти рендеряться в 300 DPI — під ту саму сітку робиться й сторінка. */
export const PRINT_DPI = 300;

const MM_PER_INCH = 25.4;

export interface PdfPageSize {
    w: number;
    h: number;
    /**
     * jsPDF примусово міняє сторони місцями, якщо орієнтація не збігається з
     * форматом: portrait робить ширину меншою за висоту, landscape навпаки.
     * Тому орієнтацію рахуємо тут із самих розмірів, а не вгадуємо.
     */
    orientation: 'portrait' | 'landscape';
}

/** Розмір сторінки PDF у міліметрах під зображення заданого розміру в пікселях. */
export function pageSizeMm(widthPx: number, heightPx: number, dpi: number = PRINT_DPI): PdfPageSize {
    const safeDpi = Number.isFinite(dpi) && dpi > 0 ? dpi : PRINT_DPI;
    const px = (v: number) => (Number.isFinite(v) && v > 0 ? v : 1);
    const w = (px(widthPx) / safeDpi) * MM_PER_INCH;
    const h = (px(heightPx) / safeDpi) * MM_PER_INCH;
    return {
        w: Math.round(w * 100) / 100,
        h: Math.round(h * 100) / 100,
        orientation: w > h ? 'landscape' : 'portrait',
    };
}

export interface PdfPageFile {
    name?: string | null;
    page_number?: number | null;
    isCover?: boolean;
}

/**
 * Порядок сторінок у PDF.
 *
 * Обкладинка перша, далі за номером сторінки, а коли номера немає — за
 * назвою. Порядок тут не косметика: друкарня бере файл і друкує його як є,
 * тож сторінка не на своєму місці означає брошуру не в тому порядку.
 * Сортуємо назви природно, щоб «10.jpg» стояло після «9.jpg», а не між «1» і
 * «2», — саме на цьому ламається звичайне сортування рядків.
 */
export function sortPagesForPdf<T extends PdfPageFile>(files: T[]): T[] {
    const naturally = (a: string, b: string) =>
        a.localeCompare(b, 'uk', { numeric: true, sensitivity: 'base' });

    return [...files].sort((a, b) => {
        if (!!a.isCover !== !!b.isCover) return a.isCover ? -1 : 1;
        const an = typeof a.page_number === 'number' ? a.page_number : null;
        const bn = typeof b.page_number === 'number' ? b.page_number : null;
        if (an !== null && bn !== null && an !== bn) return an - bn;
        if (an !== null && bn === null) return -1;
        if (an === null && bn !== null) return 1;
        return naturally(String(a.name || ''), String(b.name || ''));
    });
}
