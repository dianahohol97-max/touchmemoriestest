/**
 * Розклад черги блогу: коли відкривається наступна стаття.
 *
 * ПРАВИЛО. Статті виходять через два дні і через три, по черзі, о сьомій ранку
 * за Києвом. Чергування дає в середньому 2,5 дня — тобто два-три пости на
 * тиждень, — і водночас рятує від того, щоб день тижня назавжди застряг на
 * одному й тому самому: рівні два дні поставили б усі публікації на понеділок,
 * середу й пʼятницю до кінця часів.
 *
 * ЧОМУ ЧАС РАХУЄТЬСЯ ЧЕРЕЗ Intl, А НЕ ЗСУВОМ НА ТРИ ГОДИНИ. Київ живе на UTC+2
 * взимку і UTC+3 влітку, тож «сьома ранку» — це різний момент часу залежно від
 * дати. Захардкоджений зсув дав би восьму ранку пів року, а в ніч переходу —
 * пропущену або подвоєну публікацію. `Intl.DateTimeFormat` знає таблицю
 * переходів і не застаріває, на відміну від нашої арифметики.
 *
 * ПРО КРОН. Крон стоїть на 05:00 UTC — це сьома за Києвом узимку і восьма
 * влітку. Стаття, чий час настав, відкривається першим же проходом, тож
 * влітку вона виходить о восьмій, а не о сьомій. Точність до хвилини тут не
 * потрібна: важливо, що стаття не виходить РАНІШЕ за свою дату, а ця умова
 * виконується завжди.
 */

const TZ = 'Europe/Kyiv';

/** Година публікації за київським часом. */
export const PUBLISH_HOUR = 7;

/** Інтервали, які чергуються між сусідніми статтями. */
export const GAP_DAYS = [2, 3] as const;

/** Наскільки Київ попереду UTC у конкретний момент, у хвилинах. */
function kyivOffsetMinutes(at: Date): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: TZ,
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(at);

    const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
    // `hour12: false` віддає опівніч як 24, а не 00 — Date.UTC із 24 годинами
    // мовчки переїхав би на наступну добу і зсунув зсув на цілий день.
    const hour = get('hour') % 24;
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
    return (asUtc - at.getTime()) / 60000;
}

/** Календарна дата за Києвом для моменту `at`. */
function kyivDateParts(at: Date): { year: number; month: number; day: number } {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(at);
    const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
    return { year: get('year'), month: get('month'), day: get('day') };
}

/**
 * Момент UTC, який у Києві виглядає як задана дата о `PUBLISH_HOUR`.
 *
 * Два проходи потрібні через те, що зсув залежить від самого моменту, який ми
 * шукаємо: перше наближення бере зсув сусіднього моменту, друге — вже свого.
 */
export function kyivMorningUtc(year: number, month: number, day: number): Date {
    const wall = Date.UTC(year, month - 1, day, PUBLISH_HOUR, 0, 0, 0);
    const firstGuess = wall - kyivOffsetMinutes(new Date(wall)) * 60000;
    const settled = wall - kyivOffsetMinutes(new Date(firstGuess)) * 60000;
    return new Date(settled);
}

/** Та сама дата за Києвом, зсунута на `days` діб, о сьомій ранку. */
export function kyivMorningAfter(anchor: Date, days: number): Date {
    const { year, month, day } = kyivDateParts(anchor);
    // Зсув по календарю, а не додавання мілісекунд: доба переходу на літній час
    // коротша за двадцять чотири години, і арифметика в мілісекундах у цю ніч
    // з'їхала б на годину назад.
    const shifted = new Date(Date.UTC(year, month - 1, day + days));
    const p = kyivDateParts(shifted);
    return kyivMorningUtc(p.year, p.month, p.day);
}

/**
 * Наступний вільний слот у черзі.
 *
 * @param anchor      час останньої вже запланованої (або опублікованої) статті
 * @param queuedAfter скільки статей уже стоїть у черзі після опублікованих —
 *                    саме це число визначає, який інтервал зараз по черзі
 * @param now         «зараз», щоб слот ніколи не опинився в минулому
 */
export function nextSlot(anchor: Date | null, queuedAfter: number, now: Date = new Date()): Date {
    const gap = GAP_DAYS[queuedAfter % GAP_DAYS.length];
    const base = anchor && anchor.getTime() > now.getTime() ? anchor : now;
    let slot = kyivMorningAfter(base, gap);

    // Якщо якір лежить глибоко в минулому (черга спорожніла і довго стояла),
    // слот вийшов би теж у минулому, і крон опублікував би статтю тієї ж ночі
    // разом з усіма наступними. Підтягуємо до першого ранку попереду.
    while (slot.getTime() <= now.getTime()) {
        slot = kyivMorningAfter(slot, 1);
    }
    return slot;
}

/**
 * Слот для нової статті за наявною чергою — без жодного звернення до бази.
 *
 * НАВІЩО ЧИСТА ФУНКЦІЯ. Розклад потрібен двом дуже різним місцям: серверному
 * коду через `lib/blog/queue.ts` і скрипту генерації, який запускається голим
 * node і не бачить ні псевдонімів шляхів, ні клієнта Supabase. Поки логіка
 * жила всередині запиту, другому місцю довелося б її переписати — а дві копії
 * розкладу означають дві різні черги, які розійдуться мовчки.
 *
 * @param queuedAt      час усіх уже запланованих статей, у будь-якому порядку
 * @param lastPublished час останньої опублікованої — якір, коли черга порожня
 */
export function slotAfterQueue(
    queuedAt: Array<string | Date | null>,
    lastPublished: string | Date | null,
    now: Date = new Date(),
): Date {
    const times = queuedAt
        .map(v => (v ? new Date(v) : null))
        .filter((d): d is Date => !!d && !Number.isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());

    if (times.length) {
        return nextSlot(times[times.length - 1], times.length, now);
    }

    const anchor = lastPublished ? new Date(lastPublished) : null;
    return nextSlot(anchor && !Number.isNaN(anchor.getTime()) ? anchor : null, 0, now);
}
