/**
 * Повтор обірваного рендеру — правила, за якими /api/print/render-order
 * вирішує, чи варто просити сервіс ще раз.
 *
 * Навіщо це окремим файлом: рішення тут коштує дорого в обидва боки. Зайвий
 * повтор — це ще одна-дві хвилини часу функції на замовлення, яке однаково не
 * збереться (аркуш не того розміру не стане правильним від другої спроби).
 * Пропущений повтор — це макет із діркою, який виглядає готовим доти, доки
 * друкарня не порахує сторінки.
 *
 * Розрізняє їх одне: чи сторінка впала через ЗОВНІШНІЙ обрив, а не через
 * власний вміст. Обрив має дві впізнавані подоби, і обидві вже лежать у
 * журналі помилок за 20–22.09.2026:
 *
 *   • «Target page, context or browser has been closed» — Chromium зник
 *     посеред прогону (його вбив деплой Railway або OOM);
 *   • 502 «Application failed to respond» — контейнер не відповідає взагалі,
 *     бо Railway саме підміняє його новим.
 *
 * Обидві нічого не кажуть про сам макет, тож та сама сторінка через хвилину
 * збереться. Усе інше — «aspect mismatch», «no spread element», відмова
 * сховища — це властивість макета, і повтор лише витратить час.
 *
 * Функції тут чисті й покриті tests/render-retry.test.ts: саме ця межа
 * («що вважати обривом») найлегше тихо з'їжджає при наступній правці.
 */

/** Скільки разів поспіль просимо сервіс про той самий макет, разом із першою спробою. */
export const MAX_RENDER_ATTEMPTS = 3;

/**
 * Пауза перед другою і третьою спробою.
 *
 * Перша пауза мусить пережити підміну контейнера на Railway, а не просто
 * «трохи зачекати»: одразу після 502 сервіс ще не піднявся, і негайний повтор
 * гарантовано дістане те саме 502, витративши спробу намарно. Друга пауза
 * довша, бо якщо за п'ятнадцять секунд не піднялося, то йде повна збірка
 * образу з Chromium, а вона займає хвилини.
 */
export const RENDER_RETRY_DELAYS_MS = [15_000, 45_000];

/**
 * Скільки часу від початку маршруту дозволено витратити на спроби.
 *
 * maxDuration цього маршруту — 300 секунд, і вийти за них означає втратити
 * реєстрацію файлів разом із функцією. Тому нова спроба починається тільки
 * тоді, коли після паузи лишається чим рендерити; інакше вона свідомо
 * пропускається, і макет чесно лишається неповним.
 */
export const RENDER_RETRY_BUDGET_MS = 240_000;

/** Один аркуш, якого сервіс не подужав. Книги звітують `spread`, календарі — `page`. */
export type FailedEntry = { spread?: unknown; page?: unknown; error?: unknown };

/** Номер аркуша з запису про невдачу, або null, якщо сервіс його не назвав. */
export function failedIndexOf(entry: FailedEntry | null | undefined): number | null {
    const raw = entry?.spread ?? entry?.page;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
}

const TRANSIENT_PATTERNS: RegExp[] = [
    // Chromium зник посеред прогону — деплой Railway або OOM-killer.
    /target (?:page|closed|crashed)|browser has been closed|browser\.newpage|browser closed/i,
    // Railway підміняє контейнер і відповідає замість сервісу.
    /application failed to respond/i,
    // Мережа обірвалася на півслові.
    /econnreset|econnrefused|etimedout|socket hang up|fetch failed|network error|terminated|aborted/i,
    // Шрифт аркуша не доїхав. Це теж ЗОВНІШНІЙ обрив, а не властивість макета:
    // сторож у render-service зупиняє знімок тільки тоді, коли грань оголошена
    // в нашому ж CSS, але не завантажилась, — тобто впав запит по файл, і друга
    // спроба його лікує. Випадки, яких повтор НЕ лікує (родини немає в наборі,
    // гліфів немає ніде), сторож свідомо не зупиняє: вони йдуть окремим полем
    // `fontNotes`, а не помилкою аркуша, і сюди не потрапляють ніколи.
    /шрифт не завантажився/i,
];

/**
 * Чи це обрив ззовні, а не властивість макета.
 *
 * Приймає що завгодно (рядок, Error, тіло відповіді сервісу) і дивиться на
 * текст: сервіс кладе причину то в `error`, то в `message`, то в `detail`, і
 * вгадувати поле тут дорожче, ніж прочитати все.
 */
export function isTransientRenderFailure(reason: unknown): boolean {
    const text = typeof reason === 'string'
        ? reason
        : reason instanceof Error
            ? reason.message
            : (() => { try { return JSON.stringify(reason ?? ''); } catch { return String(reason ?? ''); } })();
    if (!text) return false;
    return TRANSIENT_PATTERNS.some(rx => rx.test(text));
}

/**
 * Чи варто повторювати виклик, який навіть не дійшов до сервісу.
 *
 * 502/503/504 приходять від самого Railway, коли контейнера немає — це завжди
 * обрив. 500 віддає вже наш сервіс, і воно буває і обривом («browser.newPage:
 * Target page… closed»), і справжньою відмовою, тому для нього дивимося в тіло.
 */
export function isTransientRenderStatus(status: number, detail?: unknown): boolean {
    if (status === 502 || status === 503 || status === 504) return true;
    if (status === 500) return isTransientRenderFailure(detail);
    return false;
}

/** Записи про невдалі аркуші з відповіді сервісу, у зручному вигляді. */
export function failedEntries(detail: unknown): FailedEntry[] {
    const failed = (detail as any)?.failed;
    return Array.isArray(failed) ? failed as FailedEntry[] : [];
}

/**
 * Номери аркушів, які варто попросити ще раз: тільки ті, що впали через обрив
 * і мають номер. Запис без номера повторити неможливо — сервіс не зрозуміє, що
 * саме йому перерендерити, — тож він лишається невдалим.
 */
export function transientFailedIndexes(entries: FailedEntry[]): number[] {
    const out = new Set<number>();
    for (const e of entries) {
        if (!isTransientRenderFailure(e?.error)) continue;
        const idx = failedIndexOf(e);
        if (idx !== null) out.add(idx);
    }
    return [...out].sort((a, b) => a - b);
}

/** Пауза перед спробою номер `attempt` (перша спроба йде без паузи). */
export function renderRetryDelayMs(attempt: number): number {
    if (attempt <= 1) return 0;
    const i = Math.min(attempt - 2, RENDER_RETRY_DELAYS_MS.length - 1);
    return RENDER_RETRY_DELAYS_MS[i];
}
