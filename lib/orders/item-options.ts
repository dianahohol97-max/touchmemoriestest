/**
 * Опис позиції замовлення: одна відповідь на питання «що саме замовили».
 *
 * ЧОМУ ЦЕ ОКРЕМИЙ МОДУЛЬ. Набір опцій, який їде в замовлення, збирається з
 * двох поколінь інтерфейсу одразу. Старий селект із products.options пише
 * «Оздоблення» і окремі «Варіант акрилу» / «Варіант фотовставки», а нові
 * пігулки на картці товару пишуть «Тип оздоблення» і «Варіант оздоблення» з
 * таблиці decoration_variants. Обидва набори лишаються в позиції, тому один
 * товар описує сам себе так:
 *
 *     Оздоблення: Без оздоблення • Тип оздоблення: Металева вставка •
 *     Варіант оздоблення: 90×50 золотий
 *
 * Саме це показала картка TM-001296: рядок стверджує «без оздоблення» і тут
 * же називає вставку з розміром. Менеджер не може прочитати такий опис, а
 * майстерня може прочитати його неправильно.
 *
 * Розбір уже існував у чекауті з дизайнером, але жив прямо у JSX і нікуди не
 * перевикористовувався, тож адмінка мала власну, коротшу і місцями хибну
 * копію (її регулярка /фото|вставк/ вважала «Металеву вставку» фотовставкою).
 * Тепер правило одне на всі екрани, і воно тут.
 *
 * Модуль нічого не вирішує за менеджера: якщо два ключі називають РІЗНІ
 * справжні оздоблення, обидва лишаються видимими, а `conflict` каже про це
 * вголос. Мовчазний вибір одного з двох — це саме та помилка, через яку на
 * верстат може поїхати не та вставка.
 */

export type DecoKind =
    | 'none'
    | 'acryl'
    | 'photovstavka'
    | 'metal'
    | 'flex'
    | 'graviruvannya'
    | 'tysnennya'
    | 'other';

/**
 * Ключі, під якими в позиції взагалі може лежати оздоблення, У ПОРЯДКУ
 * ПЕРЕВАГИ. Це ЄДИНИЙ такий порядок у проєкті — саме тому решта місць
 * питають resolveDecoration, а не перелічують ключі самі.
 *
 * «Тип оздоблення» першим: його пише актуальний інтерфейс картки товару.
 * «Декорація обкладинки» — діалект книг побажань; із «Тип оздоблення» він не
 * зустрічається жодного разу в жодній позиції, тож сусідство безпечне, а
 * спільний список позбавляє друкарські маршрути власної, коротшої копії.
 * «Оздоблення» останнім, бо це залишок старого селекта, і саме він у восьми
 * позиціях каже «Без оздоблення» поруч із названою вставкою.
 *
 * Діана, 16.09.2026: «якщо в проєкті буде три різні порядки, наступний дефект
 * уже готовий».
 */
const DECO_KEYS = ['Тип оздоблення', 'Декорація обкладинки', 'Оздоблення', 'Decoration'] as const;

/** Ключ варіанта → оздоблення, якому він належить. */
const VARIANT_KEYS: Record<string, DecoKind> = {
    'Варіант акрилу': 'acryl',
    'Варіант фотовставки': 'photovstavka',
    'Варіант металевої вставки': 'metal',
    'Варіант гравірування': 'graviruvannya',
    'Варіант тиснення': 'tysnennya',
};

/** Універсальний ключ варіанта — належить тому оздобленню, яке обрали. */
const GENERIC_VARIANT_KEY = 'Варіант оздоблення';

/** Колір напису має сенс лише там, де напис друкується флексом. */
const FLEX_ONLY_KEYS = ['Колір напису', 'Колір флексу'];

/**
 * Яке це оздоблення.
 *
 * Метал перевіряємо ПЕРШИМ: «Металева вставка» містить слово «вставка», і
 * перевірка на фотовставку, поставлена раніше, забирала метал собі — так
 * адмінка ховала металевий варіант і показувала фотовставку.
 */
export function decoKindOf(value: string | null | undefined): DecoKind {
    const v = String(value ?? '').trim().toLowerCase();
    if (!v || v === 'none' || v.includes('без оздоблення')) return 'none';
    if (v.includes('метал')) return 'metal';
    if (v.includes('акрил') || v.includes('acryl')) return 'acryl';
    if (v.includes('фотовставк') || v.includes('photovstavka') || v.startsWith('foto')) return 'photovstavka';
    if (v.includes('флекс') || v.includes('flex') || v.includes('друк кольор')) return 'flex';
    if (v.includes('гравір') || v.includes('гравію') || v.includes('graviru')) return 'graviruvannya';
    if (v.includes('тиснен')) return 'tysnennya';
    return 'other';
}

export interface ResolvedDecoration {
    kind: DecoKind;
    /** Підпис оздоблення так, як його бачить клієнт. Порожній, якщо оздоблення немає. */
    label: string;
    /** Ключ, з якого взято підпис («Тип оздоблення» або «Оздоблення»). */
    sourceKey: string | null;
    /** Обидва ключі називають різні справжні оздоблення — вибір неможливий. */
    conflict: boolean;
    /** Підпис варіанта («90×50 золотий»), якщо він є. */
    variant: string;
}

/**
 * Яке оздоблення насправді замовили.
 *
 * «Тип оздоблення» має перевагу: його пише актуальний інтерфейс картки
 * товару. «Оздоблення» зі старого селекта береться лише тоді, коли новий
 * ключ порожній або каже «Без оздоблення» — саме цей залишок і створював
 * суперечливий рядок.
 */
export function resolveDecoration(opts: Record<string, any> | null | undefined): ResolvedDecoration {
    const o = opts || {};
    const named = DECO_KEYS
        .map(key => ({ key, value: String(o[key] ?? '').trim(), kind: decoKindOf(o[key]) }))
        .filter(entry => entry.kind !== 'none');

    const variant = String(o[GENERIC_VARIANT_KEY] ?? '').trim();

    if (named.length === 0) {
        return { kind: 'none', label: '', sourceKey: null, conflict: false, variant: '' };
    }

    const chosen = named[0];
    const conflict = named.length > 1 && named.some(entry => entry.kind !== chosen.kind);
    const specific = Object.keys(VARIANT_KEYS).find(k => VARIANT_KEYS[k] === chosen.kind);

    return {
        kind: chosen.kind,
        label: chosen.value,
        sourceKey: chosen.key,
        conflict,
        variant: variant || String(specific ? o[specific] ?? '' : '').trim(),
    };
}

/**
 * Опції позиції без суперечностей і без чужих залишків.
 *
 * Прибираємо рівно чотири види сміття, і нічого більше:
 *   • другий ключ оздоблення, який каже «Без оздоблення», коли оздоблення є;
 *   • варіанти чужих оздоблень (клієнт клікнув акрил, потім фотовставку, а
 *     купив метал — обидва попередні розміри лишились у позиції);
 *   • колір напису там, де напису флексом немає;
 *   • покриття обкладинки, назване вдруге під іншим ключем.
 * Порожні значення теж не показуємо: рядок «Корінець: » нічого не описує.
 *
 * Порядок ключів зберігається — менеджер звик читати позицію згори вниз.
 */
export function cleanItemOptions<T extends Record<string, any>>(opts: T | null | undefined): Partial<T> {
    const o = (opts || {}) as Record<string, any>;
    const deco = resolveDecoration(o);
    const hasLamination = ['Ламінація обкладинки', 'Тип ламінації']
        .some(k => String(o[k] ?? '').trim() !== '');
    const out: Record<string, any> = {};

    for (const [key, value] of Object.entries(o)) {
        if (String(value ?? '').trim() === '') continue;

        if ((DECO_KEYS as readonly string[]).includes(key)) {
            // Суперечність показуємо як є — хай її бачить людина.
            if (deco.conflict) { out[key] = value; continue; }
            if (deco.kind !== 'none' && key !== deco.sourceKey) continue;
        }

        if (key === GENERIC_VARIANT_KEY) {
            if (deco.kind === 'none') continue;
        } else if (VARIANT_KEYS[key]) {
            if (deco.kind === 'none') continue;
            if (VARIANT_KEYS[key] !== deco.kind) continue;
            // Той самий варіант уже названо універсальним ключем — не повторюємо.
            const generic = String(o[GENERIC_VARIANT_KEY] ?? '').trim();
            if (generic && String(value).trim() === generic) continue;
        }

        if (FLEX_ONLY_KEYS.includes(key) && deco.kind !== 'flex') continue;

        // Журнали несуть покриття обкладинки як «Ламінація обкладинки». Стара
        // сесія лишає поруч «Тип обкладинки» або camelCase `coverType` з тим
        // самим глянцем — це той самий вибір, названий двічі. Матеріал
        // обкладинки (Велюр, Тканина, Друкована) під тим же ключем лишається:
        // прибираємо лише покриття.
        if (hasLamination) {
            if (key === 'Тип обкладинки') continue;
            if (key === 'coverType' && /глянц|матов/i.test(String(value))) continue;
        }

        out[key] = value;
    }

    return out as Partial<T>;
}

/** Людські назви для технічних ключів із конструктора. */
const KEY_LABELS: Record<string, string> = {
    size: 'Розмір',
    pages: 'Кількість сторінок',
    coverType: 'Тип обкладинки',
    tracingPaper: 'Калька',
    lamination: 'Ламінація',
};

/**
 * Значення-коди з products.options та з конструктора.
 * Незнайоме значення повертаємо як є — багато підписів уже приходять
 * готовими («20×20 см», «16 сторінок»).
 */
const VALUE_LABELS: Record<string, string> = {
    'standard': 'Стандартний',
    'round': 'Круглий',
    'acryl': 'Акрил',
    'photovstavka': 'Фотовставка',
    'metal': 'Металева вставка',
    'flex': 'Флекс',
    'graviruvannya': 'Гравірування',
    'acryl_100x100': 'Акрил 100×100 мм',
    'acryl_d145': 'Акрил Ø145 мм',
    'foto_100x100': 'Фотовставка 100×100 мм',
    'glossy': 'Глянцева',
    'matte': 'Матова',
    'urgent': 'Термінова',
};

/**
 * Коди, що означають різне на різних полях: 'none' на кальці це «Без
 * кальки», а на оздобленні «Без оздоблення».
 */
const FIELD_VALUE_LABELS: Record<string, Record<string, string>> = {
    'Калька перед першою сторінкою': { 'none': 'Без кальки', 'with': 'З калькою' },
    'tracingPaper': { 'none': 'Без кальки', 'with': 'З калькою' },
    'Тип оздоблення': { 'none': 'Без оздоблення' },
    'Оздоблення': { 'none': 'Без оздоблення' },
    'Верстка тексту': { 'none': 'Без тексту (тільки фото)', 'own': 'Власний текст', 'we': 'Текст пише команда' },
    'Ламінація сторінок': { 'none': 'Без ламінації', 'with': 'З ламінацією' },
    'Ламінація обкладинки': { 'none': 'Без ламінації' },
    'Ламінація': { 'none': 'Без ламінації' },
    'Тип ламінації': { 'none': 'Без ламінації' },
    'Друк на форзаці': { 'none': 'Без друку', 'with': 'З друком' },
    'Терміновість': { 'none': 'Стандартна', 'standard': 'Стандартна', 'urgent': 'Термінова (до 5 робочих днів)' },
    'Колір напису': { 'white': 'Білий', 'black': 'Чорний', 'silver': 'Срібло', 'gold': 'Золото' },
    'Колір флексу': { 'white': 'Білий', 'black': 'Чорний', 'silver': 'Срібло', 'gold': 'Золото' },
    'Комплектація': { 'no_stand': 'Без мольберта', 'with_stand': "З дерев'яним мольбертом" },
};

/** Назва поля так, як її читає людина. */
export function optionKeyLabel(key: string): string {
    return KEY_LABELS[key] || key;
}

/** Значення поля так, як його читає людина. */
export function optionValueLabel(key: string, value: any): string {
    const v = String(value ?? '');
    const perField = FIELD_VALUE_LABELS[key];
    if (perField && perField[v]) return perField[v];
    if (VALUE_LABELS[v]) return VALUE_LABELS[v];
    return v;
}

/**
 * Готовий опис позиції: пари «підпис — значення» без суперечностей і вже
 * людською мовою. Це те, що бачить менеджер в адмінці і клієнт у чекауті.
 */
export function describeItemOptions(
    opts: Record<string, any> | null | undefined,
): Array<{ key: string; label: string; value: string }> {
    return Object.entries(cleanItemOptions(opts)).map(([key, value]) => ({
        key,
        label: optionKeyLabel(key),
        value: optionValueLabel(key, value),
    }));
}
