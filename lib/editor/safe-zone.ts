/**
 * Перевірка тексту на лінію обрізу — те, чого в конструкторі не було.
 *
 * Правила давно описані і навіть намальовані: /print?guides=1 показує лінію
 * обрізу, безпечну зону і зону корінця, а числа для них рахує
 * lib/print/trim-guides.ts із реальних розмірів друкарні. Але малюнок живе
 * ТАМ, де рішення вже прийнято, а приймається воно в конструкторі. Через це
 * клієнт спокійно кладе заголовок на зріз і зберігає макет, дизайнер потім
 * вручну посуває кожен такий блок на кожному розвороті, а менеджер пише лист
 * «бачимо, ви розміщували текст близько до краю, і все гаразд?». На TM-001257
 * так вийшло шість розворотів плюс обкладинка.
 *
 * Тут та сама геометрія застосовується до текстових блоків.
 *
 * ЧОМУ ЦЕ ПЕРЕПИСАНО (TM-001352, Діана, 2026-09-22).
 * Перша версія не міряла коробку блока, а ОЦІНЮВАЛА її: блок без збереженої
 * ширини вважався найширшим, яким він може стати, тобто рівно 90 % сторінки.
 * Насправді такий блок має `width: max-content` і тулиться до тексту, тож
 * «Ім'я: ІРЕН» кеглем 21 займає 24 % сторінки, а не 90. Наслідок арифметичний
 * і невблаганний: коробка «шириною 90 %» виходить за поле щоразу, коли якір не
 * стоїть майже по центру, і попередження спрацьовувало на кожному блоці з
 * x поза проміжком 46–54 %. На глянцевому журналі TM-001352 воно назвало десять
 * блоків, з яких дев'ять не наближалися до жодної лінії ближче ніж на 6 % —
 * а десятий заходив у безпечну зону на 0,5 мм і до ножа мав ще 1,2 мм.
 * По вертикалі та сама перевірка дивилась лише на ТОЧКУ якоря, тобто на
 * середину блока, тож підпис заввишки 12 % сторінки з якорем на 94 % не
 * помічався взагалі, хоча половина його висоти йде вниз.
 *
 * Тому тепер коробку МІРЯЄМО (lib/editor/text-fit.ts, measureTextBoxPx —
 * той самий розрахунок, яким рендериться сам блок), і міряємо обидві осі.
 * Клієнтові, який один раз побачив попередження на правильному макеті,
 * наступне попередження вже нічого не скаже, тож хибне спрацювання коштує
 * рівно стільки ж, скільки пропущене.
 *
 * ДВІ ЛІНІЇ, А НЕ ОДНА. Раніше текст повідомлення казав «виходить за лінію
 * обрізу» про будь-яке порушення, хоча порівняння йшло з безпечною зоною —
 * це різні лінії, і між ними в журналі 3 мм. Тепер рівні розділені:
 *   · 'trim'   — коробка перетнула сам периметр сторінки, на друці зріже;
 *   · 'safety' — коробка всередині, але зайшла в безпечну зону, тобто ризикує
 *                потрапити під похибку різака.
 *
 * ГЕОМЕТРІЯ, І ЧОМУ ВОНА НЕ ОЧЕВИДНА.
 * Безпечні відступи приходять як частки РОЗВОРОТУ (див. buildTrimGuides:
 * safetyPct рахується від finished.w і finished.h). А блок позиціонується
 * проти того контейнера, у якому його малюють: у фотокнизі це весь розворот,
 * у журналі й тревелбуку — одна сторінка. Сторінка вдвічі вужча за розворот,
 * тож горизонтальний відступ для неї вдвічі більший за частку розвороту; по
 * вертикалі перерахунку немає. Переплутати ці дві осі означає або пропускати
 * реальні порушення, або блокувати правильні макети, тож перерахунок стоїть
 * тут один раз, вмикається прапорцем контейнера і покритий тестами.
 *
 * Лінія обрізу — це сам периметр контейнера (0 і 100 %): полотно конструктора
 * показує ФІНІШНИЙ розмір, дзеркальний припуск рендер-сервіс добудовує ззовні
 * вже під час генерації файлів. Те саме сказано в trim-guides.ts, і саме тому
 * перевірка не шукає лінію обрізу десь усередині.
 */

import { measureTextBoxPx, type BoxInput } from '@/lib/editor/text-fit';

export interface SafeZoneFractions {
    /** Частки ФІНІШНОГО РОЗВОРОТУ, як їх віддає buildTrimGuides (0..1). */
    top: number;
    bottom: number;
    left: number;
    right: number;
}

export interface TextBlockLike {
    id: string;
    text?: string;
    x: number;
    y: number;
    /** Ширина коробки у відсотках контейнера. Не задано — коробка тулиться до тексту. */
    w?: number | null;
}

/** Виміряна коробка блока у відсотках контейнера, проти якого він стоїть. */
export interface MeasuredBox {
    widthPct: number;
    heightPct: number;
}

export type ViolationSide = 'top' | 'bottom' | 'left' | 'right';

/** 'trim' — коробка за периметром сторінки; 'safety' — всередині, але в безпечній зоні. */
export type ViolationLevel = 'trim' | 'safety';

export interface ViolationEdge {
    side: ViolationSide;
    level: ViolationLevel;
    /** Наскільки коробка зайшла за лінію цього рівня, мм. */
    overshootMm: number;
}

export interface SafeZoneViolation {
    pageIndex: number;
    blockId: string;
    /** Перші слова блока — щоб у списку було видно, про який саме текст ідеться. */
    excerpt: string;
    /** Найгірший рівень серед боків: 'trim' переважає 'safety'. */
    level: ViolationLevel;
    sides: ViolationEdge[];
    /** Межі коробки у відсотках контейнера — на них малюється підсвітка. */
    box: { left: number; right: number; top: number; bottom: number };
}

/**
 * Поріг, нижче якого про вихід не говоримо, мм.
 *
 * Півміліметра — це менше за товщину лінії, якою малюють саму безпечну зону, і
 * менше за похибку обміру коробки (рамка блока, округлення пікселів, різниця
 * шрифтових метрик між машинами). Попередження про такий вихід нічого не
 * змінює в макеті, зате вчить не читати попередження.
 */
export const MIN_OVERSHOOT_MM = 0.5;

export interface SafeZoneOptions {
    /**
     * Коробка блока у відсотках контейнера. Повертає null там, де виміряти
     * неможливо — такий блок пропускаємо, бо вигадана коробка гірша за жодну.
     */
    measure: (block: TextBlockLike, pageIndex: number) => MeasuredBox | null;
    /** Розмір контейнера в мм — щоб казати вихід у міліметрах, а не у відсотках. */
    containerMm: { w: number; h: number };
    /** true — блоки стоять проти цілого розвороту (фотокниги), false — проти сторінки. */
    spreadContainer?: boolean;
    /** Сторінки, які перевіряти не треба (обкладинка має власну геометрію загину). */
    skipPage?: (pageIndex: number) => boolean;
    /** Поріг спрацювання, мм. За замовчуванням MIN_OVERSHOOT_MM. */
    minOvershootMm?: number;
}

/** Відсотки КОНТЕЙНЕРА, у межах яких має лишатися текст. */
export function containerSafeMarginsPct(
    spread: SafeZoneFractions,
    opts: { spreadContainer?: boolean } = {},
): { top: number; bottom: number; left: number; right: number } {
    // Горизонталь рахувалась від ширини розвороту. На сторінці вона вдвічі
    // більша, у розвороті береться як є.
    const hx = opts.spreadContainer ? 1 : 2;
    return {
        top: spread.top * 100,
        bottom: spread.bottom * 100,
        left: spread.left * hx * 100,
        right: spread.right * hx * 100,
    };
}

/** Короткий уривок тексту для списку проблемних сторінок. */
export function excerptOf(text: unknown, max = 40): string {
    const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
    if (!flat) return 'без тексту';
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * Межі коробки блока у відсотках контейнера.
 *
 * Блок малюється з `transform: translate(-50%,-50%)`, тобто ЦЕНТРОВАНИЙ на
 * своєму якорі по обох осях — і в конструкторі, і на сторінці друку. Отже
 * коробка тягнеться на половину своєї ширини вліво і вправо і на половину
 * висоти вгору і вниз.
 */
export function blockBoxPct(block: TextBlockLike, box: MeasuredBox): {
    left: number; right: number; top: number; bottom: number;
} {
    const halfW = box.widthPct / 2;
    const halfH = box.heightPct / 2;
    return {
        left: block.x - halfW,
        right: block.x + halfW,
        top: block.y - halfH,
        bottom: block.y + halfH,
    };
}

/**
 * Один бік: наскільки коробка вийшла і за яку саме лінію.
 *
 * `over` — на скільки відсотків край зайшов за безпечну лінію (додатне число
 * означає порушення). Якщо край перетнув ще й периметр, рівень стає 'trim', і
 * вихід міряється вже від периметра: клієнтові важливо знати, скільки зріже,
 * а не скільки лишилось до безпечної лінії.
 */
function edgeViolation(
    side: ViolationSide,
    edgePct: number,
    marginPct: number,
    /** true — край міряється від 0 (верх/ліво), false — від 100 (низ/право). */
    fromZero: boolean,
    mmPerPct: number,
    minMm: number,
): ViolationEdge | null {
    const insideTrim = fromZero ? edgePct : 100 - edgePct;   // відстань до периметра, %
    const pastTrim = -insideTrim;                            // >0 — вже за периметром
    const pastSafety = marginPct - insideTrim;               // >0 — вже в безпечній зоні

    if (pastTrim > 0) {
        const mm = pastTrim * mmPerPct;
        return mm >= minMm ? { side, level: 'trim', overshootMm: mm } : null;
    }
    if (pastSafety > 0) {
        const mm = pastSafety * mmPerPct;
        return mm >= minMm ? { side, level: 'safety', overshootMm: mm } : null;
    }
    return null;
}

/**
 * Знаходить текстові блоки, що виходять за безпечну зону або за лінію обрізу.
 *
 * `pages` — сторінки макета в тому ж порядку, що в редакторі; індекс у
 * результаті це індекс сторінки в масиві, а не номер, який бачить клієнт:
 * перекладає його на людський підпис той, хто показує список (у редакторі —
 * pageDisplayLabel, бо обкладинка і форзаци номерів не мають).
 */
export function findSafeZoneViolations(
    pages: Array<{ textBlocks?: TextBlockLike[] | null }>,
    spread: SafeZoneFractions,
    opts: SafeZoneOptions,
): SafeZoneViolation[] {
    const margin = containerSafeMarginsPct(spread, { spreadContainer: opts.spreadContainer });
    const minMm = opts.minOvershootMm ?? MIN_OVERSHOOT_MM;
    const mmPerPctX = opts.containerMm.w / 100;
    const mmPerPctY = opts.containerMm.h / 100;
    const out: SafeZoneViolation[] = [];

    pages.forEach((page, pageIndex) => {
        if (opts.skipPage?.(pageIndex)) return;
        for (const block of page?.textBlocks || []) {
            if (!block) continue;
            // Порожній блок нічим зрізати: він нічого не друкує.
            if (!String(block.text ?? '').trim()) continue;
            const measured = opts.measure(block, pageIndex);
            if (!measured) continue;

            const box = blockBoxPct(block, measured);
            const sides = [
                edgeViolation('top', box.top, margin.top, true, mmPerPctY, minMm),
                edgeViolation('bottom', box.bottom, margin.bottom, false, mmPerPctY, minMm),
                edgeViolation('left', box.left, margin.left, true, mmPerPctX, minMm),
                edgeViolation('right', box.right, margin.right, false, mmPerPctX, minMm),
            ].filter(Boolean) as ViolationEdge[];

            if (sides.length > 0) {
                out.push({
                    pageIndex,
                    blockId: block.id,
                    excerpt: excerptOf(block.text),
                    level: sides.some(s => s.level === 'trim') ? 'trim' : 'safety',
                    sides,
                    box,
                });
            }
        }
    });

    // Спершу те, що вже ріжеться, далі те, що лише ризикує: перші рядки списку
    // читають завжди, останні — ніколи.
    return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'trim' ? -1 : 1));
}

const SIDE_LABELS: Record<ViolationSide, string> = {
    top: 'згори',
    bottom: 'знизу',
    left: 'ліворуч',
    right: 'праворуч',
};

const fmtMm = (mm: number) => (mm >= 10 ? Math.round(mm).toString() : mm.toFixed(1).replace('.', ','));

/** Один рядок про блок: де він і що саме з ним не так. */
export function describeViolation(
    v: SafeZoneViolation,
    pageLabel: (pageIndex: number) => string = i => `Сторінка ${i + 1}`,
): string {
    const worst = v.sides
        .filter(s => s.level === v.level)
        .sort((a, b) => b.overshootMm - a.overshootMm);
    const where = worst.map(s => `${SIDE_LABELS[s.side]} на ${fmtMm(s.overshootMm)} мм`).join(' і ');
    return v.level === 'trim'
        ? `${pageLabel(v.pageIndex)}: «${v.excerpt}» виходить за лінію обрізу ${where} — на друці цю частину зріже.`
        : `${pageLabel(v.pageIndex)}: «${v.excerpt}» заходить у безпечну зону ${where} — різак може зачепити.`;
}

/**
 * Текст переліку для клієнта — сторінки і те, що на них не так.
 *
 * Списків з довгими переліками ніхто не читає, тому показуємо не більше пʼяти
 * рядків, а решту згортаємо в число.
 */
export function describeViolations(
    violations: SafeZoneViolation[],
    opts: { limit?: number; pageLabel?: (pageIndex: number) => string } = {},
): string {
    if (violations.length === 0) return '';
    const limit = opts.limit ?? 5;
    const lines = violations.slice(0, limit).map(v => describeViolation(v, opts.pageLabel));
    const rest = violations.length - lines.length;
    if (rest > 0) lines.push(`Ще таких блоків: ${rest}.`);
    return lines.join('\n');
}

/**
 * Коробка блока у відсотках контейнера — з тих самих пікселів, якими її малює
 * рендер.
 *
 * Тримається тут, поруч із перевіркою, щоб коробка, яку міряє попередження, і
 * коробка, яку малює рендер, лишались одним розрахунком: розійтись їм — це
 * попередження про блок, що виглядає нормально, тобто рівно та поломка, через
 * яку цей файл переписаний.
 */
export function measureBoxPct(input: BoxInput, canvasHpx: number): MeasuredBox | null {
    if (!(canvasHpx > 0) || !(input.containerPx > 0)) return null;
    const px = measureTextBoxPx(input);
    if (!px) return null;
    return {
        widthPct: (px.widthPx / input.containerPx) * 100,
        heightPct: (px.heightPx / canvasHpx) * 100,
    };
}
