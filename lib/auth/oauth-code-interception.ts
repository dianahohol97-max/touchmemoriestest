/**
 * Чи перехоплювати `?code=` на цьому шляху і вести його в серверний маршрут.
 *
 * Навіщо це взагалі. Після входу Supabase повертає людину з кодом на адресу,
 * яку задає список дозволених адрес у налаштуваннях проєкту. Доступу до тих
 * налаштувань у нас зараз немає, тож перенаправлення робимо самі: middleware
 * бачить код на будь-якій сторінці і відправляє запит на
 * /{locale}/auth/callback, де код обмінюється на сесію, гостьові замовлення
 * прив'язуються до акаунта, а порожнє ім'я заповнюється з метаданих
 * реєстрації.
 *
 * Чому в middleware, а не викликом із клієнтського обробника. Виклик треба
 * пам'ятати, і саме на цьому все зламалося двічі: спершу прив'язка лежала в
 * /api/auth/register, який ніхто не кликав, потім у самому маршруті, на який
 * ніхто не вів. Middleware стоїть на шляху всіх запитів сам, і забути про
 * нього неможливо.
 *
 * Функції чисті й не знають ні про NextRequest, ні про cookies, тому
 * покриваються тестами без підняття сервера.
 */

const LOCALES = ['uk', 'en', 'ro', 'pl', 'de'];

/**
 * Шляхи, де `?code=` НЕ наш і чіпати його не можна.
 *
 * Список один і тут. Кожен рядок має причину поруч, бо жоден із них не
 * виглядає потрібним, поки не прибереш — а наслідок прибирання в кожному
 * випадку мовчазний: нічого не падає, просто певні люди перестають кудись
 * потрапляти.
 *
 * `matchLocalised` означає, що префікс порівнюється зі шляхом БЕЗ локалі:
 * `/uk/reset-password` перевіряється як `/reset-password`. Це важливо, бо
 * саме на цьому зламалося виключення '/auth' у SKIP_PREFIXES самого
 * middleware — воно написане як `pathname.startsWith('/auth')`, а реальні
 * шляхи мають попереду локаль і під нього не підпадають ніколи.
 */
export const CODE_INTERCEPTION_EXCLUSIONS: ReadonlyArray<{
    prefix: string;
    matchLocalised: boolean;
    why: string;
}> = [
        {
            prefix: '/admin',
            matchLocalised: false,
            why:
                'Адмінка має власний обмін коду на сторінці /admin/login і власний шлях ' +
                'усередину панелі. Якби ми забрали її код, адміністратора авторизувало б ' +
                'як звичайного клієнта і викинуло в /account — без жодної помилки на ' +
                'екрані, тобто «вхід в адмінку просто не працює» без видимої причини. ' +
                'Умова стоїть тут ЯВНО, а не покладається на те, що блок /admin у ' +
                'middleware виконується раніше: перестановка блоків колись зламає саме ' +
                'цей порядок, і зробить це тихо.',
        },
        {
            prefix: '/api',
            matchLocalised: false,
            why:
                'Це не сторінки, і людину туди не перенаправляють. До того ж два ' +
                'маршрути читають власний ?code=, ніяк не пов\'язаний із входом: ' +
                '/api/referral/check приймає реферальний код, /api/admin/campaign/' +
                'test-send — код кампанії.',
        },
        {
            prefix: '/auth/',
            matchLocalised: true,
            why:
                'Сам маршрут зворотного виклику живе за адресою /{locale}/auth/callback. ' +
                'Без цього рядка middleware перенаправляв би його на самого себе, і ' +
                'нескінченно: код у запиті нікуди не дівається доти, доки маршрут його ' +
                'не обміняє. Це єдине виключення, відсутність якого ламає все одразу, а ' +
                'не тихо.',
        },
        {
            prefix: '/reset-password',
            matchLocalised: true,
            why:
                'НЕ ПРИБИРАТИ. Лист про скидання пароля веде на /{locale}/reset-password ' +
                'і теж несе ?code=. Код там потрібен самій сторінці: вона обмінює його і ' +
                'ЛИШАЄТЬСЯ на місці, щоб людина ввела новий пароль. Якщо забрати цей код ' +
                'у маршрут входу, той обміняє його і поведе людину в кабінет — форма ' +
                'нового пароля стане недосяжною, і скинути пароль не зможе ніхто. ' +
                'На ці граблі вже наступали: у components/providers/OAuthCallbackHandler.tsx ' +
                'під цей самий випадок стоїть окрема гілка з окремим поясненням.',
        },
        {
            prefix: '/tools',
            matchLocalised: true,
            why:
                'Окремі інструменти лежать у /public звичайними .html і не мають ні ' +
                'сесії, ні локалі. Middleware і сьогодні пропускає їх без обробки.',
        },
    ];

/** Шлях без початкового сегмента локалі: /uk/order/book -> /order/book. */
export function stripLocale(pathname: string): string {
    const seg = (pathname || '').split('/')[1] || '';
    if (!LOCALES.includes(seg)) return pathname || '/';
    return pathname.slice(seg.length + 1) || '/';
}

/** Перше виключення, під яке підпадає шлях, або null. */
export function matchedExclusion(pathname: string): string | null {
    const localised = stripLocale(pathname);
    for (const rule of CODE_INTERCEPTION_EXCLUSIONS) {
        const subject = rule.matchLocalised ? localised : pathname;
        if (subject === rule.prefix || subject.startsWith(rule.prefix)) return rule.prefix;
    }
    return null;
}

/**
 * Чи перехоплювати цей запит.
 *
 * `code` без `state` теж перехоплюємо: Supabase кладе перевірочний рядок PKCE
 * у cookie, а не в адресу, тож наявності самого коду достатньо.
 */
export function shouldInterceptAuthCode(params: {
    pathname: string;
    hasCode: boolean;
}): boolean {
    if (!params.hasCode) return false;
    return matchedExclusion(params.pathname) === null;
}

/**
 * Куди саме вести перехоплений запит.
 *
 * `next` несе початкову сторінку, щоб людина повернулася туди, де була: вхід
 * часто починають із модалки поверх конструктора, щоб продовжити почате.
 * Параметр `code` із `next` ВИРІЗАЄТЬСЯ — інакше код поїхав би назад разом зі
 * сторінкою і все почалося б спочатку.
 */
export function buildInterceptTarget(pathname: string, search: string): string {
    const seg = (pathname || '').split('/')[1] || '';
    const locale = LOCALES.includes(seg) ? seg : 'uk';

    const incoming = new URLSearchParams(search || '');
    const code = incoming.get('code') || '';

    const leftovers = new URLSearchParams(search || '');
    leftovers.delete('code');
    const rest = leftovers.toString();
    const next = pathname + (rest ? `?${rest}` : '');

    const target = new URLSearchParams();
    target.set('code', code);
    target.set('next', next);
    return `/${locale}/auth/callback?${target.toString()}`;
}
