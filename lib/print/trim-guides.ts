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
 * Обкладинки тут НЕМАЄ навмисно: у людському режимі /print малює її з
 * декоративним корінцем, і пропорція показаного НЕ дорівнює друкарському
 * аркушу обкладинки (470×328 з загином) — намальовані на ній лінії брехали б.
 * Замість ліній легенда чесно каже, що обкладинка перевіряється окремо.
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
        'Обкладинка тут показана з декоративним корінцем і перевіряється окремо — її друкарський аркуш має власні поля загину.',
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
