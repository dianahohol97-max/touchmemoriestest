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

/**
 * ПОРЯДОК АРКУШІВ ГЛЯНЦЕВОГО ЖУРНАЛУ З М'ЯКОЮ ОБКЛАДИНКОЮ.
 *
 * Друкарня бере один PDF на весь журнал і друкує його як є, тож порядок тут —
 * це фізичний порядок аркушів у брошурі, а не спосіб їх показати:
 *
 *     передня обкладинка → форзац 1 → сторінки 01…NN → форзац 2 → задня
 *
 * Форзац у м'якій обкладинці — це не окремий аркуш паперу, а внутрішній бік
 * самої обкладинки: форзац 1 стоїть зворотом передньої, форзац 2 — зворотом
 * задньої. Саме тому вони не можуть лежати деінде, і саме тому пропуск одного
 * з них зсуває ВСЕ: сторінка, яка мала бути правою, стає лівою.
 *
 * ЩО БУЛО НЕ ТАК. Порядок рахував `sortPagesForPdf`, а він знає рівно два
 * правила — обкладинка перша, далі за номером. Обидві половини обкладинки
 * приходять із `page_number = 1` (`exportRowsFromPaths` читає префікс `00_` і
 * для задньої, і для передньої), тож нічия розв'язувалася назвою, а за абеткою
 * `00_cover_back` стоїть раніше за `00_cover_front`. На TM-001352 це дало
 * аркуш 1 — задня обкладинка, аркуш 2 — передня, далі одразу зміст, а задньої
 * обкладинки в кінці немає взагалі.
 *
 * БІЛИЙ АРКУШ НА МІСЦІ ФОРЗАЦА (Діана, 23.09.2026). Рендер-сервіс свідомо не
 * вантажить порожній форзац — друкарня просила не отримувати чистих аркушів
 * JPEG, — і це правило лишається недоторканим: набір у теці не змінюється
 * нічим. Але в ЗІБРАНОМУ PDF місце форзаца мусить бути зайняте, інакше
 * сторінки зсуваються. Умова тут навмисно «файлу немає», а не «не оплачено»:
 * оплату в цьому місці не видно, а за файлом видно правду з обох боків. На
 * TM-001352 форзаци оплачені обидва, а f1 порожній і файлу не має; на
 * TM-001299 форзаци не оплачені, а обидва намальовані й файли є. Питання про
 * оплату переплутало б ці два випадки, і в другому з них білий аркуш затер би
 * малюнок, за який людина вже заплатила своєю роботою.
 *
 * Інші вироби сюди не потрапляють: половинки обкладинки з іменами
 * `00_cover_front.jpg` / `00_cover_back.jpg` робить рівно один шлях —
 * `splitCoverPages` у render-service, тобто журнал із М'ЯКОЮ обкладинкою.
 * Тверда обкладинка лишається одним аркушем-розворотом (`cover.jpg`),
 * фотокнига — розворотами `NN_spread.jpg`, і для них порядок рахує той самий
 * `sortPagesForPdf`, що й раніше.
 */

/** Аркуш майбутнього PDF: або файл, або свідомо порожнє місце форзаца. */
export type PdfSheet<T extends PdfPageFile> =
    | { kind: 'file'; file: T }
    | { kind: 'blank'; label: ForzatSlot };

/** Який саме форзац лишився без файлу. */
export type ForzatSlot = 'f1' | 'f2';

const sheetName = (f: PdfPageFile): string => String(f?.name || '').trim().toLowerCase();

/** Передня половина обкладинки м'якого журналу. */
export function isFrontCoverHalf(f: PdfPageFile): boolean {
    return /^(\d+_)?cover_front\.jpe?g$/i.test(sheetName(f));
}

/** Задня половина обкладинки м'якого журналу. */
export function isBackCoverHalf(f: PdfPageFile): boolean {
    return /^(\d+_)?cover_back\.jpe?g$/i.test(sheetName(f));
}

/** Форзац окремим файлом: `f1.jpg` — початковий, `f2.jpg` — кінцевий. */
export function forzatSlotOf(f: PdfPageFile): ForzatSlot | null {
    const n = sheetName(f);
    if (/^f1\.jpe?g$/i.test(n)) return 'f1';
    if (/^f2\.jpe?g$/i.test(n)) return 'f2';
    return null;
}

/**
 * Пронумерована сторінка журналу або тревелбука: `01.jpg` — нинішня назва,
 * `01_page.jpg` — та сама сторінка за іменем до 11.08.2026. Розворот фотокниги
 * (`01_spread.jpg`) сюди НЕ входить — у журналі його не буває, а сплутати
 * одиницю означало б порахувати сторінки за розвороти.
 */
export function isNumberedPage(f: PdfPageFile): boolean {
    return /^\d+(_page)?\.jpe?g$/i.test(sheetName(f));
}

/**
 * Чи це набір журналу з м'якою обкладинкою.
 *
 * Питаємо в самих файлів, а не в slug виробу. Імена половинок обкладинки
 * народжуються рівно в одному місці коду й іншому виробу дістатися не можуть,
 * тоді як slug приходить із конфігурації макета і на старих замовленнях буває
 * порожнім. Досить однієї половинки: коли друга не відрендерилась, порядок
 * усе одно має бути журнальний.
 */
export function isSoftCoverMagazineSet(files: PdfPageFile[]): boolean {
    return (files || []).some(f => isFrontCoverHalf(f) || isBackCoverHalf(f));
}

/**
 * Аркуші PDF у тому порядку, у якому їх друкують.
 *
 * Для журналу з м'якою обкладинкою — за специфікацією друкарні, з білим
 * аркушем на місці форзаца, якого немає. Для решти виробів — той самий
 * порядок, що був досі.
 *
 * Нічого не губиться. Файл, якого ми не впізнали, їде одразу за
 * пронумерованими сторінками: у теці журналу таких імен не буває, але
 * викинути файл із макета гірше, ніж поставити його не туди — зайве видно
 * очима, а відсутнє помічають уже на папері.
 */
export function buildPdfSheets<T extends PdfPageFile>(files: T[]): PdfSheet<T>[] {
    const list = (files || []).slice();
    if (!isSoftCoverMagazineSet(list)) {
        return sortPagesForPdf(list).map(file => ({ kind: 'file' as const, file }));
    }

    const front = list.filter(isFrontCoverHalf);
    const back = list.filter(isBackCoverHalf);
    const f1 = list.filter(f => forzatSlotOf(f) === 'f1');
    const f2 = list.filter(f => forzatSlotOf(f) === 'f2');
    const pages = sortPagesForPdf(list.filter(isNumberedPage));
    const rest = list.filter(f =>
        !isFrontCoverHalf(f) && !isBackCoverHalf(f) && !forzatSlotOf(f) && !isNumberedPage(f));

    const out: PdfSheet<T>[] = [];
    const push = (arr: T[]) => arr.forEach(file => out.push({ kind: 'file', file }));

    // Білий аркуш ставимо лише тоді, коли в наборі взагалі є сторінки. Набір із
    // самої обкладинки — це впалий рендер, а не журнал без форзаців, і додавати
    // до нього порожні аркуші означало б робити поломку схожою на виріб.
    const blanksMakeSense = pages.length > 0;

    push(front);
    if (f1.length) push(f1);
    else if (blanksMakeSense) out.push({ kind: 'blank', label: 'f1' });
    push(pages);
    push(rest);
    if (f2.length) push(f2);
    else if (blanksMakeSense) out.push({ kind: 'blank', label: 'f2' });
    push(back);

    return out;
}
