import { formatDeliveryAddress } from '@/lib/orders/delivery-address';
import { deliveryMethodLabel } from '@/lib/orders/delivery-method';

/**
 * Аркуш на друк — те, що виробництво читає щодня.
 *
 * ЧОМУ ЦЕ ОКРЕМИЙ МОДУЛЬ І ЧОМУ З ТЕСТАМИ. Текст збирався прямо в дошці
 * виробництва, шаблонним рядком, з полями, яких у замовленнях НЕМАЄ:
 *
 *   `${i.name}` — у позиції поле зветься product_name
 *   `${i.qty}`  — зветься quantity
 *   `${i.options?.format}` / `.cover` / `.pages` — опції звуться «Розмір»,
 *                 «Обкладинка», «Кількість сторінок»
 *   `${order.delivery_address}` — це jsonb, і для обʼєкта шаблон дає
 *                 рівно «[object Object]»
 *
 * На 16.09.2026 це означало, що у 2068 позиціях дошки жодне з чотирьох полів
 * не існувало: кожен рядок аркуша читався як «- undefined (undefined undefined
 * undefined стор.) - undefined шт.», а контакти закінчувалися «[object
 * Object]» для 224 замовлень.
 *
 * ОПЦІЇ ВИПИСУЮТЬСЯ ВСІ, А НЕ ТРИ ОБРАНІ. Набір опцій різний у кожного товару
 * — у фотокниги це розмір, обкладинка й кількість сторінок, у гравіювання
 * напис і шрифт, у магнітів формат і покриття. Перелічувати три назви означає
 * мовчки викидати все інше саме тоді, коли воно є єдиним, що відрізняє два
 * замовлення на однаковий товар.
 */

/** Персоналізація, яку не можна загубити: напис на гравіювання живе тут. */
const PERSONALISATION_KEYS = ['personalization_note', 'personalisation_note', 'engraving_text'];

function itemLine(item: any): string {
    const name = String(item?.product_name || item?.name || 'Позиція').trim();
    const qty = Number(item?.quantity ?? item?.qty) || 1;

    const options = item?.options && typeof item.options === 'object' ? item.options : {};
    const chosen = Object.entries(options)
        .map(([key, value]) => [String(key).trim(), String(value ?? '').trim()])
        .filter(([, value]) => value !== '')
        .map(([key, value]) => `${key}: ${value}`);

    const head = `- ${name} — ${qty} шт.`;
    const body = chosen.map(line => `    ${line}`);

    // Напис на гравіювання — те, заради чого аркуш і друкують. Іде окремим
    // блоком, а не в рядок з опціями: він багаторядковий і його читають
    // буквально, символ у символ.
    const note = PERSONALISATION_KEYS
        .map(key => String(item?.[key] ?? '').trim())
        .find(Boolean);
    if (note) {
        body.push('    Персоналізація:');
        for (const row of note.split('\n')) body.push(`      ${row.trim()}`);
    }

    return [head, ...body].join('\n');
}

/**
 * Повний текст аркуша для одного замовлення.
 *
 * Порожні місця НЕ ховаються: «адреси немає» — це теж те, що виробництво має
 * побачити до того, як пакувати, а не після.
 */
export function buildPrintSlip(order: any): string {
    const items = Array.isArray(order?.items) ? order.items : [];
    const lines: string[] = [`Зміст замовлення ${String(order?.order_number || '').trim() || '—'}:`];

    if (items.length) lines.push(...items.map(itemLine));
    else lines.push('- позицій немає');

    const address = formatDeliveryAddress(order);
    const method = deliveryMethodLabel(order?.delivery_method);

    lines.push('');
    lines.push(`Клієнт: ${String(order?.customer_name || '').trim() || 'без імені'}`);
    lines.push(`Доставка: ${[method, address].filter(Boolean).join(', ') || 'не вказана'}`);
    if (!address) lines.push('УВАГА: адреси доставки в замовленні немає.');

    return lines.join('\n');
}
