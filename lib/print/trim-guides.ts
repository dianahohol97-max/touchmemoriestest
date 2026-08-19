import type { SizeGeometry } from '@/lib/print/geometry';

/**
 * Лінії обрізки для людського перегляду макета на /print (адмінська кнопка
 * «Переглянути макет» відкриває саме його з ?guides=1).
 *
 * Ключовий факт, від якого все рахується: у людському режимі /print показує
 * контентний розворот у ФІНІШНОМУ розмірі — дві цілі сторінки, без аркушевого
 * виступу. Дзеркальний bleed рендер-сервіс добудовує ЗЗОВНІ вже при
 * генерації файлів, і ніж друкарні проходить рівно по межі того, що видно на
 * екрані. Тому:
 *
 *   · лінія обрізу — це ПЕРИМЕТР показаного розвороту (не десь усередині);
 *   · для товарів, що друкуються посторінково (Travel Book, журнали),
 *     розворот додатково ріжеться навпіл по корінцю — це друга лінія обрізу,
 *     і саме нею тревел відрізняється від фотокниги, чий розворот їде в друк
 *     цілим аркушем;
 *   · безпечна зона — відступ від різу, всередині якого мають лишатися текст
 *     і обличчя. Вона своя на кожен товар: рахується з geometry.safety
 *     (photobook_sizes у базі, ніколи не слабша за реальний виступ аркуша),
 *     а для товарів без рядка в базі підпирається мінімумом 3 мм — менше не
 *     буває безпечним у жодній різці.
 *
 * Обкладинка має ВЛАСНІ лінії — buildCoverGuides нижче — і працює це лише
 * тому, що в режимі guides /print рендерить її в пропорції друкарського
 * аркуша (передає printPageW/printPageH/printCoverMm тим самим шляхом, яким
 * ходить рендер-сервіс). На декоративному рендері з корінцем ці лінії
 * брехали б, тому поза guides-режимом їх не існує.
 */

/** Мінімальна безпечна зона, мм. Стандарт різки; підпирає товари без рядка в photobook_sizes. */
export const SAFETY_MIN_MM = 3;

export type TrimGuideSpec = {
    /** Безпечна зона в мм від лінії різу, з боку на бік. */
    safetyMm: { top: number; bottom: number; left: number; right: number };
    /** Те саме у відсотках від ФІНІШНОГО розвороту — для absolute-позиціювання оверлея. */
    safetyPct: { top: number; bottom: number; left: number; right: number };
    /** true — розворот ріжеться навпіл по корінцю (посторінковий друк). */
    cutsAtGutter: boolean;
    /** Розміри для легенди. */
    page: { w: number; h: number };
    finished: { w: number; h: number };
    /** Рядки легенди українською — готові до показу адміну. */
    notes: string[];
};

/**
 * Чи друкується товар посторінково — та сама умова, якою рендер-сервіс
 * вибирає splitToPages (по слагу), плюс product_type, бо старі чернетки
 * редактора зберігали product_type='photobook' для будь-якого товару і
 * правду несе саме збережений слаг.
 */
export function cutsAtGutter(productSlug?: string | null, productType?: string | null): boolean {
    const hay = `${productSlug || ''} ${productType || ''}`.toLowerCase();
    return /travel|magazine|journal|zhurnal|fotozhurnal/.test(hay);
}

export function buildTrimGuides(
    g: SizeGeometry,
    product: { productSlug?: string | null; productType?: string | null },
): TrimGuideSpec {
    const safetyMm = {
        top: Math.max(g.safety.top, SAFETY_MIN_MM),
        bottom: Math.max(g.safety.bottom, SAFETY_MIN_MM),
        left: Math.max(g.safety.left, SAFETY_MIN_MM),
        right: Math.max(g.safety.right, SAFETY_MIN_MM),
    };
    // g.safety виміряний від краю АРКУША, а показаний розворот — фінішний.
    // Відстань безпечної лінії від краю видимого зображення = safety − overhang
    // (частина запасу з'їдається виступом аркуша, який на екрані не видно),
    // але ніколи не менша за мінімум — різ не стає безпечнішим від того, що
    // виступ великий.
    const visTop = Math.max(safetyMm.top - g.overhang.y, SAFETY_MIN_MM);
    const visBottom = Math.max(safetyMm.bottom - g.overhang.y, SAFETY_MIN_MM);
    const visLeft = Math.max(safetyMm.left - g.overhang.x, SAFETY_MIN_MM);
    const visRight = Math.max(safetyMm.right - g.overhang.x, SAFETY_MIN_MM);

    const safetyPct = {
        top: (visTop / g.finished.h) * 100,
        bottom: (visBottom / g.finished.h) * 100,
        left: (visLeft / g.finished.w) * 100,
        right: (visRight / g.finished.w) * 100,
    };

    const gutter = cutsAtGutter(product.productSlug, product.productType);

    const notes: string[] = [
        `Сторінка ${g.page.w}×${g.page.h} мм, розворот ${g.finished.w}×${g.finished.h} мм.`,
        'Червона рамка — лінія обрізу: ніж друкарні проходить по краю видимого розвороту.',
        gutter
            ? 'Червона лінія по центру — розворот ріжеться навпіл по корінцю: цей товар друкується окремими сторінками.'
            : 'Розворот друкується цілим аркушем, по корінцю не ріжеться.',
        `Синя пунктирна — безпечна зона (${describeMm(visTop, visBottom, visLeft, visRight)}): текст, обличчя і важливі деталі мають лишатися всередині неї.`,
    ];

    return {
        safetyMm,
        safetyPct,
        cutsAtGutter: gutter,
        page: { ...g.page },
        finished: { ...g.finished },
        notes,
    };
}

function describeMm(top: number, bottom: number, left: number, right: number): string {
    const all = [top, bottom, left, right];
    if (all.every(v => v === all[0])) return `${fmt(all[0])} мм від різу`;
    return `${fmt(top)} мм згори, ${fmt(bottom)} знизу, ${fmt(left)} зліва, ${fmt(right)} справа`;
}

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

// ── Обкладинка ─────────────────────────────────────────────────────────────

/**
 * Поля загину аркуша обкладинки, мм по осях — специфікація друкарні
 * (травень 2026). ТА САМА таблиця живе в BookLayoutEditor
 * (COVER_BLEED_MARGINS, частками аркуша) і малює клієнтові лінію в
 * конструкторі: міняється специфікація — міняються ОБИДВА місця, а тест
 * «лінія загину в адмінці збігається з конструкторською» тримає їх разом.
 * 23×23 в специфікації немає — конструктор показує їй 6% аркуша, і адмінка
 * чесно показує ті самі 6%, а не вигадані міліметри.
 */
const COVER_FOLD_MM: Record<string, { tb: number; lr: number }> = {
    '20x20': { tb: 18, lr: 18 },
    '25x25': { tb: 18, lr: 20 },
    '20x30': { tb: 18, lr: 20 },
    '30x20': { tb: 18, lr: 20 },
    '30x30': { tb: 18, lr: 20 },
    // Travel Book / журнали з твердою обкладинкою: 20 мм з КОЖНОГО боку
    // (Діана, 2026-08-11: «з урахуванням полів 20 мм з кожної сторони»).
    'A4': { tb: 20, lr: 20 },
    'magazine-A4': { tb: 20, lr: 20 },
    'travelbook': { tb: 20, lr: 20 },
};

const COVER_FOLD_PCT_FALLBACK = 6; // % аркуша — як у конструкторі для 23×23

export type CoverGuideSpec = {
    /** Відсотки від аркуша обкладинки — для absolute-позиціювання. */
    foldPct: { top: number; bottom: number; left: number; right: number };
    /** Міліметри для легенди; null, коли специфікація знає лише відсотки. */
    foldMm: { tb: number; lr: number } | null;
    cover: { w: number; h: number };
    notes: string[];
};

export function buildCoverGuides(g: SizeGeometry): CoverGuideSpec | null {
    if (!(g.cover.w > 0 && g.cover.h > 0)) return null;

    const mm = COVER_FOLD_MM[g.sizeKey] ?? null;
    const foldPct = mm
        ? {
            top: (mm.tb / g.cover.h) * 100,
            bottom: (mm.tb / g.cover.h) * 100,
            left: (mm.lr / g.cover.w) * 100,
            right: (mm.lr / g.cover.w) * 100,
        }
        : {
            top: COVER_FOLD_PCT_FALLBACK,
            bottom: COVER_FOLD_PCT_FALLBACK,
            left: COVER_FOLD_PCT_FALLBACK,
            right: COVER_FOLD_PCT_FALLBACK,
        };

    const notes = [
        `Аркуш обкладинки ${g.cover.w}×${g.cover.h} мм — показаний у друкарській пропорції, разом із полями загину.`,
        mm
            ? `Помаранчева пунктирна — лінія загину: ${mm.tb === mm.lr ? `${mm.tb} мм з кожного боку` : `${mm.tb} мм згори і знизу, ${mm.lr} мм зліва і справа`} загортається на картон. Важливе на обкладинці має лишатися всередині цієї лінії.`
            : `Помаранчева пунктирна — лінія загину: ${COVER_FOLD_PCT_FALLBACK}% аркуша з кожного боку загортається на картон, як показує і конструктор.`,
    ];

    return { foldPct, foldMm: mm, cover: { ...g.cover }, notes };
}

/**
 * Як укладати ГОТОВИЙ файл обкладинки (printedBgImage — шаблони тревел-буків
 * і журналів) на передню половину аркуша.
 *
 * Раніше картинка натягувалась objectFit:cover на всю половину аркуша разом
 * із полями загину, тож у шаблона, намальованого «впритул», заголовок їхав
 * за кант (Діана, 2026-08-19, скрін «HELSINKI»). Тепер чітка картинка сідає
 * ДО лінії загину, а самі поля добудовуються з неї ж — розмитою підкладкою,
 * яка для плоского фону дає рівно той самий колір, а для строкатого — м'яке
 * продовження без чужих кольорів і швів.
 *
 * Відсотки рахуються від передньої ПОЛОВИНИ аркуша (ширина W/2, висота H):
 * top/bottom — tb-загин, outer — lr-загин зовнішнього краю; внутрішній край
 * (до корінця) лишається нульовим, бо там не загин, а згин корінця.
 * Повертає null для розмірів без міліметрів у специфікації і для товарів,
 * яких це не стосується, — викликач тоді малює по-старому.
 */
export function coverArtworkInset(g: SizeGeometry | null): { topPct: number; bottomPct: number; outerPct: number } | null {
    if (!g || !(g.cover.w > 0 && g.cover.h > 0)) return null;
    const mm = COVER_FOLD_MM[g.sizeKey];
    if (!mm) return null;
    return {
        topPct: (mm.tb / g.cover.h) * 100,
        bottomPct: (mm.tb / g.cover.h) * 100,
        outerPct: (mm.lr / (g.cover.w / 2)) * 100,
    };
}
