/**
 * Обмежувач перебору за IP, спільний для маршрутів, що перевіряють код.
 *
 * Навіщо окремий файл. Та сама Map із тією самою логікою була скопійована в
 * промокоди, реферали й заявки турагенцій, а в промокодах ще й стоїть коментар
 * «same shape as /api/orders/track» — тобто автор копії знав, що копіює. Різні
 * копії вже розійшлися: у track ліміт зашитий числом усередині умови, в решти
 * винесений у константу. Шоста копія мала лягти в сертифікати — натомість
 * логіка живе тут, а маршрут задає лише свої числа.
 *
 * Межа вікна перевіряється як `now >= resetAt`, тобто вікно скидається рівно на
 * межі. Це навмисно: інакше запит, що прийшов точно в мілісекунду скидання,
 * зарахувався б у старе вікно.
 *
 * Лічильник живе в памʼяті процесу. На Vercel це означає «на інстанс», тож при
 * кількох інстансах реальна межа вища за задану. Для подорожчання перебору
 * цього досить, для строгої квоти — ні, і саме тому це «guess», а не «quota».
 */

export interface RateLimiterOptions {
    /** Скільки запитів дозволено у вікні. */
    limit: number;
    /** Довжина вікна в мілісекундах. */
    windowMs: number;
    /** Годинник — для тестів. За замовчуванням Date.now. */
    now?: () => number;
}

export interface RateLimiter {
    /** true, якщо цей IP вичерпав ліміт. Викликати РІВНО раз на запит. */
    over(ip: string): boolean;
    /** Скинути всі лічильники (тести). */
    reset(): void;
}

export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
    const { limit, windowMs } = opts;
    const clock = opts.now ?? Date.now;
    const hits = new Map<string, { count: number; resetAt: number }>();

    return {
        over(ip: string): boolean {
            const now = clock();
            const entry = hits.get(ip);
            if (!entry || now >= entry.resetAt) {
                hits.set(ip, { count: 1, resetAt: now + windowMs });
                return false;
            }
            entry.count++;
            return entry.count > limit;
        },
        reset() {
            hits.clear();
        },
    };
}

/**
 * IP запиту так, як його видно за проксі Vercel.
 *
 * x-forwarded-for приходить списком, і саме ПЕРШИЙ елемент — клієнт; решта це
 * проксі. Копії, що брали заголовок цілим рядком, рахували «1.2.3.4, 5.6.7.8»
 * як окремий ключ від «1.2.3.4», тож клієнт, чий шлях пройшов через інший
 * проксі, отримував свіжий лічильник.
 */
export function clientIp(req: { headers: { get(name: string): string | null } }): string {
    const forwarded = req.headers.get('x-forwarded-for');
    const first = (forwarded || '').split(',')[0]?.trim();
    return first || req.headers.get('x-real-ip') || '127.0.0.1';
}
