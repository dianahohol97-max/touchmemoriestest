/**
 * Продовження терміну галереї — чиста функція, щоб її можна було перевірити
 * тестом (tests/gallery-term.test.ts).
 *
 * Правило: продовження рахується від пізнішого з «зараз» і поточного терміну і
 * обрізається стелею MAX_TERM_DAYS від сьогодні. До 2026-09-24 стеля могла
 * СКОРОТИТИ термін: демо-галерея лендингу мала expires_at у 2035 році, хтось
 * натиснув «+30 днів» 4 серпня, і термін став 02.11.2026 — через два місяці
 * крон стер би демо-фото. Тепер новий термін ніколи не менший за поточний:
 * продовження або подовжує, або нічого не змінює.
 *
 * Тарифних обмежень продовження (безкоштовний тариф проти 30/60/90) тут
 * свідомо немає, це окрема задача.
 */

export const MAX_TERM_DAYS = 90;
export const EXTEND_DAY_OPTIONS = [30, 60, 90] as const;

const DAY = 86_400_000;

/** Новий expires_at, або null, коли продовження нічого не змінює. */
export function extendedExpiry(currentExpiresAt: string, days: number, now: Date): string | null {
    const current = new Date(currentExpiresAt).getTime();
    const nowMs = now.getTime();
    const base = Number.isFinite(current) ? Math.max(nowMs, current) : nowMs;
    const proposed = Math.min(base + days * DAY, nowMs + MAX_TERM_DAYS * DAY);
    if (Number.isFinite(current) && proposed <= current) return null;
    return new Date(proposed).toISOString();
}
