/**
 * Яку збірку сервісу рендеру справді крутить Railway і коли вона востаннє
 * щось зробила.
 *
 * ЧОМУ ЦЕ ІСНУЄ. Сервіс рендеру живе на Railway окремо від сайту: пуш у main
 * розкочує Vercel, але НЕ Railway. Виправлення в render-service може лежати в
 * репозиторії тижнями і не працювати в продакшні, а помітити це нема по чому —
 * сервіс і далі відповідає, і далі рендерить, просто старим кодом.
 *
 * Саме так загубилося TM-001254 (Діана, 15–18.09.2026). Біла лінія по лінії
 * різу лікується в clampCaptureEdge, комміт 99e1379c лежав у репозиторії з
 * шістнадцятого, і три дні відповідь «перегенеруйте макет» звучала як
 * виправлення, хоча файли замовлення востаннє переписували дев'ятого вересня.
 * Не було видно ні того, що Railway старий, ні того, що рендер узагалі не
 * запускався.
 *
 * Сервіс уже присилає свій комміт у /api/print/render-complete, але той ішов
 * лише в консоль. Тут він осідає в settings, і адмінка може його показати.
 */

export const RENDER_BUILD_KEY = 'render_service_build';

export type RenderBuild = {
    /** RAILWAY_GIT_COMMIT_SHA сервісу, або 'unknown', якщо змінної немає. */
    commit: string;
    /** Коли цей рендер завершився. */
    at: string;
    projectId: string;
    files: number;
};

/** Короткий вигляд комміта для інтерфейсу. */
export function shortCommit(commit: string | null | undefined): string {
    const c = String(commit || '').trim();
    if (!c || c === 'unknown') return 'невідома збірка';
    return c.slice(0, 7);
}

/**
 * Скільки днів тому це було. Порожньо, якщо дата незрозуміла.
 *
 * Саме вік, а не дата: «востаннє рендерило дев'ять днів тому» читається як
 * проблема, а «9 вересня» — як факт, повз який очей проходить.
 */
export function buildAgeDays(at: string | null | undefined, now: Date = new Date()): number | null {
    const t = Date.parse(String(at || ''));
    if (!Number.isFinite(t)) return null;
    return Math.floor((now.getTime() - t) / 86400_000);
}

/** Рядок для адмінки: що крутиться і коли востаннє працювало. */
export function describeRenderBuild(build: RenderBuild | null, now: Date = new Date()): string {
    if (!build) return 'Railway: жодного рендеру ще не було записано.';
    const age = buildAgeDays(build.at, now);
    const when = age === null ? 'невідомо коли'
        : age === 0 ? 'сьогодні'
        : age === 1 ? 'учора'
        : `${age} дн. тому`;
    return `Railway: збірка ${shortCommit(build.commit)}, останній рендер ${when}.`;
}
