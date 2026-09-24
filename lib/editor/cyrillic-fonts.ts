import { FONTS_WITH_CYRILLIC, FONTS_IN_PACK } from './font-scripts';

/**
 * Напис, який надрукується не тим шрифтом, який обрала людина.
 *
 * Два різні випадки, і плутати їх не можна.
 *
 * ПЕРШИЙ — родини немає в нашому наборі взагалі. Georgia стоїть окремим
 * варіантом у старій панелі властивостей і дефолтом у конструкторах постерів,
 * але це системний шрифт Windows, якого в контейнері Railway немає й узятися
 * йому нізвідки. Такий напис друкується системним шрифтом ЦІЛКОМ, і латинський
 * так само, як кириличний.
 *
 * ДРУГИЙ — родина наша, але кирилиці в ній немає. Lato, Poppins і Schibsted
 * Grotesk стояли в підбірці з `cyr: true`, хоча кириличних гліфів у них немає
 * ні у файлі, який віддає Google, ні в апстрімі google/fonts. Lato стоїть у
 * дванадцяти збережених макетах, Poppins у чотирьох, і весь цей час
 * український текст у них малювався системним шрифтом — на кожній машині
 * своїм. Латинський підпис у тій самій родині виходить рівно таким, яким його
 * видно, тож про нього тут мовчимо.
 *
 * Полагодити обидва підстановкою неможливо: гліфів немає, і взятися їм
 * нізвідки. Тому лікування не технічне, а розмовне — сказати про це людині,
 * поки вона ще в конструкторі й може обрати інший шрифт, і сказати менеджерці,
 * коли вона перевіряє макет перед друком. Сторож у рендер-сервісі бачить те
 * саме вже на аркуші, розрізняє ті самі два випадки ('unknown-family' і
 * 'no-glyphs') і свідомо НЕ зупиняє через них рендер: відмова зробила б ці
 * макети недрукованими назавжди.
 *
 * Обидва переліки беруться з самих ФАЙЛІВ (`lib/editor/font-scripts.ts`, його
 * пише `scripts/build-editor-fonts.py`), а не з прапорця `cyr` у `FONT_DATA`:
 * прапорець каже, що пропонувати в підбірці, і саме тому вони вже розійшлися.
 */

/** Кирилиця, як вона трапляється в наших текстах: основний блок плюс укр. літери. */
const CYRILLIC_RE = /[Ѐ-ӿԀ-ԯⷠ-ⷿꙀ-ꚟ]/;

export function hasCyrillic(text: string | null | undefined): boolean {
    return CYRILLIC_RE.test(String(text ?? ''));
}

/** Назва родини так, як її порівнювати: перша в стеку, без лапок і пробілів по краях. */
function familyName(family: string | null | undefined): string {
    return String(family ?? '').split(',')[0].trim().replace(/^['"]|['"]$/g, '');
}

/** Чи має ця родина кириличні гліфи в наших файлах. */
export function fontHasCyrillic(family: string | null | undefined): boolean {
    const name = familyName(family);
    if (!name) return true; // порожнє поле означає «шрифт за замовчуванням» — не наша справа
    return FONTS_WITH_CYRILLIC.has(name);
}

/**
 * Чи віддаємо ми файли цієї родини самі.
 *
 * Родина поза пакетом друкується системним шрифтом ЦІЛКОМ, а не частиною: у
 * контейнері Railway немає ні Georgia, ні будь-чого іншого з Windows, і взятися
 * їм там нізвідки. Тому це окремий випадок, а не різновид «немає кирилиці», і
 * сторож у рендер-сервісі розрізняє ті самі два ('unknown-family' проти
 * 'no-glyphs').
 */
export function fontInPack(family: string | null | undefined): boolean {
    const name = familyName(family);
    if (!name) return true;
    return FONTS_IN_PACK.has(name);
}

/**
 * Чи надрукується цей текст цією родиною не тим шрифтом.
 *
 * Питання ставиться саме так, а не «чи має шрифт кирилицю»: латинський підпис
 * у Lato виходить рівно таким, яким його бачить людина, і попереджати про нього
 * означало б навчити клієнта не читати попереджень.
 */
export function textFallsBackFromFont(family: string | null | undefined, text: string | null | undefined): boolean {
    return fallbackReason(family, text) !== null;
}

/** Чому саме цей напис вийде не тим шрифтом, або null, якщо все гаразд. */
export type FallbackReason = 'not-in-pack' | 'no-cyrillic';

export function fallbackReason(
    family: string | null | undefined,
    text: string | null | undefined,
): FallbackReason | null {
    const name = familyName(family);
    if (!name) return null;
    // Порожній напис нікуди не друкується, тож і шрифту в нього немає.
    if (!String(text ?? '').trim()) return null;
    if (!fontInPack(name)) return 'not-in-pack';
    if (hasCyrillic(text) && !fontHasCyrillic(name)) return 'no-cyrillic';
    return null;
}

/** Рядок для людини — однаковий у конструкторі й в адмінці, щоб питання ставилося раз. */
export function describeCyrillicFallback(
    family: string,
    sample?: string | null,
    reason: FallbackReason = 'no-cyrillic',
): string {
    const flat = String(sample ?? '').replace(/\s+/g, ' ').trim();
    const quoted = flat ? ` («${flat.length > 34 ? `${flat.slice(0, 33)}…` : flat}»)` : '';
    return reason === 'not-in-pack'
        ? `шрифт ${family} не входить у наш набір — ці рядки${quoted} надрукуються системним шрифтом`
        : `шрифт ${family} не має кирилиці — ці рядки${quoted} надрукуються іншим шрифтом`;
}

/** Один напис, який вийде не тим шрифтом. `pageIndex` 0 — обкладинка. */
export interface CyrillicFallback {
    pageIndex: number;
    /** Ідентифікатор текстового блока — конструктор веде ним до потрібного місця. */
    blockId: string;
    family: string;
    text: string;
    reason: FallbackReason;
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
        const fam = familyName(String(family ?? ''));
        const body = String(text ?? '');
        const reason = fallbackReason(fam, body);
        if (!fam || !reason) return;
        out.push({ pageIndex, blockId, family: fam, text: body, reason });
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

/**
 * Написи постера, які вийдуть не тим шрифтом.
 *
 * ЧОМУ ОКРЕМИЙ ОБХІД, А НЕ ГІЛКА В ТОМУ, ЩО ВИЩЕ. Постер зберігається в ту саму
 * колонку `pages_data`, але формою він не книга: весь виріб лежить одним
 * об'єктом конфігурації в `pages_data[0]`. Книжковий обхід нульову сторінку
 * ПРОПУСКАЄ, бо в книги це обкладинка з власним редактором і власними полями в
 * `cover_data`, — і саме через це перевірка макетів мовчала про постери весь
 * час свого існування, хоча обидві збережені зоряні карти з Georgia лежали в
 * базі. Зводити ці два обходи в один означало б або зламати книжковий, або
 * поставити в ньому умову про продукт, яка розійдеться з формою даних.
 *
 * Дві форми постера, і обидві тут:
 *   • `config.textBlocks[]` — PosterConstructor, у кожного блока свій шрифт;
 *   • `config.fontFamily` — конструктори мап, зоряної карти, монограми і
 *     зодіаку: один шрифт на весь виріб, а написи лежать окремими полями.
 *
 * Обхід безпечно запускати на БУДЬ-ЯКОМУ макеті, без питання про тип виробу:
 * станом на 23.09.2026 з 1268 не-постерних макетів у базі жоден не має ні
 * `textBlocks`, ні `fontFamily` на нульовій сторінці, бо в книги обидва поля
 * живуть деінде. Питати форму, а не назву товару, — те саме правило, за яким
 * макет звіряється по ключу рядка, а не по лічильнику.
 */
export function collectPosterFallbacks(pagesData: unknown): CyrillicFallback[] {
    const pages = Array.isArray(pagesData) ? pagesData : [];
    const config = (pages[0] && typeof pages[0] === 'object') ? pages[0] as Record<string, any> : null;
    if (!config) return [];

    const out: CyrillicFallback[] = [];
    const note = (blockId: string, family: unknown, text: unknown) => {
        const fam = familyName(String(family ?? ''));
        const body = String(text ?? '');
        const reason = fallbackReason(fam, body);
        if (!fam || !reason) return;
        out.push({ pageIndex: 0, blockId, family: fam, text: body, reason });
    };

    if (Array.isArray(config.textBlocks)) {
        for (const tb of config.textBlocks) note(String(tb?.id ?? ''), tb?.fontFamily, tb?.text);
    }

    for (const key of POSTER_TEXT_KEYS) {
        const value = config[key];
        if (typeof value === 'string' && value.trim()) note(key, config.fontFamily, value);
    }
    return out;
}

/**
 * Поля конфігурації постера, які справді друкуються.
 *
 * Перелік, а не «всі рядки об'єкта», бо в тій самій конфігурації лежать колір
 * тла, ідентифікатор стилю, розмір аркуша і назва товару — вони на аркуш не
 * потрапляють, а попередження про них навчило б не читати попереджень. Поза
 * переліком свідомо лишилися `date` і `birthDate` (сира дата, на аркуш іде
 * відформатованою), `location` (з неї складається `subtitle`), `weight` і
 * `height` (числа) та `zodiacSign` із `zodiacSymbol` (значення зі словника).
 */
const POSTER_TEXT_KEYS = [
    'headline', 'subtitle', 'dedication',   // зоряна карта
    'title', 'textNote', 'coordinates',     // мапа міста
    'names', 'dateText',                    // мапа кохання, зодіак
    'letter', 'customText',                 // монограма
    'name', 'babyName',                     // зодіак, статистика народження
    'captionText', 'customName',            // мультяшний портрет
] as const;

/** Рядок для звіту перевірки макетів: коротко, по одній родині. */
export function cyrillicFallbackLine(items: CyrillicFallback[]): string | null {
    if (!items.length) return null;
    const byFamily = new Map<string, CyrillicFallback>();
    for (const it of items) if (!byFamily.has(it.family)) byFamily.set(it.family, it);
    const parts = [...byFamily.entries()].map(([family, first]) => {
        const count = items.filter(i => i.family === family).length;
        return `${describeCyrillicFallback(family, first.text, first.reason)}${count > 1 ? `, і так у ${count} написах` : ''}`;
    });
    return parts.join('; ');
}
