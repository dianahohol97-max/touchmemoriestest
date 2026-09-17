/**
 * Біла смужка по краю друкованого аркуша.
 *
 * Розворот фотокниги їде у друк АРКУШЕМ, разом із вильотом: друкарня перевіряє
 * розмір і повертає файл, у якому виліт зрізано (див. strip-bleed). Виліт має
 * бути заповнений продовженням малюнка, щоб ніж міг гуляти на міліметр і
 * сторінка все одно лишалась без полів.
 *
 * На TM-001254 він заповнений не до кінця: по лівому й правому краю лишається
 * тонка біла смужка в кілька пікселів. Після обрізки така смужка стає білою
 * рискою на готовій сторінці — тим самим браком, від якого виліт і рятує.
 * Перегенерація не допомагає: смужку робить сам сервіс рендеру, тож кожен
 * новий файл виходить такий самий.
 *
 * ЩО РОБИМО. Не ріжемо — розмір аркуша чіпати не можна, друкарня його
 * перевіряє. Замість цього білі лінії по краю замінюємо найближчою НЕбілою
 * лінією, тобто продовжуємо малюнок назовні рівно так, як виліт і мав бути
 * заповнений. Пікселі всередині готового розміру не змінюються взагалі.
 *
 * ЗАПОБІЖНИК. Біла сторінка макета — теж біла з краю, і «полагодити» її
 * означало б розтягнути по ній випадковий піксель. Тому шукаємо смужку лише в
 * межах вильоту: усе, що ширше за виліт, вважаємо задумом автора і файл не
 * чіпаємо.
 *
 * МЕЖУ ТРЕБА ПЕРЕДАВАТИ, І ПО КОЖНІЙ ОСІ ОКРЕМО (TM-001254, 17.09.2026). Тут
 * стояло 2% на обидві осі, бо на більшості розмірів виліт саме такий. На 20×30
 * він не такий: аркуш 420 мм проти готових 400, тобто 10 мм з боку, або 2.38%
 * ширини — БІЛЬШЕ за той запобіжник. Смужка на всю ширину вильоту вилітала за
 * межу, функція чесно відповідала «не знаю такої картинки», а маршрут друкував
 * «білої смужки немає» і не чіпав файл. Тобто на єдиному розмірі, де ця біда і
 * трапилась, інструмент був сліпий, і виглядало це як успішний прогін.
 *
 * Перевірено по всій таблиці розмірів: 20×20 дає 0.62%, 25×25 нуль, 30×30 і
 * 30×20 по 0.82%, і лише 20×30 дає 2.38%. Одне число на всіх не налазить, бо
 * виліт у різних розмірів різний — тому його треба рахувати, а не вгадувати.
 *
 * І ще: осі різні навіть в одному розмірі. У того ж 20×30 по вертикалі виліт
 * 0.82%, тобто вчетверо менший за горизонтальний.
 */

/** Скільки білих ліній знайдено з кожного боку. */
export interface WhiteEdges {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export const NO_EDGES: WhiteEdges = { left: 0, right: 0, top: 0, bottom: 0 };

/** Чи є в цьому наборі хоч одна біла лінія. */
export function hasWhiteEdges(e: WhiteEdges): boolean {
    return e.left > 0 || e.right > 0 || e.top > 0 || e.bottom > 0;
}

export interface MeasureOptions {
    width: number;
    height: number;
    /** Чи є лінія (стовпець або рядок) суцільно білою. */
    lineIsWhite: (axis: 'col' | 'row', index: number) => boolean;
    /**
     * Найбільша частка сторони, яку ще вважаємо смужкою вильоту. Більше —
     * це вже білий елемент макета, і чіпати його не можна.
     *
     * Лишається як запасне значення для викликів без геометрії. Там, де розмір
     * книги відомий, треба передавати maxFractionX і maxFractionY — див.
     * пояснення у шапці файлу.
     */
    maxFraction?: number;
    /** Межа по горизонталі, часткою ширини. Перекриває maxFraction. */
    maxFractionX?: number;
    /** Межа по вертикалі, часткою висоти. Перекриває maxFraction. */
    maxFractionY?: number;
}

/**
 * Чому вимірювання нічого не дало. Без цього «смужки немає» і «смужка ширша за
 * виліт» зливались в одну відповідь, і саме через це TM-001254 два тижні
 * виглядало як полагоджене.
 */
export type WhiteEdgeVerdict =
    /** Смужка знайдена і вкладається у виліт. */
    | 'found'
    /** Смужки немає: край аркуша не білий. */
    | 'clean'
    /** Біле тягнеться далі за виліт — це вже макет, не чіпаємо. */
    | 'wider-than-bleed'
    /** Розмір зображення безглуздий. */
    | 'degenerate';

export interface WhiteEdgeReading {
    edges: WhiteEdges;
    verdict: WhiteEdgeVerdict;
    /** Межі, за якими міряли, у лініях — щоб маршрут міг їх показати. */
    caps: { x: number; y: number };
}

/**
 * Міряє білу смужку з кожного боку.
 *
 * Повертає нулі, якщо смужки немає або вона завелика, щоб бути вильотом:
 * у другому випадку рішення «не чіпати» краще за здогад.
 */
export function measureWhiteEdges(opts: MeasureOptions): WhiteEdges {
    return inspectWhiteEdges(opts).edges;
}

/**
 * Те саме вимірювання, але з поясненням, чому вийшло саме так.
 */
export function inspectWhiteEdges(opts: MeasureOptions): WhiteEdgeReading {
    const { width, height, lineIsWhite } = opts;
    const fallback = opts.maxFraction ?? 0.02;
    const fractionX = opts.maxFractionX ?? fallback;
    const fractionY = opts.maxFractionY ?? fallback;
    if (!(width > 0) || !(height > 0)) {
        return { edges: { ...NO_EDGES }, verdict: 'degenerate', caps: { x: 0, y: 0 } };
    }

    const capX = Math.max(1, Math.floor(width * fractionX));
    const capY = Math.max(1, Math.floor(height * fractionY));
    const caps = { x: capX, y: capY };

    const run = (
        axis: 'col' | 'row',
        from: number,
        step: number,
        cap: number,
    ): number | null => {
        let n = 0;
        for (let i = from; n <= cap; i += step, n++) {
            if (!lineIsWhite(axis, i)) return n;
        }
        // Смужка довша за запобіжник — це не виліт.
        return null;
    };

    const left = run('col', 0, 1, capX);
    const right = run('col', width - 1, -1, capX);
    const top = run('row', 0, 1, capY);
    const bottom = run('row', height - 1, -1, capY);

    // Досить одного боку, що вийшов за межі, щоб не чіпати файл: така
    // картинка нам просто незнайома.
    if (left === null || right === null || top === null || bottom === null) {
        return { edges: { ...NO_EDGES }, verdict: 'wider-than-bleed', caps };
    }

    // Смужка з обох боків не може з'їсти всю сторону.
    if (left + right >= width || top + bottom >= height) {
        return { edges: { ...NO_EDGES }, verdict: 'wider-than-bleed', caps };
    }

    const edges = { left, right, top, bottom };
    return { edges, verdict: hasWhiteEdges(edges) ? 'found' : 'clean', caps };
}
