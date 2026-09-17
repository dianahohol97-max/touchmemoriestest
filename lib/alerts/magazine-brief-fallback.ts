/**
 * Сторож відкату: перше замовлення брифа, що пішло старим шляхом.
 *
 * Оформлення заявки «журнал із нашим текстом» переведено на сервер за
 * вимикачем, а сторінка вміє тихо відкотитися на браузерну вставку — і саме
 * ця тиша й небезпечна. Якщо маршрут відмовляє (помилка збірки, зламана
 * валідація, недоступна база), клієнт цього не побачить, замовлення
 * створиться, і поломка виявиться аж на звірці за тиждень.
 *
 * Тому: перше ж замовлення з поміткою `order_path = 'client'`, створене ПІСЛЯ
 * вмикання вимикача, іде сигналом у робочий чат. Один раз, не на кожне
 * (Діана, 16.09.2026) — сенс сигналу в тому, щоб сказати «воно не працює», а
 * не рахувати кожну заявку.
 *
 * Замовлення старим шляхом до вмикання вимикача — це норма, не сигнал. Тому
 * межа береться з часу останнього перемикання самого вимикача, а не з
 * фіксованої дати: після відкату і повторного вмикання сторож дивиться на
 * нове вікно, а не на старе.
 */
import { readServerOrderFlowFlag } from '@/lib/orders/server-order-flow';

/** Памʼять про вже надісланий сигнал. Рядок є — більше не надсилаємо. */
export const FALLBACK_ALERT_KEY = 'magazine_brief_client_fallback_alerted';

/**
 * Слід кожного проходу. Сторож, який мовчить, і сторож, якого ніхто не
 * запускав, виглядають однаково — а це різні речі (Діана, 15.09.2026, про
 * журнал звірки каталогу). Тому кожен прохід лишає дату й причину мовчання,
 * і «воно живе» перевіряється одним рядком у settings.
 */
export const FALLBACK_WATCH_KEY = 'magazine_brief_fallback_watch';

export type FallbackOrder = {
    order_number: string | null;
    created_at: string | null;
    custom_attributes?: Record<string, any> | null;
};

export type FallbackDecision =
    | { send: false; reason: 'flag_off' | 'already_alerted' | 'no_fallback' }
    | { send: true; order: FallbackOrder };

/**
 * Рішення відокремлене від читання бази і від надсилання, щоб його можна було
 * перевірити тестами: сторож, який помиляється в цьому місці, або мовчить про
 * поломку, або дзвонить щопроходу.
 */
export function decideFallbackAlert(input: {
    flagOn: boolean;
    alreadyAlerted: boolean;
    order: FallbackOrder | null;
}): FallbackDecision {
    if (!input.flagOn) return { send: false, reason: 'flag_off' };
    if (input.alreadyAlerted) return { send: false, reason: 'already_alerted' };
    if (!input.order) return { send: false, reason: 'no_fallback' };
    return { send: true, order: input.order };
}

function kyivTime(iso: string | null): string {
    if (!iso) return 'невідомо коли';
    try {
        return new Intl.DateTimeFormat('uk-UA', {
            timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        }).format(new Date(iso));
    } catch {
        return iso;
    }
}

export function formatFallbackAlert(order: FallbackOrder): string {
    const number = order.order_number || 'без номера';
    const declared = order.custom_attributes?.price_declared;
    return [
        '⚠️ Бриф на текст журналу: замовлення пішло старим шляхом.',
        '',
        `Замовлення ${number} створене ${kyivTime(order.created_at)} з поміткою order_path = client, хоча серверне оформлення увімкнене. Це означає, що сторінка не достукалася до /api/orders/magazine-text-brief і мовчки відкотилася на вставку з браузера.`,
        declared !== undefined && declared !== null
            ? `Сума в замовленні: ${declared} ₴, і порахував її браузер, а не сервер.`
            : '',
        '',
        'Подивіться журнал Vercel по цьому маршруту за той самий час — там буде причина відмови. Вимикач лишається увімкненим, замовлення прийняте і не втрачене.',
        '',
        `Сигнал приходить один раз. Щоб він міг спрацювати знову, треба прибрати рядок ${FALLBACK_ALERT_KEY} з таблиці settings.`,
    ].filter(Boolean).join('\n');
}

type Sender = (text: string) => Promise<boolean>;

/**
 * Повний прохід. Повертає те, що сталося, щоб крон міг покласти це у
 * відповідь; помилка надсилання НЕ записує памʼять, тож наступний прохід
 * спробує ще раз.
 */
export async function checkMagazineBriefFallback(
    supabase: any,
    opts: { preview?: boolean; send: Sender },
): Promise<{ decision: FallbackDecision; sent: boolean; message?: string }> {
    const flag = await readServerOrderFlowFlag(supabase, 'magazine-text-brief');

    const { data: alerted } = await supabase
        .from('settings').select('value').eq('key', FALLBACK_ALERT_KEY).maybeSingle();

    let order: FallbackOrder | null = null;
    if (flag.enabled && !alerted) {
        // Усі умови стоять у самому запиті, а не у відсіві після нього: вибірка
        // обмежена одним рядком, і фільтр у JavaScript тут означав би лотерею
        // (гоча 13 у CLAUDE.md). Межа — час останнього перемикання вимикача.
        let query = supabase
            .from('orders')
            .select('order_number, created_at, custom_attributes')
            .eq('custom_attributes->>order_flow', 'magazine-text-brief')
            .eq('custom_attributes->>order_path', 'client');
        if (flag.updatedAt) query = query.gt('created_at', flag.updatedAt);
        const { data } = await query.order('created_at', { ascending: true }).limit(1);
        order = (data && data[0]) || null;
    }

    const decision = decideFallbackAlert({
        flagOn: flag.enabled,
        alreadyAlerted: Boolean(alerted),
        order,
    });

    const heartbeat = async (outcome: string) => {
        if (opts.preview) return;
        await supabase.from('settings').upsert({
            key: FALLBACK_WATCH_KEY,
            value: { last_checked_at: new Date().toISOString(), outcome, flag_on: flag.enabled },
            updated_at: new Date().toISOString(),
        });
    };

    if (!decision.send) {
        await heartbeat(decision.reason);
        return { decision, sent: false };
    }

    const message = formatFallbackAlert(decision.order);
    if (opts.preview) return { decision, sent: false, message };

    const ok = await opts.send(message);
    await heartbeat(ok ? 'alerted' : 'send_failed');
    if (ok) {
        await supabase.from('settings').upsert({
            key: FALLBACK_ALERT_KEY,
            value: {
                order_number: decision.order.order_number,
                order_created_at: decision.order.created_at,
                alerted_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
        });
    }
    return { decision, sent: ok, message };
}
