// Обмеження частоти звернень за IP.
//
// Лічильник у памʼяті процесу, як у /api/orders/track. На Vercel це означає, що
// в кожного екземпляра функції він свій, тож межа насправді мʼякша за
// заявлену. Для пайлота цього достатньо: захист тут від випадкового циклу і
// від одного нудьгуючого гостя, а не від навмисної атаки. Справжня межа стоїть
// нижче і не обходиться взагалі — розмір файлу, тип файлу і те, що подія мусить
// існувати в базі.
//
// Мапа не росте безмежно: протерміновані ключі прибираються при зверненні.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Скільки ключів тримаємо, поки не приберемо сміття. */
const SWEEP_THRESHOLD = 5_000;

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

/**
 * Повертає ok:false, коли ключ вичерпав ліміт у поточному вікні.
 *
 * Вікно зсувне лише за фактом закінчення: перше звернення відкриває вікно,
 * після windowMs лічильник починається спочатку.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  if (buckets.size > SWEEP_THRESHOLD) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }

  const found = buckets.get(key);
  if (!found || found.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  if (found.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((found.resetAt - now) / 1000)) };
  }

  found.count++;
  return { ok: true, retryAfterSeconds: 0 };
}

/**
 * IP клієнта з заголовків Vercel.
 *
 * x-forwarded-for приходить списком, де перший запис — сам клієнт. Коли
 * заголовка немає взагалі (локальний запуск), усі звернення зіллються в один
 * ключ, і це правильна поведінка: краще обмежити зайве, ніж не обмежити нічого.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}
