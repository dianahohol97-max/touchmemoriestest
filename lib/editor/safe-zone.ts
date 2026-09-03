import { textBoxPct, TEXT_BOX_MAX_PCT } from '@/lib/editor/text-fit';

/**
 * Перевірка тексту на безпечну зону — те, чого в конструкторі не було.
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
 * ГЕОМЕТРІЯ, І ЧОМУ ВОНА НЕ ОЧЕВИДНА.
 * Безпечні відступи приходять як частки РОЗВОРОТУ (див. buildTrimGuides:
 * safetyPct рахується від finished.w і finished.h). Текстовий блок живе на
 * ОДНІЙ сторінці, і його x — це відсоток ширини сторінки. Розворот удвічі
 * ширший за сторінку, тож горизонтальний відступ для сторінки вдвічі більший
 * за частку розвороту. По вертикалі сторінка й розворот однакові, там
 * перерахунку немає. Переплутати ці дві осі означає або пропускати реальні
 * порушення, або блокувати правильні макети — обидва варіанти дорогі, тож
 * перерахунок стоїть тут один раз і покритий тестами.
 *
 * ЩО САМЕ МІРЯЄМО. У блока немає збереженої висоти: вона залежить від шрифту,
 * кегля й переносів, тобто від браузера. Тому перевіряємо ГОРИЗОНТАЛЬНІ межі
 * коробки блока (їх видно з x, w і вирівнювання) і ВЕРТИКАЛЬНУ позицію
 * якоря. Це свідомо консервативно: ми не вигадуємо висоту, якої не знаємо, і
 * не лякаємо клієнта здогадками. Практика зі звіту це підтверджує — саме
 * якір верхнього рядка й опинявся за лінією.
 */

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
    /** Ширина коробки у відсотках сторінки. Не задано — коробка тулиться до тексту. */
    w?: number | null;
}

export interface SafeZoneViolation {
    pageIndex: number;
    blockId: string;
    /** Перші слова блока — щоб у списку було видно, про який саме текст ідеться. */
    excerpt: string;
    /** Які саме межі порушено. */
    sides: Array<'top' | 'bottom' | 'left' | 'right'>;
}

/** Відсотки сторінки, у межах яких має лишатися текст. */
export function pageSafeMarginsPct(spread: SafeZoneFractions): {
    top: number; bottom: number; left: number; right: number;
} {
    return {
        top: spread.top * 100,
        bottom: spread.bottom * 100,
        // Горизонталь рахувалась від ширини розвороту — на сторінці вона вдвічі більша.
        left: spread.left * 2 * 100,
        right: spread.right * 2 * 100,
    };
}

/** Короткий уривок тексту для списку проблемних сторінок. */
export function excerptOf(text: unknown, max = 40): string {
    const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
    if (!flat) return 'без тексту';
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * Горизонтальні межі коробки блока у відсотках сторінки.
 *
 * Блок позиціонується якорем x із центруванням по горизонталі — так його
 * малює і редактор, і рендер. Ширина або задана явно, або блок тягнеться до
 * TEXT_BOX_MAX_PCT. Беремо ширину як верхню оцінку: коробка вужча за текст
 * ніколи не буває, а ширша — буває, і саме широка коробка виїжджає за зріз.
 */
export function blockHorizontalSpan(block: TextBlockLike): { left: number; right: number } {
    const width = textBoxPct(block.w) ?? TEXT_BOX_MAX_PCT;
    const half = width / 2;
    return { left: block.x - half, right: block.x + half };
}

/**
 * Знаходить текстові блоки, що виходять за безпечну зону.
 *
 * `pages` — сторінки макета в тому ж порядку, що в редакторі; індекс у
 * результаті це індекс сторінки, а не розвороту, бо посувати доведеться
 * конкретний блок на конкретній сторінці.
 */
export function findSafeZoneViolations(
    pages: Array<{ textBlocks?: TextBlockLike[] | null }>,
    spread: SafeZoneFractions,
): SafeZoneViolation[] {
    const margin = pageSafeMarginsPct(spread);
    const out: SafeZoneViolation[] = [];

    pages.forEach((page, pageIndex) => {
        for (const block of page?.textBlocks || []) {
            if (!block) continue;
            const sides: SafeZoneViolation['sides'] = [];
            const span = blockHorizontalSpan(block);

            if (block.y < margin.top) sides.push('top');
            if (block.y > 100 - margin.bottom) sides.push('bottom');
            if (span.left < margin.left) sides.push('left');
            if (span.right > 100 - margin.right) sides.push('right');

            if (sides.length > 0) {
                out.push({ pageIndex, blockId: block.id, excerpt: excerptOf(block.text), sides });
            }
        }
    });

    return out;
}

const SIDE_LABELS: Record<'top' | 'bottom' | 'left' | 'right', string> = {
    top: 'верх',
    bottom: 'низ',
    left: 'ліворуч',
    right: 'праворуч',
};

/**
 * Текст попередження для клієнта — перелік сторінок і того, що на них не так.
 *
 * Списків з довгими переліками ніхто не читає, тому показуємо не більше пʼяти
 * рядків, а решту згортаємо в число.
 */
export function describeViolations(violations: SafeZoneViolation[], limit = 5): string {
    if (violations.length === 0) return '';
    const lines = violations.slice(0, limit).map(v =>
        `Сторінка ${v.pageIndex + 1}: «${v.excerpt}» виходить за межу ${v.sides.map(s => SIDE_LABELS[s]).join(' і ')}.`,
    );
    const rest = violations.length - lines.length;
    if (rest > 0) lines.push(`Ще таких блоків: ${rest}.`);
    return lines.join('\n');
}
