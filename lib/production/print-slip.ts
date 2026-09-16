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

/**
 * Персоналізація, яку не можна загубити: напис на гравіювання живе тут.
 *
 * Обидва імені перевірені по живих даних, а не вигадані — саме на вигаданих
 * назвах полів цей аркуш і зламався. На 16.09.2026 серед 2068 позицій дошки
 * personalization_note має 274 позиції, comment — одну (TM-001088, де в ньому
 * лежить увесь бриф: «фотокнига 30х20, 30ст / в-01, гравіювання / калька»).
 * Одна позиція теж рахується: це чиєсь замовлення, і без цього рядка його
 * друкуватимуть наосліп.
 */
const PERSONALISATION_KEYS = ['personalization_note', 'comment'];

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
    const rawMethod = String(order?.delivery_method ?? '').trim();

    // «Не обрано — узгодити з клієнтом» біля повної адреси суперечить саме
    // собі, а виробництво читає цей рядок буквально. Так виглядають дзеркалені
    // з CRM замовлення: спосіб доставки в нашій колонці лишається 'other', бо
    // CRM його окремим полем не віддає, а адреса при цьому є повна, з
    // відділенням і отримувачем. Тому напоумлення «узгодити» лишається тільки
    // там, де узгоджувати справді нічого: коли адреси немає.
    const method = rawMethod === 'other' && address ? '' : deliveryMethodLabel(rawMethod);

    lines.push('');
    lines.push(`Клієнт: ${String(order?.customer_name || '').trim() || 'без імені'}`);
    lines.push(`Доставка: ${[method, address].filter(Boolean).join(', ') || 'не вказана'}`);
    if (!address) lines.push('УВАГА: адреси доставки в замовленні немає.');

    return lines.join('\n');
}
