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
 * межах кількох відсотків від сторони: усе, що ширше, вважаємо задумом автора
 * і файл не чіпаємо.
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
     */
    maxFraction?: number;
}

/**
 * Міряє білу смужку з кожного боку.
 *
 * Повертає нулі, якщо смужки немає або вона завелика, щоб бути вильотом:
 * у другому випадку рішення «не чіпати» краще за здогад.
 */
export function measureWhiteEdges(opts: MeasureOptions): WhiteEdges {
    const { width, height, lineIsWhite } = opts;
    const maxFraction = opts.maxFraction ?? 0.02;
    if (!(width > 0) || !(height > 0)) return { ...NO_EDGES };

    const capX = Math.max(1, Math.floor(width * maxFraction));
    const capY = Math.max(1, Math.floor(height * maxFraction));

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
    if (left === null || right === null || top === null || bottom === null) return { ...NO_EDGES };

    // Смужка з обох боків не може з'їсти всю сторону.
    if (left + right >= width || top + bottom >= height) return { ...NO_EDGES };

    return { left, right, top, bottom };
}
