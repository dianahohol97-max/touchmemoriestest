/**
 * Перенесення оформлення замовлення з браузера на сервер: вимикач і помітка
 * джерела.
 *
 * Дві сторінки створюють замовлення прямо з браузера, анонімним ключем —
 * бриф на текст журналу і потік «з дизайнером». Через них проходить близько
 * половини замовлень сайту, і саме тому переписування ризикованіше за дірку,
 * яку воно закриває: політика вставки вже не дає заявити оплату (міграція
 * 20260916_orders_insert_policy_no_money.sql), а ось зламане оформлення видно
 * одразу і коштує замовлень.
 *
 * Тому спершу зʼявляється відкат, а вже потім те, що може зламатися (Діана,
 * 16.09.2026). Цей модуль — і є відкат:
 *
 *   1. Вимикач у `settings`, а не в env: його перемикають руками і без
 *      деплою, тобто відкат займає секунди, а не збірку. Немає рядка —
 *      вимкнено, і сторінка працює старим шляхом. Це свідомо безпечна
 *      відмова: будь-яка несправність читання прапорця означає «старий шлях».
 *
 *   2. Помітка джерела в `custom_attributes`. Вона стає в код ОДРАЗУ, ще до
 *      маршруту, щоб замовлення старого шляху вже були помічені до першого
 *      замовлення нового. Без цього питання «скільки пройшло новим шляхом»
 *      за тиждень не має відповіді: помічені були б тільки нові, а решта —
 *      невідрізненна від усієї історії.
 *
 * Розбіжність цін теж живе тут. Сервер рахує ціну сам, але браузерну не
 * відкидає — записує обидві. Замовлення з розбіжністю має оформитися і
 * потрапити в звіт, а не впасти клієнтові в обличчя.
 */

export type ServerOrderFlow = 'magazine-text-brief' | 'designer';

/** Ключі в таблиці `settings`. Рядка немає — потік іде старим шляхом. */
export const SERVER_ORDER_FLOW_FLAGS: Record<ServerOrderFlow, string> = {
    'magazine-text-brief': 'server_order_magazine_brief_enabled',
    'designer': 'server_order_designer_enabled',
};

/**
 * `settings.value` — це jsonb, і в нього пишуть руками з адмінки. Тому «увімкнено»
 * розпізнається в кількох виглядах: булеве true, рядок, число, а також обгортка
 * { enabled: … } — саме так зберігає значення форма налаштувань.
 *
 * Усе інше — вимкнено. Зокрема невідоме значення: помилитися в бік старого
 * шляху дешево (видно з помітки джерела), помилитися в бік нового — ні.
 */
export function isFlagOn(value: unknown): boolean {
    if (value === true) return true;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        return v === 'true' || v === 'on' || v === 'yes' || v === '1';
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const bag = value as Record<string, unknown>;
        if ('enabled' in bag) return isFlagOn(bag.enabled);
        if ('value' in bag) return isFlagOn(bag.value);
    }
    return false;
}

type SettingsReader = {
    from: (table: string) => {
        select: (columns: string) => {
            eq: (column: string, value: string) => {
                maybeSingle: () => Promise<{ data: { value?: unknown } | null; error?: unknown }>;
            };
        };
    };
};

/**
 * Читання вимикача. Помилка читання — це «вимкнено», не виняток: замовлення
 * мусить оформитися навіть тоді, коли таблиця налаштувань недоступна.
 */
export async function isServerOrderFlowEnabled(
    supabase: SettingsReader,
    flow: ServerOrderFlow,
): Promise<boolean> {
    try {
        const { data } = await supabase
            .from('settings')
            .select('value')
            .eq('key', SERVER_ORDER_FLOW_FLAGS[flow])
            .maybeSingle();
        return isFlagOn(data?.value);
    } catch {
        return false;
    }
}

export type OrderPath = 'client' | 'server';

/**
 * Помітка, яку обидва шляхи кладуть у `custom_attributes`. Плоскі ключі, а не
 * вкладений обʼєкт, бо звіт за тиждень читається одним запитом:
 *
 *   select custom_attributes->>'order_path', count(*)
 *     from orders
 *    where custom_attributes->>'order_flow' = 'magazine-text-brief'
 *    group by 1;
 *
 * `price_declared` — сума, яку порахував браузер і побачив клієнт.
 * `price_computed` зʼявляється тільки на серверному шляху; їхня різниця і є
 * та розбіжність, заради якої тиждень спостереження взагалі потрібен.
 */
export function orderFlowMarker(input: {
    flow: ServerOrderFlow;
    path: OrderPath;
    declaredTotal?: number | null;
    computedTotal?: number | null;
    at?: string;
}): Record<string, unknown> {
    const marker: Record<string, unknown> = {
        order_flow: input.flow,
        order_path: input.path,
        order_flow_at: input.at || new Date().toISOString(),
    };
    if (typeof input.declaredTotal === 'number' && Number.isFinite(input.declaredTotal)) {
        marker.price_declared = input.declaredTotal;
    }
    if (typeof input.computedTotal === 'number' && Number.isFinite(input.computedTotal)) {
        marker.price_computed = input.computedTotal;
    }
    return marker;
}
