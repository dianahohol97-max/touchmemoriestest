/**
 * Оплачений форзац мусить мати файл — звірка обіцянки з набором для друку.
 *
 * ЧОМУ ЦЕ ІСНУЄ. Сервіс рендеру свідомо НЕ вантажить порожній форзац: друкарня
 * просила не отримувати чистих аркушів («якщо форзаців немає — щоб взагалі не
 * вантажилися», Diana, 05.08.2026). Правило добре рівно доти, доки форзац і
 * справді нікому не потрібен. Коли людина за нього заплатила, той самий пропуск
 * стає тихою втратою: у теці просто немає f1, у консолі Railway лишається рядок
 * «empty forzat pages excluded from export», і не дізнається про це ніхто.
 *
 * Прохід по живій базі за шістдесят днів (22.09.2026) дав два таких замовлення,
 * обидва вже в статусі confirmed: TM-001352 оплатило обидва форзаци й отримало
 * тільки f2, TM-001349 оплатило обидва й не отримало жодного. Це менше за
 * десяток, тобто ознака, а не шум — та сама міра, що в гочі 15.
 *
 * ЩО ЦЕЙ ФАЙЛ НЕ РОБИТЬ. Він нічого не змінює в тому, що їде в друк: порожній
 * аркуш як був непотрібним, так і лишається непотрібним. Він відповідає на одне
 * питання — «людина заплатила за друк на форзаці, а файл є?» — і лишає рішення
 * тому, хто віддає макет у роботу.
 *
 * Чисто і під тестами (tests/forzat-expectation.test.ts), бо тут легко почати
 * вгадувати: значення опції приходить трьома різними словниками, і кожен новий
 * спосіб її записати мовчки вимкнув би перевірку.
 */

/** Які саме форзаци оплачено. */
export interface ForzatSides {
    first: boolean;
    last: boolean;
}

export const NO_FORZAT: ForzatSides = { first: false, last: false };

/** Назва опції в рядку кошика. Одна на весь проєкт, щоб не розходилася. */
export const FORZAT_OPTION = 'Друк на форзаці';

/**
 * Чи взагалі оплачено друк на форзаці.
 *
 * Предикат навмисно дослівно той самий, що рахує 100 ₴ у lib/products.ts:
 * якщо вони розійдуться, з'явиться або мовчазна перевірка на оплаченому
 * форзаці, або крик на неоплаченому. Значення приходить трьома шляхами —
 * конструктор пише «Так (перший + останній)», сторінка товару «З друком» або
 * «with», а старі рядки бувають «yes».
 */
export function isForzatPaid(rawValue: unknown): boolean {
    const v = String(rawValue ?? '').trim().toLowerCase();
    if (!v) return false;
    return v !== 'none' && !v.includes('без');
}

/**
 * Які сторони оплачено.
 *
 * Значення конструктора називає сторони прямо. Усе інше — це фіксована
 * доплата «за обидва», тож там оплачені обидва: доплата одна незалежно від
 * того, скільки форзаців друкують.
 */
export function paidForzatSides(options: unknown): ForzatSides {
    if (!options || typeof options !== 'object') return NO_FORZAT;
    const raw = (options as Record<string, unknown>)[FORZAT_OPTION];
    if (!isForzatPaid(raw)) return NO_FORZAT;
    const v = String(raw).toLowerCase();
    const first = v.includes('перш');
    const last = v.includes('остан');
    // Жодна сторона не названа — це «З друком» зі сторінки товару, тобто обидві.
    if (!first && !last) return { first: true, last: true };
    return { first, last };
}

/** Файл форзаца у наборі для друку: f1 — початковий, f2 — кінцевий. */
export type ForzatFile = 'f1' | 'f2';

/**
 * Чого бракує: оплачено, а файлу немає.
 *
 * Імена звіряються за початком, бо в теці лежить саме «f1.jpg» / «f2.jpg», а
 * не якийсь варіант із номером. Порівняння без урахування регістру — сховище
 * не гарантує його, а помилитися тут означає крикнути на цілий набір.
 */
export function missingForzatFiles(sides: ForzatSides, fileNames: Iterable<string>): ForzatFile[] {
    const names = new Set<string>();
    for (const n of fileNames) {
        const clean = String(n || '').trim().toLowerCase();
        if (clean) names.add(clean);
    }
    const has = (prefix: ForzatFile) => [...names].some(n => n === `${prefix}.jpg` || n.startsWith(`${prefix}.`));
    const out: ForzatFile[] = [];
    if (sides.first && !has('f1')) out.push('f1');
    if (sides.last && !has('f2')) out.push('f2');
    return out;
}

/** Людське речення про нестачу — одне на всі місця, де про неї кажуть. */
export function forzatShortfallLine(missing: ForzatFile[]): string {
    if (missing.length === 0) return '';
    const name = (f: ForzatFile) => (f === 'f1' ? 'початковий' : 'кінцевий');
    const which = missing.map(name).join(' і ');
    return missing.length > 1
        ? `оплачено друк на обох форзацах, а файлів немає на жодному (${which})`
        : `оплачено друк на форзаці, а ${which} форзац приїхав без файлу`;
}
