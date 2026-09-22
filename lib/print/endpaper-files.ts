/**
 * Чи збігається набір форзаців у файлах із тим, за що заплатили.
 *
 * Форзаци — єдині сторінки, яких у комплекті для друку може законно не бути.
 * Правило стоїть із 05.08.2026 («якщо форзаців немає — щоб взагалі не
 * вантажилися»): порожній форзац не їде в друкарню, щоб вона не отримала
 * чистий аркуш. Рішення про це ухвалює сервіс рендеру сам, мовчки, і ніде
 * потім не сказано, що аркуша немає НАВМИСНЕ.
 *
 * Через це «пропущений форзац» і «загублений форзац» виглядають однаково —
 * просто файлу немає. TM-001352 (Diana, 22.09.2026): журнал на вісім сторінок
 * із купленим друком на обох форзацах приїхав із одним `f2.jpg`, бо перший
 * форзац клієнтка лишила порожнім. Ніхто цього не бачив, доки аркуші не
 * перерахували руками, а за друк обох було взято 200 ₴.
 *
 * Тут рахується те саме, що вирішує рендер, і звіряється з двома джерелами:
 * з макетом (чи є на форзаці хоч щось) і з рядком замовлення (чи за нього
 * платили). Функції чисті, без звернень до бази — те, що на вхід, те й судимо.
 *
 * Дзеркало коду в render-service/server.ts. Якщо там зміниться правило
 * пропуску, міняти треба й тут, інакше перевірка почне кричати на цілі
 * комплекти — а сторож, який кричить вовк, нічого не вартий.
 */

/** Сторони форзаца, за які заплачено в рядку замовлення. */
export type PaidEndpapers = { first: boolean; last: boolean };

/** Індекси форзаців у `pages_data`, коли макет несе їх додатковими аркушами. */
export type EndpaperIndexes = { first: number; last: number };

export type EndpaperVerdict = {
    /** Скільки порожніх форзаців рендер законно НЕ віддасть у файли. */
    skipped: number;
    /** Проблеми українською. Порожньо означає «набір форзаців збігається». */
    problems: string[];
};

/** Товари, які взагалі мають форзаци окремими аркушами. */
const ENDPAPER_PRODUCTS = /travel|magazine|journal|zhurnal|fotozhurnal/i;

/** Ключ опції в рядку замовлення — «Друк на форзаці», з відмінками. */
const ENDPAPER_OPTION_KEY = /друк\s+на\s+форзац/i;

/**
 * За які форзаци заплачено. Значення опції пише конструктор: «Так (перший +
 * останній)», «Так (перший)», «Так (останній)» або «Ні».
 *
 * Голе «Так» без уточнення читається як обидва: так писав конструктор до
 * того, як з'явився вибір сторін, і на старих замовленнях це чесніше, ніж
 * вирішити, що не заплачено ні за що.
 */
export function paidEndpapers(item: any): PaidEndpapers {
    const none: PaidEndpapers = { first: false, last: false };
    const opts = item?.options;
    if (!opts || typeof opts !== 'object') return none;

    let raw = '';
    for (const [key, value] of Object.entries(opts)) {
        if (!ENDPAPER_OPTION_KEY.test(key)) continue;
        raw = String(value ?? '');
        break;
    }
    if (!raw || !/так/i.test(raw)) return none;

    const first = /перш/i.test(raw);
    const last = /останн/i.test(raw);
    if (!first && !last) return { first: true, last: true };
    return { first, last };
}

/**
 * Де в макеті лежать форзаци, або null, якщо цей макет їх окремо не несе.
 *
 * Ознака та сама, що в рендері: товар друкується посторінково І фізичних
 * сторінок рівно на дві більше, ніж оплачено. Старіші макети тримали форзаци
 * ВСЕРЕДИНІ оплаченої кількості, і чіпати їх не можна.
 */
export function endpaperIndexes(project: any): EndpaperIndexes | null {
    const pages = Array.isArray(project?.pages_data) ? project.pages_data : null;
    if (!pages || pages.length < 2) return null;

    const config = project?.overlays_data?.config || {};
    const slug = String(config?.productSlug || project?.product_type || '');
    if (!ENDPAPER_PRODUCTS.test(slug)) return null;

    const ordered = parseInt(String(config?.selectedPageCount || '').match(/\d+/)?.[0] || '0', 10) || 0;
    const content = pages.length - 1; // pages_data[0] — обкладинка
    if (!ordered || content < ordered + 2) return null;

    return { first: 1, last: content };
}

/**
 * Чи є на сторінці хоч щось. Перелік шарів мусить збігатися з `pageHasContent`
 * у сервісі рендеру: фото, текст, вільні слоти, наліпки, фігури, QR і фон.
 * Забути тут шар означає сказати «порожньо» про сторінку, яку рендер віддасть.
 */
export function pageHasContent(project: any, index: number): boolean {
    const pages = Array.isArray(project?.pages_data) ? project.pages_data : [];
    const page = pages[index];
    if (!page) return false;

    if (Array.isArray(page.slots) && page.slots.some((s: any) => s?.photoId)) return true;
    if (Array.isArray(page.textBlocks) && page.textBlocks.length > 0) return true;

    const overlays = project?.overlays_data || {};
    const key = String(index);
    for (const bag of ['freeSlots', 'pageStickers', 'pageShapes', 'qrOverlays'] as const) {
        const list = (overlays as any)?.[bag]?.[key];
        if (Array.isArray(list) && list.length > 0) return true;
    }
    if ((overlays as any)?.pageBgs?.[key]) return true;

    return false;
}

/** Ім'я файлу без теки, у нижньому регістрі. */
const baseName = (path: string) => String(path || '').split('/').pop()?.toLowerCase() || '';

/**
 * Звірка набору форзаців цього виробу.
 *
 * `fileNames` — імена файлів, які належать САМЕ цьому макету (шлях або назва).
 * `item` — рядок замовлення цього виробу, або null, коли зіставити не вдалося:
 * тоді про оплату нічого не кажемо, а порожні форзаци все одно рахуємо, бо від
 * них залежить очікувана кількість сторінок.
 */
export function checkEndpapers(project: any, item: any, fileNames: string[]): EndpaperVerdict {
    const idx = endpaperIndexes(project);
    if (!idx) return { skipped: 0, problems: [] };

    const names = new Set((fileNames || []).map(baseName));
    const paid = item ? paidEndpapers(item) : { first: false, last: false };

    const sides = [
        { label: 'перший', file: 'f1.jpg', has: pageHasContent(project, idx.first), paid: paid.first },
        { label: 'останній', file: 'f2.jpg', has: pageHasContent(project, idx.last), paid: paid.last },
    ];

    const problems: string[] = [];
    let skipped = 0;

    for (const side of sides) {
        if (!side.has) {
            // Порожній форзац рендер не віддає — це не втрата, а правило.
            skipped++;
            if (side.paid) {
                problems.push(
                    `оплачено друк на форзацах, а ${side.label} форзац у макеті порожній — файлу ${side.file} не буде, перегенерація тут не допоможе`,
                );
            }
            continue;
        }
        if (!names.has(side.file)) {
            problems.push(
                `${side.label} форзац у макеті не порожній, а файлу ${side.file} немає — рендер його не віддав`,
            );
        }
    }

    return { skipped, problems };
}

/**
 * Який рядок замовлення описує цей макет.
 *
 * Надійний шлях один — ключ позиції кошика, який макет несе в `cart_payload`
 * (див. lib/orders/design-ownership). Його немає на старих замовленнях, і тоді
 * зіставляємо лише там, де вибір однозначний: один-єдиний друкований рядок або
 * одна-єдина позиція взагалі. Здогадуватись не можна: приписати макету чужий
 * рядок означає сказати про оплату те, чого не було.
 */
export function itemForProject(items: any[], project: any): any | null {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return null;

    const cartId = String(project?.cart_payload?.id || '');
    if (cartId) {
        const hit = list.find(it => String(it?.cart_item_id || it?.id || '') === cartId);
        if (hit) return hit;
    }

    const printable = list.filter(it =>
        ENDPAPER_PRODUCTS.test(`${it?.slug || ''} ${it?.product_name || it?.name || ''}`)
        || /журнал|книг|альбом/i.test(`${it?.product_name || it?.name || ''}`));
    if (printable.length === 1) return printable[0];
    if (list.length === 1) return list[0];
    return null;
}
