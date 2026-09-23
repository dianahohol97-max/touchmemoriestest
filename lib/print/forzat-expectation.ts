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

/**
 * Звідки береться «за які форзаци заплачено», коли макет відкривають заново.
 *
 * Джерел два, і вони НЕ рівні. `saved` — це `endpaperPaid` із самого макета,
 * тобто те, що людина зробила в редакторі й що збереглося разом із макетом.
 * `cartOptions` — рядок кошика, і він потрібен лише для макетів, збережених до
 * появи `endpaperPaid`: у них поле порожнє, а форзац давно оплачений.
 *
 * Правило: збережене сильніше за рядок кошика, і слабше джерело НІКОЛИ не
 * скасовує сильніше. Порядок тут не косметика. Перевернути його означало б,
 * що рядок кошика з «Так (перший + останній)» мовчки повертає розблокування
 * форзацу, який людина свідомо лишила замкненим, — а повернути ЗАМКНЕНИМ те,
 * за що заплачено, означає стерти з нього фото при видаленні розвороту.
 *
 * Повертає null, коли казати нічого: тоді конструктор лишається на своєму
 * власному `enableEndpaper`, тобто поводиться рівно так, як поводився досі.
 */
export function resolveEndpaperPaid(
    saved: unknown,
    cartOptions: unknown,
): ForzatSides | null {
    if (saved && typeof saved === 'object') {
        const s = saved as Record<string, unknown>;
        return { first: !!s.first, last: !!s.last };
    }
    const fromCart = paidForzatSides(cartOptions);
    if (fromCart.first || fromCart.last) return fromCart;
    return null;
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

/**
 * ЧИ Є НА СТОРІНЦІ ХОЧ ЩОСЬ, ЩО СПРАВДІ НАДРУКУЄТЬСЯ.
 *
 * Сервіс рендеру свідомо не вантажить порожній форзац, і це правило залежить
 * від одного питання: що вважати порожнім. Досі текстовий блок рахувався
 * вмістом за самим фактом свого існування — `textBlocks.length > 0`, без
 * погляду всередину. Блок без жодного символу при цьому не малює нічого, тож
 * форзац із таким блоком їхав у друкарню чистим аркушем, а оплачений форзац
 * виглядав відпрацьованим: файл є, сторож мовчить, людина заплатила за друк і
 * отримала білий папір. Такий блок не вигадка: у макеті TM-001352 він лежить
 * на другій сторінці, шириною майже третину сторінки, і клієнтка не могла його
 * ні виділити, ні видалити, поки редактор не почав його показувати.
 *
 * ЦЕ ДЗЕРКАЛО. Та сама перевірка живе в `render-service/server.ts` під іменем
 * `pageHasContent`, і скопійована вона туди НЕ з ліні. `render-service` — це
 * окремий збірник: власні `package.json` і `tsconfig` з `include: ["server.ts"]`,
 * а Dockerfile копіює в образ рівно два файли, `tsconfig.json` і `server.ts`.
 * Імпортувати звідти `lib/` фізично нічим. Дві копії тримає разом спільний
 * перелік випадків у `tests/forzat-expectation.test.ts`: правлячи одну, правте
 * другу і додавайте випадок туди.
 *
 * Порожній ВІЛЬНИЙ слот свідомо лишається вмістом, хоч і не малює нічого. Тут
 * змінено рівно те, на що є жива поломка; чіпати сусіднє наосліп означало б
 * міняти те, чого ніхто не міряв.
 */
export function pageHasPrintableContent(pagesData: unknown, overlaysData: unknown, idx: number): boolean {
    const pages = Array.isArray(pagesData) ? pagesData : [];
    const p: any = pages[idx];
    if (!p) return false;
    const ov: Record<string, any> = (overlaysData && typeof overlaysData === 'object')
        ? overlaysData as Record<string, any> : {};
    if ((p.slots || []).some((s: any) => s?.photoId)) return true;
    // ↓ ЄДИНА відмінність від колишнього `textBlocks.length > 0`.
    if ((p.textBlocks || []).some((t: any) => String(t?.text ?? '').trim().length > 0)) return true;
    if (((ov.freeSlots || {})[idx] || []).length > 0) return true;
    if (((ov.pageStickers || {})[idx] || []).length > 0) return true;
    if (((ov.pageShapes || {})[idx] || []).length > 0) return true;
    if (((ov.qrOverlays || {})[idx] || []).length > 0) return true;
    if ((ov.pageBgs || {})[idx]) return true;
    return false;
}

/**
 * Які індекси в `pages_data` є форзацами, або null, якщо їх у цьому виробі немає.
 *
 * Друге дзеркало `render-service`: там це `hasForzatExtra` плюс пара
 * `forzatFirstNo` / `forzatLastNo`. Тревелбуки і журнали несуть ДВІ зайві
 * фізичні сторінки під форзаци — перша і остання зі змістових, — і впізнають їх
 * за тим, що змістових рівно на дві більше, ніж замовлено.
 */
export function forzatPageIndexes(
    productSlug: unknown,
    pagesData: unknown,
    config: unknown,
): { first: number; last: number } | null {
    const slug = String(productSlug ?? '').toLowerCase();
    const splitToPages = ['travel', 'magazine', 'journal', 'zhurnal', 'fotozhurnal'].some(k => slug.includes(k));
    if (!splitToPages) return null;
    const pages = Array.isArray(pagesData) ? pagesData : [];
    const contentPageCount = Math.max(0, pages.length - 1);
    const cfg: Record<string, any> = (config && typeof config === 'object') ? config as Record<string, any> : {};
    const ordered = parseInt(String(cfg.selectedPageCount ?? '').match(/\d+/)?.[0] || '0', 10) || 0;
    if (!(ordered > 0) || contentPageCount < ordered + 2) return null;
    return { first: 1, last: contentPageCount };
}

/**
 * Оплачені форзаци, на яких НІЧОГО немає.
 *
 * Друга половина тієї самої звірки. `missingForzatFiles` питає «чи є файл», і
 * після виправлення рендеру цього досить: порожній форзац файлу не дає, тож
 * нестача видно одразу. Але замовлення, відрендерені ДО цього виправлення,
 * несуть `f1.jpg`, який є чистим аркушем: файл на місці, сторож мовчить, а
 * людина заплатила. Перерендерювати їх заради цього ніхто не буде, тож питаємо
 * ще й сам макет.
 */
export function blankPaidForzats(
    sides: ForzatSides,
    productSlug: unknown,
    pagesData: unknown,
    overlaysData: unknown,
    config: unknown,
): ForzatFile[] {
    const idx = forzatPageIndexes(productSlug, pagesData, config);
    if (!idx) return [];
    const out: ForzatFile[] = [];
    if (sides.first && !pageHasPrintableContent(pagesData, overlaysData, idx.first)) out.push('f1');
    if (sides.last && !pageHasPrintableContent(pagesData, overlaysData, idx.last)) out.push('f2');
    return out;
}

/** Людське речення про оплачений, але порожній форзац. */
export function blankForzatLine(blank: ForzatFile[]): string {
    if (blank.length === 0) return '';
    const name = (f: ForzatFile) => (f === 'f1' ? 'початковому' : 'кінцевому');
    const which = blank.map(name).join(' і ');
    return blank.length > 1
        ? `оплачено друк на обох форзацах, а на них нічого не намальовано (${which})`
        : `оплачено друк на форзаці, а на ${which} нічого не намальовано`;
}
