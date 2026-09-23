/**
 * Сторож тихих втрат у замовленнях.
 *
 * ЧОМУ ВІН ІСНУЄ. 17.09.2026 за один день знайшлося пʼять різних поломок, і всі
 * вони мали одну спільну рису: дані про кожну ВЖЕ лежали в базі, і ніхто в них
 * не дивився. Фото Юлії Джулай гинули об стелю Vercel і писали 413 у
 * upload_attempt_log — шістнадцять замовлень із серпня. Її заявка приїхала без
 * товару і на нуль гривень. Через той нуль вона не поїхала в CRM. Листа їй не
 * надіслав ніхто. Дізналися ми аж тоді, коли клієнтка через дві доби написала
 * в дирекг сама: «щось далі не розумію як все буде відбуватись».
 *
 * Кожну з цих причин полагоджено окремо. Цей файл — про інше: він ловить
 * НАСТУПНУ, бо хвороба не в конкретній причині, а в тому, що втрата нічим себе
 * не виявляє. Вартість помилки несиметрична: зламане показує себе лише тоді,
 * коли хтось відкриє сторінку або напише нам, а мовчазний рядок у журналі не
 * приходить нікому.
 *
 * ЩО САМЕ ВІН ДИВИТЬСЯ. Шість ознак, кожна з яких уже ставалася:
 *   photos      — фото не доїхали (photos_attached менше за photos_submitted)
 *   no_product  — заявка з дизайнером без товару і без ціни
 *   no_email    — замовленню більше кількох годин, а листів за ним нема жодного
 *   not_in_crm  — кандидат на перенесення висить кандидатом уже кілька годин,
 *                 тобто перенесення мовчки падає щопроходу
 *   no_layout   — книга в замовленні, за якою немає жодного макета
 *   no_forzat   — оплачено друк на форзаці, а файлу форзаца в наборі немає
 *   short_print — у виробі менше друкованих аркушів, ніж людина замовила
 *
 * ЧОМУ НЕ БІЛЬШЕ. Сторож, який кричить вовк, вимикають, і тоді ми знову в
 * тиші — у цьому ж репозиторії вже довелося окремо вгамовувати сканер. Тому
 * тут лише те, що ставалося насправді, і кожна ознака має поріг, нижче якого
 * вона мовчить.
 *
 * Рішення відокремлене від читання бази і від надсилання — так само, як у
 * сторожі відкату брифа. Сторож, який помиляється саме тут, або мовчить про
 * поломку, або дзвонить щопроходу.
 */

import { forzatShortfallLine, missingForzatFiles, paidForzatSides, type ForzatSides } from '@/lib/print/forzat-expectation';
import { projectIdFromExportPath } from '@/lib/print/register-export-files';

/** Памʼять про вже надіслані сигнали: ключ ознаки → коли сказали. */
export const LOST_SIGNALS_KEY = 'lost_order_signals_state';

/**
 * Слід кожного проходу. Сторож, який мовчить, і сторож, якого ніхто не
 * запускав, виглядають однаково, а це різні речі.
 */
export const LOST_SIGNALS_WATCH_KEY = 'lost_order_signals_watch';

/**
 * Скільки годин дати замовленню, перш ніж відсутність листа стає сигналом.
 *
 * Лист іде за секунди, але між вставкою замовлення і відправкою є мережа,
 * черга і людина, яка могла закрити вкладку посеред оформлення. Три години —
 * це свідомо багато: нам треба ловити «не шле ніколи», а не «ще не встиг».
 */
export const EMAIL_GRACE_HOURS = 3;

/**
 * Скільки годин кандидат може лишатися кандидатом на перенесення.
 *
 * Крон ходить кожні пів години і щоразу пробує весь список. Якщо замовлення
 * досі в списку через шість годин, це дванадцять невдалих спроб поспіль, і це
 * вже не збіг.
 */
export const CRM_STALE_HOURS = 6;

/** Скільки сигналів показувати за один прохід. Решта порахована в підсумку. */
export const MAX_PER_PASS = 5;

/**
 * Скільки годин дати книзі, перш ніж відсутність макета стає сигналом.
 *
 * Макет привʼязується під час оформлення, тобто в ті самі секунди. Година —
 * це запас на повільну мережу і на вкладку, яку закрили посеред запису.
 */
export const LAYOUT_GRACE_HOURS = 1;

/**
 * Товари, у яких макет із конструктора мусить бути.
 *
 * Перелік навмисно той самий, що й у оформленні, коли воно вирішує, чи слати
 * дизайн на рендер: розходження означало б, що сторож чекає макета там, де
 * його ніхто й не мав зробити.
 */
export const BOOK_SLUG_RE = /(photobook|fotoknig|travel|magazine|zhurnal|journal|planner|wish|pobazhan)/;

export type SignalKind = 'photos' | 'no_product' | 'no_email' | 'not_in_crm' | 'no_layout' | 'no_forzat' | 'short_print';

/**
 * Скільки годин дати замовленню, перш ніж неповний набір для друку стає
 * сигналом.
 *
 * Рендер іде за хвилину-дві після оплати, тож три години — це свідомо багато:
 * ловимо «файлів немає і не буде», а не «ще рендериться». Поріг один на обидві
 * друкарські ознаки — і на нестачу форзаца, і на нестачу аркушів, — бо питання
 * в них теж одне: рендер уже мав відбутися.
 */
export const PRINT_GRACE_HOURS = 3;

/**
 * ЩО САМЕ ВІДРЕНДЕРИЛОСЯ ПО КОЖНОМУ ВИРОБУ ОКРЕМО.
 *
 * Досі обидві друкарські ознаки дивилися на імена файлів УСЬОГО замовлення
 * однією купою, і на замовленні з кількома книгами це відповідало неправду в
 * обидва боки. Чужий `f1.jpg` ховав нестачу свого, а книга, у якої не зібралася
 * половина аркушів, узагалі не мала кому про себе сказати.
 *
 * `orderedSheets` береться з рядка кошика, а не з макета, і це свідомо. У
 * друкарський набір іде рівно стільки пронумерованих аркушів, скільки людина
 * замовила: у старій моделі форзаци сидять усередині цього числа, у новій вони
 * зайві сторінки з власними іменами f1 та f2. Рядок кошика до того ж не
 * змінюється, коли клієнтка править макет після рендеру, тож ознака не
 * спрацьовує на те, що файли просто старші за макет — про це є окрема
 * перевірка «Перевірити макет» в адмінці.
 *
 * `forzatExtra` читається з самого макета, бо ззовні ці дві моделі не
 * розрізнити: і тревелбук із форзацами в нумерації, і журнал із двома
 * порожніми форзацами дають однакову теку без f1 та f2. `null` означає, що
 * макет не читали, і тоді про форзац не кажемо нічого — мовчання дешевше за
 * хибну тривогу, якою вже відзначилося TM-001354.
 */
export type BookPrintState = {
    projectId: string | null;
    cartItemId: string | null;
    /** Як назвати виріб у повідомленні. */
    label: string;
    /** Скільки аркушів замовлено — з рядка кошика. Нуль означає «не знаємо». */
    orderedSheets: number;
    /** Усі імена файлів саме цього виробу, включно з обкладинкою. */
    files: string[];
    /** Чи несе макет форзаци ОКРЕМИМИ аркушами f1/f2. null — макет не читали. */
    forzatExtra: boolean | null;
    /** За які форзаци заплачено в цьому рядку кошика. */
    paid: ForzatSides;
};

/**
 * ЩО В ТЕЦІ Є АРКУШЕМ КНИГИ.
 *
 * Перелічено за формою імені, а не «усе, крім обкладинки». Різниця не
 * теоретична: у теці лежать і вставки на обкладинку на кшталт `akryl_1.jpg`, і
 * згенеровані сервером `cover_bw.jpg` та `insert_photo.jpg`, і кожна з них
 * додавала б до лічильника аркуш, якого в книзі немає. На TM-001094 саме такий
 * `akryl_1.jpg` робив із вісімнадцяти розворотів девʼятнадцять.
 *
 * Форм рівно чотири: `01.jpg` — нинішня нумерація, `01_page.jpg` — та сама
 * сторінка за старим іменем, `01_spread.jpg` — розворот фотокниги, `f1`/`f2` —
 * форзаци.
 */
const SHEET_NAME_RE = /^(\d+(_page|_spread)?|f1|f2)\.jpe?g$/i;

/** Аркуші цього виробу. f1 та f2 рахуються аркушами, обкладинка — ні. */
export function sheetFilesOf(book: BookPrintState): string[] {
    return (book.files || []).filter(n => SHEET_NAME_RE.test(String(n || '').trim()));
}

/**
 * СКІЛЬКИ ФАЙЛІВ МАЄ ДАТИ ЦЕЙ ВИРІБ.
 *
 * Питання не таке просте, як «скільки сторінок замовили», бо одиниця в різних
 * виробів різна. Тревелбук і журнал ріжуться на сторінки, тож файл дорівнює
 * сторінці. Фотокнига експортується розворотами, тож файл дорівнює ДВОМ
 * сторінкам, і порівняння з кількістю сторінок оголошувало б неповним кожен
 * справний фотокнижковий набір: 23.09.2026 таких було шість із двадцяти шести.
 *
 * Одиницю питаємо в самих файлів, а не вгадуємо зі slug: ім'я `NN_spread.jpg`
 * каже про неї прямо і не може розійтися з тим, що насправді лежить у теці.
 */
export function expectedSheetCount(book: BookPrintState): number {
    if (!(book.orderedSheets > 0)) return 0;
    const sheets = sheetFilesOf(book);
    const spreads = sheets.filter(n => /_spread\.jpe?g$/i.test(n)).length;
    // Розворотами — тільки коли розворотами зібрано ВЕСЬ виріб. Мішанина
    // означає, що ми чогось не розуміємо, і тоді краще порахувати сторінками:
    // помилитися в бік мовчання дешевше, ніж у бік хибної тривоги.
    const bySpreads = spreads > 0 && spreads === sheets.length;
    return bySpreads ? Math.ceil(book.orderedSheets / 2) : book.orderedSheets;
}

/**
 * Чи зібрано цей набір ЩЕ ДО ТОГО, як форзаци дістали власні імена.
 *
 * Імена `NN_page.jpg` рендер перестав писати 11.08.2026, коли друкарня
 * попросила `f1.jpg` та `f2.jpg` окремо. У наборах, старших за ту дату,
 * форзаци пішли звичайними пронумерованими аркушами, і вимагати від них
 * окремих файлів означає кричати на те, що давно надруковано як слід:
 * TM-001110 від 2 серпня і TM-001091 від 26 липня — саме такі.
 */
export function isLegacyPageNaming(book: BookPrintState): boolean {
    return sheetFilesOf(book).some(n => /_page\.jpe?g$/i.test(n));
}

export type OrderRow = {
    id: string;
    order_number: string | null;
    created_at: string | null;
    with_designer?: boolean | null;
    total?: number | string | null;
    items?: any;
    customer_email?: string | null;
    customer_name?: string | null;
    source?: string | null;
    custom_attributes?: Record<string, any> | null;
};

export type LostSignal = {
    kind: SignalKind;
    orderId: string;
    orderNumber: string;
    createdAt: string | null;
    /** Речення для чату — що саме сталося з цим замовленням. */
    detail: string;
};

export type SignalStore = Record<string, number>;

const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const hoursSince = (iso: string | null, now: number): number =>
    iso ? (now - new Date(iso).getTime()) / 3600_000 : 0;

/**
 * Книги цього замовлення, за якими макета немає.
 *
 * ЧОМУ ПО ІДЕНТИФІКАТОРУ РЯДКА, А НЕ ПО ЛІЧИЛЬНИКУ. Спокуса була порахувати
 * книги й макети і порівняти числа. Так робити не можна: на TM-001314 три
 * книги оплачені в одному замовленні, а зібрані в інших, і лічильник кричав би
 * на цілком справну картку. Тридцятиденний прохід по живій базі дав чотири
 * таких замовлення, і жодне з них не було поломкою.
 *
 * Тому звірка точкова: кожен рядок кошика несе свій `cart_item_id`, і макет
 * зберігається під тим самим ключем. Рядок без макета — це рядок, за яким
 * друкувати нічого, і жодного здогаду тут не лишається.
 *
 * Рядки без `cart_item_id` пропускаються свідомо. Замовлення, оформлені до
 * того, як ключ почали зберігати, звірити нічим, а сторож, який кричить на
 * старе, вимикається разом із тим, заради чого його ставили.
 */
export function bookLinesWithoutLayout(
    items: unknown,
    knownCartIds: Set<string>,
): { cartItemId: string; name: string }[] {
    if (!Array.isArray(items)) return [];
    const out: { cartItemId: string; name: string }[] = [];
    for (const it of items) {
        if (!it || typeof it !== 'object') continue;
        const slug = String((it as any).slug || '').toLowerCase();
        if (!slug || !BOOK_SLUG_RE.test(slug)) continue;
        const cartItemId = String((it as any).cart_item_id || '').trim();
        if (!cartItemId) continue;
        if (knownCartIds.has(cartItemId)) continue;
        out.push({ cartItemId, name: String((it as any).product_name || slug) });
    }
    return out;
}

/** Ключ, за яким та сама ознака того самого замовлення вважається тією самою. */
export function signalKey(s: Pick<LostSignal, 'kind' | 'orderId'>): string {
    return `${s.kind}:${s.orderId}`;
}

/**
 * Усі ознаки, які видно в цій вибірці.
 *
 * `emailedOrderIds` — замовлення, за якими лист уже є (успішний чи ні: сам факт
 * спроби знімає підозру, що листа не шле НІХТО). `crmCandidateSince` — коли
 * замовлення вперше побачили кандидатом на перенесення; порожня мапа означає,
 * що цю ознаку просто не перевіряють.
 */
export function findLostOrderSignals(input: {
    orders: OrderRow[];
    emailedOrderIds: Set<string>;
    crmCandidateSince: Map<string, string>;
    /** Ідентифікатори рядків кошика, за якими макет у базі вже є. */
    layoutCartIds?: Set<string>;
    /** Що відрендерилося по кожному виробу окремо — обидві друкарські ознаки. */
    booksByOrder?: Map<string, BookPrintState[]>;
    /**
     * Замовлення, які потрапили сюди поза вікном — лише тому, що досі чекають
     * друку. Для них перевіряються ТІЛЬКИ друкарські ознаки.
     *
     * Часові ознаки на них не мають сенсу і були б шкідливі. Скарга на лист,
     * якого не надіслали в липні, вже нікому не допоможе, а двісті таких скарг
     * за один прохід — це рівно той сторож, якого вимикають.
     */
    printOnlyOrderIds?: Set<string>;
    now: number;
}): LostSignal[] {
    const out: LostSignal[] = [];
    const layoutCartIds = input.layoutCartIds || new Set<string>();
    const booksByOrder = input.booksByOrder || new Map<string, BookPrintState[]>();
    const printOnly = input.printOnlyOrderIds || new Set<string>();

    for (const o of input.orders) {
        const orderNumber = o.order_number || '(без номера)';
        const base = { orderId: o.id, orderNumber, createdAt: o.created_at };
        const attrs = o.custom_attributes || {};

        // Замовлення, яке потрапило сюди лише тому, що досі чекає друку,
        // перевіряється тільки друкарськими ознаками — дивіться `printOnly`.
        const timeSignals = !printOnly.has(o.id);

        // 1. Фото не доїхали. Обидва числа пише саме оформлення, тож їх
        //    відсутність означає лише те, що замовлення з іншого потоку.
        const submitted = num(attrs.photos_submitted);
        const attached = num(attrs.photos_attached);
        if (timeSignals && submitted > 0 && attached < submitted) {
            const lost = submitted - attached;
            out.push({
                ...base,
                kind: 'photos',
                detail: `доїхало ${attached} фото з ${submitted}, бракує ${lost}`,
            });
        }

        // 2. Заявка з дизайнером без товару. Нуль гривень сам по собі не
        //    ознака — у заявці ціни ще й не мусить бути. Ознакою є нуль РАЗОМ
        //    із порожнім товаром: тоді ми не знаємо навіть, про що йдеться.
        if (timeSignals && o.with_designer) {
            const first = Array.isArray(o.items) ? o.items[0] : null;
            const slug = String(first?.product_slug || '').trim();
            const hasOptions = first?.options && typeof first.options === 'object'
                && Object.keys(first.options).length > 0;
            if (!slug && !hasOptions && num(o.total) === 0) {
                out.push({
                    ...base,
                    kind: 'no_product',
                    detail: 'заявка з дизайнером приїхала без товару, без опцій і на нуль гривень',
                });
            }
        }

        // 3. Жодного листа. Тільки для замовлень із сайту і тільки там, де є
        //    куди писати: дзеркалена копія з CRM листів і не мусить мати.
        const age = hoursSince(o.created_at, input.now);
        if (
            timeSignals
            && o.customer_email
            && o.source !== 'keycrm'
            && age >= EMAIL_GRACE_HOURS
            && !input.emailedOrderIds.has(o.id)
        ) {
            out.push({
                ...base,
                kind: 'no_email',
                detail: `${Math.floor(age)} год від оформлення, і за замовленням немає жодного листа`,
            });
        }

        // 5. Книга без макета. Саме так TM-001342 ледь не поїхало в друк
        //    двома копіями однієї книги: у замовленні дві різні тревелбуки, а
        //    привʼязаний макет був один, і дізналися ми про це від менеджерки,
        //    яка звіряла картку руками.
        if (timeSignals && !o.with_designer && age >= LAYOUT_GRACE_HOURS) {
            const orphans = bookLinesWithoutLayout(o.items, layoutCartIds);
            for (const line of orphans) {
                out.push({
                    ...base,
                    kind: 'no_layout',
                    detail: `«${line.name}» оплачено, а макета за цією позицією немає жодного`,
                });
            }
        }

        // 6 і 7. Друкарський набір: нестача форзаца і нестача аркушів.
        //
        //    Обидві ознаки дивляться ПО ВИРОБАХ, а не по замовленню однією
        //    купою. Купа відповідала неправду в обидва боки: на TM-001354 вона
        //    підняла хибну тривогу про форзац, бо в тих тревелбуках форзаци
        //    йдуть пронумерованими аркушами і файлів f1 та f2 у них не буває
        //    взагалі, а на замовленні з пʼятьма книгами чужий f1 ховав би
        //    нестачу свого.
        //
        //    Обидві мовчать, поки в замовленні НЕМАЄ жодного експорту: макет,
        //    який ще не рендерився, — це ознака no_layout, і кричати про нього
        //    двічі означає навчити не читати.
        const books = booksByOrder.get(o.id) || [];
        const orderRendered = books.some(b => (b.files || []).length > 0);
        if (orderRendered && age >= PRINT_GRACE_HOURS) {
            // 6. Оплачений форзац без файлу.
            //
            //    Сервіс рендеру навмисно не вантажить ПОРОЖНІЙ форзац:
            //    друкарня просила не отримувати чистих аркушів. Коли за форзац
            //    заплатили, той самий пропуск стає тихою втратою — у теці
            //    просто немає f1, а рядок про це лишається в консолі Railway,
            //    куди ніхто не дивиться. TM-001352 оплатило обидва форзаци й
            //    отримало тільки f2, TM-001349 оплатило обидва й не отримало
            //    жодного.
            //
            //    Питаємо лише там, де форзац МАЄ бути окремим файлом. Макет,
            //    у якому форзаци сидять усередині нумерації, окремих файлів не
            //    дає за будовою, і вимагати їх від нього означає кричати на
            //    справний набір.
            const shortfalls: string[] = [];
            for (const b of books) {
                if (b.forzatExtra !== true) continue;
                // Набір, зібраний до 11.08.2026, форзаців окремими файлами не
                // має за визначенням — там вони пронумеровані разом зі
                // сторінками.
                if (isLegacyPageNaming(b)) continue;
                const missing = missingForzatFiles(b.paid, sheetFilesOf(b));
                if (!missing.length) continue;
                shortfalls.push(books.length > 1
                    ? `«${b.label}»: ${forzatShortfallLine(missing)}`
                    : forzatShortfallLine(missing));
            }
            // Одна скарга на замовлення, скільки б виробів вона не називала:
            // два однакові рядки поспіль читаються як помилка сторожа, а не як
            // дві втрати.
            if (shortfalls.length) {
                out.push({ ...base, kind: 'no_forzat', detail: shortfalls.join('; ') });
            }

            // 7. Аркушів менше, ніж замовлено.
            //
            //    Рендер іде розворотами, і розворот, який упав, пропускається
            //    цілком — разом з обома своїми сторінками. Помилки при цьому
            //    немає ніде: у теці просто менше файлів, картка виглядає
            //    справною, і дізнаєшся про це аж у друкарні. TM-001244 поїхало
            //    б без аркушів 01, 04, 05 і без початкового форзаца, а
            //    TM-001354 — трьома книгами з чотирьох, одна з яких мала саму
            //    лише обкладинку.
            //
            //    Кажемо тільки про НЕСТАЧУ. Надлишок теж буває — старий рендер
            //    нумерував форзаци разом зі сторінками, тож у теці лежить на
            //    два аркуші більше, — але надлишок себе показує, а тиха втрата
            //    ні, і звірку зайвого вже робить «Перевірити макет».
            //
            //    Мовчимо там, де не впізнали макет виробу. Нуль файлів у такої
            //    позиції означає не втрату, а те, що ми не змогли зіставити
            //    файли з книгою: на TM-001342 рядки кошика не несуть ключа, і
            //    порахувати нуль аркушів замість двадцяти було б наклепом на
            //    справний набір. Книгу зовсім без макета ловить no_layout.
            const short = books
                .filter(b => b.projectId
                    && b.orderedSheets > 0
                    && sheetFilesOf(b).length < expectedSheetCount(b))
                .map(b => {
                    const have = sheetFilesOf(b).length;
                    const want = expectedSheetCount(b);
                    return books.length > 1
                        ? `«${b.label}»: ${have} аркушів замість ${want}`
                        : `у теці ${have} аркушів, а мало бути ${want}`;
                });
            if (short.length) {
                out.push({
                    ...base,
                    kind: 'short_print',
                    detail: books.length > 1
                        ? `набір неповний у ${short.length} виробах — ${short.join('; ')}`
                        : short[0],
                });
            }
        }

        // 4. Висить кандидатом на перенесення. Крон пробує щопівгодини, тож
        //    шість годин — це дванадцять невдалих спроб поспіль.
        const since = timeSignals ? input.crmCandidateSince.get(o.id) : undefined;
        if (since) {
            const waiting = hoursSince(since, input.now);
            if (waiting >= CRM_STALE_HOURS) {
                out.push({
                    ...base,
                    kind: 'not_in_crm',
                    detail: `${Math.floor(waiting)} год у черзі на перенесення в CRM, і воно щоразу не відбувається`,
                });
            }
        }
    }

    return out;
}

/**
 * Про що казати цього разу.
 *
 * Про кожну ознаку кожного замовлення — рівно один раз. Повторити те саме
 * через пів години означає навчити не читати, а тиха поломка лікується саме
 * читанням.
 */
export function decideLostSignals(
    signals: LostSignal[],
    store: SignalStore,
    now: number,
): { fresh: LostSignal[]; nextStore: SignalStore } {
    const nextStore: SignalStore = { ...store };
    const fresh: LostSignal[] = [];

    for (const s of signals) {
        const key = signalKey(s);
        if (nextStore[key]) continue;
        nextStore[key] = now;
        fresh.push(s);
    }
    return { fresh, nextStore };
}

/**
 * Прибирання памʼяті. Без нього рядок у налаштуваннях ріс би вічно, а
 * замовлення, розібране три місяці тому, лишалося б «уже відомим» назавжди.
 */
export function pruneSignalStore(store: SignalStore, now: number, keepDays = 30): SignalStore {
    const cutoff = now - keepDays * 86400_000;
    const kept: SignalStore = {};
    for (const [key, at] of Object.entries(store || {})) {
        if (num(at) >= cutoff) kept[key] = num(at);
    }
    return kept;
}

/** Коли кожне замовлення вперше побачили кандидатом на перенесення. */
export const CRM_QUEUE_KEY = 'lost_order_crm_queue';

/**
 * Оновити чергу кандидатів.
 *
 * Замовлення, яке зникло зі списку, перенеслося або свідомо випало з
 * вікна — в обох випадках його треба забути, інакше воно вічно виглядало б
 * застряглим. Дата першої зустрічі ніколи не перезаписується: саме вона й є
 * відповіддю на питання «скільки воно вже не переноситься».
 */
export function trackCrmCandidates(
    previous: Record<string, string>,
    currentIds: string[],
    nowIso: string,
): Record<string, string> {
    const next: Record<string, string> = {};
    for (const id of currentIds) {
        next[id] = previous?.[id] || nowIso;
    }
    return next;
}

const TITLES: Record<SignalKind, string> = {
    photos: 'Фото не доїхали',
    no_product: 'Заявка без товару',
    no_email: 'Замовлення без жодного листа',
    not_in_crm: 'Замовлення не переноситься в CRM',
    no_layout: 'Книга без макета',
    no_forzat: 'Оплачений форзац без файлу',
    short_print: 'Неповний набір для друку',
};

function kyivTime(iso: string | null): string {
    if (!iso) return 'невідомо коли';
    try {
        return new Intl.DateTimeFormat('uk-UA', {
            timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit',
            hour: '2-digit', minute: '2-digit',
        }).format(new Date(iso));
    } catch {
        return iso;
    }
}

/**
 * Повідомлення в робочий чат.
 *
 * Одне на прохід, а не одне на сигнал: пʼять повідомлень поспіль — це та сама
 * стіна, яку ніхто не читає.
 */
export function formatLostSignals(signals: LostSignal[]): string {
    const shown = signals.slice(0, MAX_PER_PASS);
    const rest = signals.length - shown.length;

    const lines = [
        '⚠️ Тихі втрати в замовленнях.',
        '',
        'Це те, про що ніхто не дізнався б, доки клієнт не написав би сам.',
        '',
    ];

    for (const s of shown) {
        lines.push(`${TITLES[s.kind]} — ${s.orderNumber} від ${kyivTime(s.createdAt)}: ${s.detail}.`);
    }

    if (rest > 0) {
        lines.push('', `Ще ${rest} таких у цьому ж проході, решта в адмінці.`);
    }

    return lines.join('\n');
}

type Sender = (text: string) => Promise<boolean>;

/**
 * Скільки годин назад дивитися. Доба з запасом: крон ходить щопівгодини, тож
 * ширше вікно означало б лише більше читання без жодної нової знахідки.
 */
const WINDOW_HOURS = 36;

/** Стовпці замовлення, які читає сторож. Один перелік на обидва читання. */
const ORDER_COLUMNS =
    'id, order_number, created_at, with_designer, total, items, customer_email, customer_name, source, custom_attributes';

/**
 * Сторінка за сторінкою, бо `orders` росте від роботи магазину (гоча 14).
 *
 * Обидва читання сторожа зараз дають сотні рядків, а не тисячі, але саме
 * «подивитися на сьогоднішню кількість» нас уже підводило. Цикл коштує один
 * зайвий запит і знімає питання назавжди.
 */
async function readAllOrders(query: any): Promise<OrderRow[]> {
    const PAGE = 1000;
    const out: OrderRow[] = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await query.range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = (data || []) as OrderRow[];
        out.push(...rows);
        if (rows.length < PAGE) return out;
    }
}

/** Скільки аркушів названо в рядку кошика. Нуль означає «не сказано». */
export function orderedSheetsOfLine(line: unknown): number {
    if (!line || typeof line !== 'object') return 0;
    const opts = (line as any).options;
    const raw = opts && typeof opts === 'object' ? String(opts['Сторінок'] ?? '') : '';
    const n = parseInt(raw.match(/\d+/)?.[0] || '0', 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Що відрендерилося по кожному виробу кожного замовлення.
 *
 * ЧОМУ МАКЕТИ ЧИТАЮТЬСЯ НЕ ЗАВЖДИ. `pages_data` важить сотні кілобайтів на
 * книгу, а крон ходить щопівгодини, тож тягнути їх на всі замовлення вікна
 * означало б десятки мегабайтів заради одного числа. Макет потрібен рівно для
 * одного питання — чи несе цей виріб форзаци окремими аркушами, — і питання це
 * має сенс лише там, де за форзац заплатили. Таких замовлень 23.09.2026 було
 * двадцять із двохсот девʼяноста восьми.
 *
 * Нестача аркушів макета не потребує взагалі: скільки їх мало бути, каже рядок
 * кошика.
 */
async function readBookPrintStates(
    supabase: any,
    orders: OrderRow[],
): Promise<Map<string, BookPrintState[]>> {
    const out = new Map<string, BookPrintState[]>();
    if (!orders.length) return out;

    // Файли по замовленнях. `project_id` проставляє реєстрація експорту; у
    // старих рядках його немає, тож виріб упізнаємо ще й зі шляху.
    const filesByOrder = new Map<string, { projectId: string | null; name: string }[]>();
    const { data: exports } = await supabase
        .from('order_files')
        .select('order_id, project_id, file_name, file_path')
        .eq('file_type', 'export')
        .in('order_id', orders.map(o => o.id))
        .limit(5000);
    for (const row of exports || []) {
        const oid = String(row?.order_id || '');
        if (!oid) continue;
        const list = filesByOrder.get(oid) || [];
        list.push({
            projectId: row?.project_id
                ? String(row.project_id)
                : projectIdFromExportPath(String(row?.file_path || '')),
            name: String(row?.file_name || ''),
        });
        filesByOrder.set(oid, list);
    }

    // Макети тих замовлень, де за форзац заплатили І вже щось відрендерилося.
    const needDesign = new Set<string>();
    for (const o of orders) {
        if (!filesByOrder.get(o.id)?.length) continue;
        if (!Array.isArray(o.items)) continue;
        const paid = o.items.some((it: any) => {
            const s = paidForzatSides(it?.options);
            return s.first || s.last;
        });
        if (paid) needDesign.add(o.id);
    }
    const designsByOrder = new Map<string, any[]>();
    if (needDesign.size) {
        const { data: projects } = await supabase
            .from('projects')
            .select('id, order_id, cart_payload, pages_data, overlays_data, product_type')
            .in('order_id', [...needDesign])
            .limit(200);
        for (const p of projects || []) {
            const oid = String(p?.order_id || '');
            if (!oid) continue;
            const list = designsByOrder.get(oid) || [];
            list.push(p);
            designsByOrder.set(oid, list);
        }
    }

    for (const o of orders) {
        const files = filesByOrder.get(o.id) || [];
        if (!files.length) continue;
        const designs = designsByOrder.get(o.id) || [];
        const items: any[] = Array.isArray(o.items) ? o.items : [];
        const books: BookPrintState[] = [];

        for (const it of items) {
            const slug = String(it?.slug || '').toLowerCase();
            if (!slug || !BOOK_SLUG_RE.test(slug)) continue;
            const cartItemId = String(it?.cart_item_id || '').trim() || null;
            // Макет шукається ПО КЛЮЧУ рядка (гоча 18). Без ключа пара
            // однозначна лише тоді, коли і позиція, і макет на замовленні одні.
            const design = cartItemId
                ? designs.find(d => String(d?.cart_payload?.id || '').trim() === cartItemId)
                : (items.length === 1 && designs.length === 1 ? designs[0] : undefined);
            const projectId = design ? String(design.id) : null;
            // Файли виробу. Коли макет один на все замовлення, беремо всі —
            // інакше старі рядки без `project_id` лишили б виріб без файлів і
            // це прочиталося б як повна втрата набору.
            const mine = (projectId
                ? files.filter(f => f.projectId === projectId)
                : (designs.length <= 1 && items.length === 1 ? files : []));
            books.push({
                projectId,
                cartItemId,
                label: String(it?.product_name || slug),
                orderedSheets: orderedSheetsOfLine(it),
                files: mine.map(f => f.name),
                forzatExtra: design ? hasForzatExtraShape(slug, design) : null,
                paid: paidForzatSides(it?.options),
            });
        }
        if (books.length) out.set(o.id, books);
    }
    return out;
}

/**
 * Чи несе цей макет форзаци ОКРЕМИМИ аркушами f1 та f2.
 *
 * Та сама умова, за якою вирішує сервіс рендеру: товар ріжеться на сторінки, і
 * змістових сторінок на дві більше, ніж замовлено в конфігу макета. Розійтися
 * їм не можна — розбіжність означала б або мовчання на справжній нестачі, або
 * крик на набір, у якому форзаци просто пронумеровані разом зі сторінками.
 */
function hasForzatExtraShape(slug: string, design: any): boolean {
    const splitToPages = ['travel', 'magazine', 'journal', 'zhurnal', 'fotozhurnal']
        .some(k => slug.includes(k));
    if (!splitToPages) return false;
    const pages = Array.isArray(design?.pages_data) ? design.pages_data : [];
    const contentPages = Math.max(0, pages.length - 1);
    const ordered = parseInt(
        String(design?.overlays_data?.config?.selectedPageCount ?? '').match(/\d+/)?.[0] || '0',
        10,
    ) || 0;
    return ordered > 0 && contentPages >= ordered + 2;
}

/**
 * Повний прохід сторожа.
 *
 * Читання бази тут, рішення — у чистих функціях вище. Помилка надсилання НЕ
 * записує памʼять, тож наступний прохід спробує ще раз: сигнал, загублений
 * через мережу, — це знову тиша, від якої ми й лікуємося.
 */
export async function checkLostOrderSignals(
    supabase: any,
    opts: { preview?: boolean; send: Sender; crmCandidateIds?: string[] },
): Promise<{ found: LostSignal[]; fresh: LostSignal[]; sent: boolean; message?: string }> {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const since = new Date(now - WINDOW_HOURS * 3600_000).toISOString();

    const windowOrders = await readAllOrders(
        supabase
            .from('orders')
            .select(ORDER_COLUMNS)
            .gte('created_at', since)
            .not('order_status', 'in', '("cancelled","refunded")')
            .order('created_at', { ascending: false }),
    );

    /**
     * ЗАМОВЛЕННЯ, ЯКІ ЩЕ НЕ ПЕРЕДАНО В ДРУК, ДИВИМОСЯ БЕЗ ОГЛЯДУ НА ВІК.
     *
     * Вікно на добу з гаком правильне для ознак, які живуть у годинах: лист
     * або пішов одразу, або не піде вже ніколи. Друкарський набір живе інакше.
     * TM-001244 стоїть неповним із 28 серпня, TM-001091 з 26 липня, і обидва
     * досі чекають друку — а сторож їх не бачив жодного разу, бо на момент,
     * коли друкарські ознаки зʼявилися, обидва давно випали з доби.
     *
     * Тому другий список: підтверджене, ще не у виробництві, ще не відправлене.
     * Замовлення, яке вже поїхало, звідси випадає само, і минуле нас не
     * наздоганяє нескінченно.
     *
     * Для цих замовлень перевіряються ТІЛЬКИ друкарські ознаки. Часові —
     * відсутність листа, черга в CRM, недовантажені фото — лишаються у вікні:
     * скарга на лист, якого не надіслали в липні, нікому вже не допоможе, а
     * сторож, який кричить вовк, вимикають.
     *
     * Міряно 23.09.2026: 292 такі замовлення, з них 30 і так у вікні, з
     * оплаченим форзацом двадцять, із готовими файлами тридцять сім.
     */
    const pendingPrintOrders = await readAllOrders(
        supabase
            .from('orders')
            .select(ORDER_COLUMNS)
            .eq('order_status', 'confirmed')
            .is('production_at', null)
            .is('shipped_at', null)
            .is('delivered_at', null)
            .in('production_status', ['pending', 'new'])
            .order('created_at', { ascending: false }),
    );

    const byId = new Map<string, OrderRow>();
    for (const o of windowOrders) if (o?.id) byId.set(o.id, o);
    const printOnlyOrderIds = new Set<string>();
    for (const o of pendingPrintOrders) {
        if (!o?.id || byId.has(o.id)) continue;
        byId.set(o.id, o);
        printOnlyOrderIds.add(o.id);
    }
    const orders: OrderRow[] = [...byId.values()];

    // За якими з них лист уже є. Спроба, навіть невдала, знімає підозру, що
    // листа не шле НІХТО, — а саме це ми тут і ловимо.
    const emailedOrderIds = new Set<string>();
    if (orders.length) {
        const { data: logs } = await supabase
            .from('email_logs')
            .select('order_id')
            .in('order_id', orders.map(o => o.id));
        for (const row of logs || []) if (row?.order_id) emailedOrderIds.add(row.order_id);
    }

    // За якими рядками кошика макет у базі вже є.
    //
    // Питаємо не «скільки макетів у замовлення», а «чи є макет саме за цим
    // рядком»: ключ той самий, під яким його зберігає оформлення. Список
    // ідентифікаторів рахується з уже прочитаних замовлень, тож окремої
    // сторінки тут не треба (гоча 14) — він обмежений вікном на добу з гаком.
    const wantedCartIds = new Set<string>();
    for (const o of orders) {
        if (!Array.isArray(o.items)) continue;
        for (const it of o.items) {
            const id = String((it as any)?.cart_item_id || '').trim();
            const slug = String((it as any)?.slug || '').toLowerCase();
            if (id && slug && BOOK_SLUG_RE.test(slug)) wantedCartIds.add(id);
        }
    }
    const layoutCartIds = new Set<string>();
    if (wantedCartIds.size) {
        const { data: designed } = await supabase
            .from('projects')
            .select('cart_payload')
            .in('cart_payload->>id', Array.from(wantedCartIds))
            .limit(1000);
        for (const row of designed || []) {
            const id = String(row?.cart_payload?.id || '').trim();
            if (id) layoutCartIds.add(id);
        }
    }

    const booksByOrder = await readBookPrintStates(supabase, orders);

    // Черга на перенесення: коли кожного кандидата побачили вперше.
    const { data: queueRow } = await supabase
        .from('settings').select('value').eq('key', CRM_QUEUE_KEY).maybeSingle();
    const previousQueue = (queueRow?.value as Record<string, string>) || {};
    const queue = opts.crmCandidateIds
        ? trackCrmCandidates(previousQueue, opts.crmCandidateIds, nowIso)
        : previousQueue;

    const found = findLostOrderSignals({
        orders,
        emailedOrderIds,
        crmCandidateSince: new Map(Object.entries(queue)),
        layoutCartIds,
        booksByOrder,
        printOnlyOrderIds,
        now,
    });

    const { data: storeRow } = await supabase
        .from('settings').select('value').eq('key', LOST_SIGNALS_KEY).maybeSingle();
    const store = pruneSignalStore((storeRow?.value as SignalStore) || {}, now);
    const { fresh, nextStore } = decideLostSignals(found, store, now);

    const heartbeat = async (outcome: string) => {
        if (opts.preview) return;
        await supabase.from('settings').upsert({
            key: LOST_SIGNALS_WATCH_KEY,
            value: {
                last_checked_at: nowIso,
                outcome,
                orders_scanned: orders.length,
                found: found.length,
                fresh: fresh.length,
            },
            updated_at: nowIso,
        });
        if (opts.crmCandidateIds) {
            await supabase.from('settings').upsert({
                key: CRM_QUEUE_KEY, value: queue, updated_at: nowIso,
            });
        }
    };

    if (!fresh.length) {
        await heartbeat(found.length ? 'already_known' : 'clean');
        return { found, fresh, sent: false };
    }

    const message = formatLostSignals(fresh);
    if (opts.preview) return { found, fresh, sent: false, message };

    const ok = await opts.send(message);
    await heartbeat(ok ? 'alerted' : 'send_failed');
    if (ok) {
        await supabase.from('settings').upsert({
            key: LOST_SIGNALS_KEY, value: nextStore, updated_at: nowIso,
        });
    }
    return { found, fresh, sent: ok, message };
}
