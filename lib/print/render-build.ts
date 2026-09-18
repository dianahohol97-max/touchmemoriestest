/**
 * Яку збірку сервісу рендеру справді крутить Railway і коли вона востаннє
 * щось зробила.
 *
 * ЧОМУ ЦЕ ІСНУЄ, і головне тут — ЧАС, а не комміт. Railway розкочується
 * автоматично разом із GitHub (Діана, 18.09.2026), тож код сервісу зазвичай
 * свіжий. Питання, на яке не було відповіді, інше: чи рендер після виправлення
 * узагалі ЗАПУСКАЛИ.
 *
 * Саме на цьому загубилося TM-001254 (15–18.09.2026). Біла лінія по лінії різу
 * лікується в clampCaptureEdge, і воно стояло на Railway із шістнадцятого. Але
 * файли того замовлення лишалися від дев'ятого: виправлення змінює те, що
 * рендер ВИРОБЛЯЄ, і не чіпає готових файлів у сховищі. Треба було просто
 * перегенерувати — а цього ніхто не зробив, і побачити це було ніде.
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
