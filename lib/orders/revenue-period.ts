import { countedRevenue } from '@/lib/orders/payment-state';
import { fetchAllRows } from '@/lib/supabase/paginate';

/**
 * Дохід за період — одне джерело для всіх звітів.
 *
 * Навіщо. До 14.09.2026 дохід у звітах рахували двома різними способами, і
 * вони давали різні числа. Звіт P&L брав замовлення з `paid_at is not null` і
 * підсумовував `total`; сторінка витрат брала `created_at` і підсумовувала
 * отримані гроші. Два правила в одному стовпчику звірити неможливо, тож
 * правило тут одне.
 *
 * ДАТА, ЗА ЯКОЮ ДОХІД ПОТРАПЛЯЄ В ПЕРІОД, — `created_at`, дата замовлення
 * (Diana, 14.09.2026). Причина не в зручності, а в даних: у дзеркалених із
 * KeyCRM замовлень `paid_at` не заповнений ЖОДНОГО разу — 893 замовлення, з
 * них 863 з грошима, і в усіх поле порожнє. Іншого поля з часом платежу в
 * таблиці немає взагалі. Через це звіт P&L бачив 188 629 ₴ із 1 434 868 ₴
 * отриманих, тобто приблизно одну восьму обороту, і виглядало це як нормальний
 * звіт.
 *
 * Альтернативу — брати `paid_at` там, де він є, і `created_at` там, де його
 * немає — відхилено свідомо: два правила в одному стовпчику неможливо звірити
 * з випискою, і пояснити різницю через півроку не зміг би ніхто.
 *
 * Ціна цього рішення названа чесно і показана в інтерфейсі: замовлення з
 * передоплатою п'ятдесят відсотків віддає обидві половини в місяць, коли його
 * створили, навіть якщо доплату внесли пізніше. Тому поруч із числом у звіті
 * стоїть підпис REVENUE_BASIS_LABEL — щоб ніхто не шукав, чому воно не
 * збігається з банківською випискою по днях.
 */

/** Колонка, за якою дохід прив'язується до періоду. */
export const REVENUE_DATE_COLUMN = 'created_at';

/** Підпис під показником. Один на всі екрани, щоб вони не розійшлися. */
export const REVENUE_BASIS_LABEL = 'дохід за датою замовлення';

/**
 * Довше пояснення для підказки поруч із підписом.
 *
 * Без цього перше ж питання «чому не сходиться з випискою» доведеться
 * відповідати голосом, і щоразу заново.
 */
export const REVENUE_BASIS_HINT =
    'Гроші зараховуються в місяць, коли замовлення створене, а не коли надійшов платіж. '
    + 'Так зроблено тому, що в замовлень із KeyCRM дати платежу немає взагалі. '
    + 'Тому на замовленні з передоплатою обидві половини потраплять в один місяць.';

/**
 * Зона, в якій місяць вважається місяцем.
 *
 * Межі періоду мусять бути прив'язані до однієї зони, інакше екран і сервер
 * ріжуть добу в різних місцях. Київ, бо в ньому працює магазин; так само
 * рахують чат-бот і вечірні зведення.
 */
export const BUSINESS_TIMEZONE = 'Europe/Kyiv';

/** Календарна дата у вигляді `YYYY-MM-DD`. */
export type DateOnly = string;

export interface DateRange {
    start: DateOnly;
    end: DateOnly;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Розкладає мить на київські календарні частини. */
function kyivParts(instant: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: BUSINESS_TIMEZONE,
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(instant);

    const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
    // 'en-CA' о півночі віддає годину 24, а не 0.
    const hour = get('hour') % 24;
    return { year: get('year'), month: get('month'), day: get('day'), hour, minute: get('minute'), second: get('second') };
}

/**
 * Мить у UTC, що відповідає стінному часу в Києві.
 *
 * Два проходи, а не один, через перехід на літній час: перший зсув беремо в
 * зоні для приблизної миті, другий — уже для уточненої. Без цього двічі на рік
 * межа місяця з'їжджала б на годину.
 */
function kyivWallClock(year: number, month: number, day: number, hour: number, minute: number, second: number, ms: number): Date {
    const wall = Date.UTC(year, month - 1, day, hour, minute, second, ms);
    let instant = wall;
    for (let i = 0; i < 2; i++) {
        const p = kyivParts(new Date(instant));
        const seen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, ms);
        instant = wall - (seen - instant);
    }
    return new Date(instant);
}

/** Сьогоднішня календарна дата в Києві. */
export function kyivDateOnly(ref: Date = new Date()): DateOnly {
    const { year, month, day } = kyivParts(ref);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Календарну дату будь-якого вигляду зводить до `YYYY-MM-DD` за Києвом. */
function toDateOnly(value: string | Date): DateOnly {
    if (typeof value === 'string' && DATE_ONLY.test(value)) return value;
    return kyivDateOnly(typeof value === 'string' ? new Date(value) : value);
}

/** Перша мить доби в Києві, у вигляді ISO. */
export function dayStartIso(value: string | Date): string {
    const [y, m, d] = toDateOnly(value).split('-').map(Number);
    return kyivWallClock(y, m, d, 0, 0, 0, 0).toISOString();
}

/** Остання мить доби в Києві, у вигляді ISO. Межа періоду включна. */
export function dayEndIso(value: string | Date): string {
    const [y, m, d] = toDateOnly(value).split('-').map(Number);
    return kyivWallClock(y, m, d, 23, 59, 59, 999).toISOString();
}

/** Діапазон календарного місяця, `month` рахується від одиниці. */
export function monthRange(year: number, month: number): DateRange {
    const y = year + Math.floor((month - 1) / 12);
    const m = ((month - 1) % 12 + 12) % 12 + 1;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(lastDay)}` };
}

/**
 * Діапазон періоду, який вибирають на екрані.
 *
 * Навіщо це тут, поруч із правилом доходу. До 15.09.2026 кожен екран будував
 * межі сам, і будував по-різному. Сторінка витрат брала місяць у часовій зоні
 * браузера, а звіт P&L робив так:
 *
 *     new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
 *
 * У браузері з UTC+3 перше вересня опівночі — це `2026-08-31T21:00Z`, тож у
 * рядок потрапляло `2026-08-31`, і обидві межі місяця з'їжджали на добу назад.
 * Через це той самий вересень давав 307 757 ₴ на сторінці витрат і 327 338 ₴ у
 * звіті: двадцять одне замовлення від 31 серпня звіт зараховував у вересень.
 *
 * Друга частина тієї самої халепи — `.lte('created_at', '2026-09-30')`
 * порівнюється з опівніччю останнього дня, тобто останній день місяця не
 * входив у період узагалі. На графіку за дванадцять місяців це коштувало
 * 51 595 ₴ у липні та 19 581 ₴ у серпні.
 */
export function periodRange(kind: 'month' | 'quarter' | 'year', ref: Date = new Date()): DateRange {
    const { year, month } = kyivParts(ref);
    if (kind === 'month') return monthRange(year, month);
    if (kind === 'quarter') {
        const first = Math.floor((month - 1) / 3) * 3 + 1;
        return { start: monthRange(year, first).start, end: monthRange(year, first + 2).end };
    }
    return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export interface PeriodRevenue {
    /** Скільки грошей надійшло по замовленнях цього періоду. */
    revenue: number;
    /** Замовлення періоду — щоб виклик не ходив у базу вдруге заради тих самих рядків. */
    orders: any[];
}

/**
 * Дохід за період разом із замовленнями, з яких він порахований.
 *
 * `sb` — будь-який клієнт Supabase: серверний зі службовим ключем або
 * браузерний. Обидві сторони звітності мають рахувати однаково, тож функція
 * одна на обидві.
 *
 * Межі періоду включні з обох боків і рахуються ТУТ, а не в місці виклику:
 * `startDate` і `endDate` — це календарні дні за Києвом, і функція сама
 * розтягує їх від першої до останньої миті доби. Викликач може передати як
 * `'2026-09-01'`, так і повний ISO — межа вийде однакова, і два екрани з
 * одним місяцем не розійдуться через те, що один із них рахував добу інакше.
 */
export async function fetchRevenueForPeriod(
    sb: any,
    startDate: string,
    endDate: string,
    options: { select?: string; label?: string } = {},
): Promise<PeriodRevenue> {
    const select = options.select
        ?? 'total, paid_amount, payment_status, order_status, created_at, items';

    const from_ = dayStartIso(startDate);
    const to_ = dayEndIso(endDate);

    const orders = await fetchAllRows<any>((from, to) => sb
        .from('orders')
        .select(select)
        .gte(REVENUE_DATE_COLUMN, from_)
        .lte(REVENUE_DATE_COLUMN, to_)
        .order(REVENUE_DATE_COLUMN, { ascending: false })
        .range(from, to), { label: options.label ?? 'дохід за період' });

    return {
        revenue: orders.reduce((sum, order) => sum + countedRevenue(order), 0),
        orders,
    };
}
