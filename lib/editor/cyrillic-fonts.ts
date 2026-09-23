import { FONTS_WITH_CYRILLIC } from './font-scripts';

/**
 * Український текст у шрифті, який кирилиці не має.
 *
 * Чотири родини в підбірці конструктора стояли з `cyr: true`, хоча кириличних
 * гліфів у них немає ні в тому файлі, який віддає Google, ні в апстрімі
 * google/fonts: Lato, Poppins, Schibsted Grotesk і Kyiv Type Sans (останню
 * Google не віддає взагалі — окремий запит на неї повертає «400: Font family
 * not found», а в спільному запиті вона мовчки випадає). Lato стоїть у
 * дванадцяти збережених макетах, Poppins у чотирьох, і весь цей час
 * український текст у них малювався системним шрифтом — на екрані й у друці
 * по-різному, бо системні шрифти на різних машинах різні.
 *
 * Полагодити це підстановкою неможливо: гліфів немає, і взятися їм нізвідки.
 * Тому лікування тут не технічне, а розмовне — сказати про це людині, поки вона
 * ще в конструкторі й може обрати інший шрифт, і сказати менеджерці, коли вона
 * перевіряє макет перед друком. Сторож у рендер-сервісі бачить те саме, але вже
 * на аркуші, і він свідомо НЕ зупиняє через це рендер: відмова зробила б ці
 * шістнадцять макетів недрукованими назавжди.
 *
 * Перелік родин із кирилицею береться з самих файлів
 * (`lib/editor/font-scripts.ts`, його пише `scripts/build-editor-fonts.py`), а
 * не з прапорця `cyr` у `FONT_DATA`: прапорець каже, що пропонувати в підбірці,
 * і саме тому вони вже розійшлися.
 */

/** Кирилиця, як вона трапляється в наших текстах: основний блок плюс укр. літери. */
const CYRILLIC_RE = /[Ѐ-ӿԀ-ԯⷠ-ⷿꙀ-ꚟ]/;

export function hasCyrillic(text: string | null | undefined): boolean {
    return CYRILLIC_RE.test(String(text ?? ''));
}

/** Чи має ця родина кириличні гліфи в наших файлах. */
export function fontHasCyrillic(family: string | null | undefined): boolean {
    const name = String(family ?? '').trim().replace(/^['"]|['"]$/g, '');
    if (!name) return true; // порожнє поле означає «шрифт за замовчуванням» — не наша справа
    return FONTS_WITH_CYRILLIC.has(name);
}

/**
 * Чи надрукується цей текст цією родиною не тим шрифтом.
 *
 * Питання ставиться саме так, а не «чи має шрифт кирилицю»: латинський підпис
 * у Lato виходить рівно таким, яким його бачить людина, і попереджати про нього
 * означало б навчити клієнта не читати попереджень.
 */
export function textFallsBackFromFont(family: string | null | undefined, text: string | null | undefined): boolean {
    return hasCyrillic(text) && !fontHasCyrillic(family);
}

/** Рядок для людини — однаковий у конструкторі й в адмінці, щоб питання ставилося раз. */
export function describeCyrillicFallback(family: string, sample?: string | null): string {
    const flat = String(sample ?? '').replace(/\s+/g, ' ').trim();
    const quoted = flat ? ` («${flat.length > 34 ? `${flat.slice(0, 33)}…` : flat}»)` : '';
    return `шрифт ${family} не має кирилиці — ці рядки${quoted} надрукуються іншим шрифтом`;
}

/** Один напис, який вийде не тим шрифтом. `pageIndex` 0 — обкладинка. */
export interface CyrillicFallback {
    pageIndex: number;
    /** Ідентифікатор текстового блока — конструктор веде ним до потрібного місця. */
    blockId: string;
    family: string;
    text: string;
}

/**
 * Пройти весь макет і зібрати написи, яким бракує кирилиці.
 *
 * Один обхід на два місця: конструктор показує з нього рядки переліку перед
 * «Додати в кошик» із переходом до блока, а перевірка макетів в адмінці —
 * рядок у звіті. Два окремі обходи розійшлися б так само, як розійшлися колись
 * дві копії панелі слота, і тоді менеджерка бачила б інше, ніж бачила клієнтка.
 *
 * Приймає збережені форми (`projects.pages_data`, `projects.cover_data`), бо в
 * конструкторі стан має рівно той самий вигляд.
 */
export function collectCyrillicFallbacks(pagesData: unknown, coverData: unknown): CyrillicFallback[] {
    const out: CyrillicFallback[] = [];
    const note = (pageIndex: number, blockId: string, family: unknown, text: unknown) => {
        const fam = String(family ?? '').trim().replace(/^['"]|['"]$/g, '');
        const body = String(text ?? '');
        if (!fam || !textFallsBackFromFont(fam, body)) return;
        out.push({ pageIndex, blockId, family: fam, text: body });
    };

    const pages = Array.isArray(pagesData) ? pagesData : [];
    pages.forEach((pg: any, pi: number) => {
        // Нульова сторінка — обкладинка, у неї власний редактор і власні поля.
        if (pi === 0) return;
        for (const tb of pg?.textBlocks || []) note(pi, String(tb?.id ?? ''), tb?.fontFamily, tb?.text);
    });

    const cover = (coverData && typeof coverData === 'object') ? coverData as Record<string, any> : null;
    if (cover) {
        for (const tb of cover.printedTextBlocks || []) note(0, String(tb?.id ?? ''), tb?.fontFamily, tb?.text);
        for (const tb of cover.backCoverTexts || []) note(0, String(tb?.id ?? ''), tb?.fontFamily, tb?.text);
        for (const et of cover.extraTexts || []) note(0, String(et?.id ?? ''), et?.fontFamily || cover.textFontFamily, et?.text);
        // `textFontFamily` стоїть у 1238 збережених макетах — це головний напис
        // обкладинки, і мовчати про нього не можна.
        if (cover.decoText) note(0, 'cover-deco', cover.textFontFamily, cover.decoText);
    }
    return out;
}

/** Рядок для звіту перевірки макетів: коротко, по одній родині. */
export function cyrillicFallbackLine(items: CyrillicFallback[]): string | null {
    if (!items.length) return null;
    const byFamily = new Map<string, CyrillicFallback>();
    for (const it of items) if (!byFamily.has(it.family)) byFamily.set(it.family, it);
    const parts = [...byFamily.entries()].map(([family, first]) => {
        const count = items.filter(i => i.family === family).length;
        return `${describeCyrillicFallback(family, first.text)}${count > 1 ? `, і так у ${count} написах` : ''}`;
    });
    return parts.join('; ');
}
