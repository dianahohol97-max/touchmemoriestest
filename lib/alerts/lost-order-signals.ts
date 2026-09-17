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
 * ЩО САМЕ ВІН ДИВИТЬСЯ. Чотири ознаки, кожна з яких уже ставалася:
 *   photos      — фото не доїхали (photos_attached менше за photos_submitted)
 *   no_product  — заявка з дизайнером без товару і без ціни
 *   no_email    — замовленню більше кількох годин, а листів за ним нема жодного
 *   not_in_crm  — кандидат на перенесення висить кандидатом уже кілька годин,
 *                 тобто перенесення мовчки падає щопроходу
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

export type SignalKind = 'photos' | 'no_product' | 'no_email' | 'not_in_crm';

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
    now: number;
}): LostSignal[] {
    const out: LostSignal[] = [];

    for (const o of input.orders) {
        const orderNumber = o.order_number || '(без номера)';
        const base = { orderId: o.id, orderNumber, createdAt: o.created_at };
        const attrs = o.custom_attributes || {};

        // 1. Фото не доїхали. Обидва числа пише саме оформлення, тож їх
        //    відсутність означає лише те, що замовлення з іншого потоку.
        const submitted = num(attrs.photos_submitted);
        const attached = num(attrs.photos_attached);
        if (submitted > 0 && attached < submitted) {
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
        if (o.with_designer) {
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
            o.customer_email
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

        // 4. Висить кандидатом на перенесення. Крон пробує щопівгодини, тож
        //    шість годин — це дванадцять невдалих спроб поспіль.
        const since = input.crmCandidateSince.get(o.id);
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

    // Вікно на добу з гаком — це десятки рядків, не тисячі, тож свідомий ліміт
    // замість циклу з .range() (гоча 14). Ліміт навмисно вищий за будь-який
    // реальний день, щоб «обрізало» ніколи не означало «не побачили».
    const { data: ordersRaw, error } = await supabase
        .from('orders')
        .select('id, order_number, created_at, with_designer, total, items, customer_email, customer_name, source, custom_attributes')
        .gte('created_at', since)
        .not('order_status', 'in', '("cancelled","refunded")')
        .order('created_at', { ascending: false })
        .limit(500);
    if (error) throw error;

    const orders: OrderRow[] = ordersRaw || [];

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
