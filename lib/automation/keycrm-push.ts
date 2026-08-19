import { getAdminClient } from '@/lib/supabase/admin';
import { keycrmRequest, findKeycrmOrderBySourceUuid, getKeycrmToken, fetchKeycrmTagIdByName } from '@/lib/automation/keycrm';
import { fetchConfirmedMap, mapKey, sizeKey, itemSlug } from '@/lib/automation/keycrm-catalogue';
import { readOrderMoney, describeMoney, shouldPushToCrm } from '@/lib/automation/keycrm-money';
import { autoTagsForOrder, mergeTags } from '@/lib/automation/order-tags';
import { MIRROR_SOURCE } from '@/lib/automation/keycrm-mirror';
import { isTestOrder } from '@/lib/automation/test-orders';

/**
 * Push website orders into KeyCRM so nobody has to re-type them.
 *
 * Today a manager reads each order in the admin panel and enters it into the
 * CRM by hand. That is where orders get lost, delayed and mistyped, and it is
 * the single most repetitive job in the shop.
 *
 * Three rules this module is built around:
 *
 *  1. Never create a duplicate. Two guards: the CRM order id is written back
 *     onto the site order (`custom_attributes.keycrm`), and before every create
 *     the CRM is asked whether an order with this external reference already
 *     exists. If the remote check cannot run at all, the push is skipped rather
 *     than risked — a missing order is a nuisance, a duplicated one corrupts the
 *     CRM everyone works in.
 *
 *  2. Never write without being switched on. KEYCRM_SYNC_ENABLED must be "true".
 *     Deploying this code does not by itself start writing into a live CRM, so
 *     the payload can be inspected in production before anything is created.
 *
 *  3. Never guess an id. Fields that need account-specific numeric ids
 *     (payment method, delivery service) are only sent when their env var is
 *     configured. Sending a guessed id would file orders under the wrong
 *     payment or courier, which is worse than leaving the field blank.
 */

export type PushResult = {
    ok: boolean;
    /** What actually happened, for logs and for the admin response. */
    status: 'created' | 'already-synced' | 'skipped' | 'dry-run' | 'error';
    orderId: string;
    orderNumber?: string;
    keycrmOrderId?: number | string;
    payload?: any;
    reason?: string;
};

function syncEnabled(): boolean {
    return String(process.env.KEYCRM_SYNC_ENABLED || '').toLowerCase() === 'true';
}

/**
 * The moment the sync takes over. Every order paid before it was entered into
 * KeyCRM by hand, and a hand-typed order carries no external reference, so the
 * duplicate guard cannot see it — pushing one would silently create a second
 * copy of an order the team is already working on.
 *
 * There is no default on purpose. Without KEYCRM_SYNC_FROM the sync pushes
 * nothing at all, because the only safe assumption about an unconfigured
 * cutoff is that the backlog is still unprotected.
 */
function syncFrom(): Date | null {
    const raw = String(process.env.KEYCRM_SYNC_FROM || '').trim();
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function sourceId(): number | null {
    const raw = Number(process.env.KEYCRM_SOURCE_ID);
    return Number.isFinite(raw) && raw > 0 ? raw : null;
}

function optionalNumber(name: string): number | null {
    const raw = Number(process.env[name]);
    return Number.isFinite(raw) && raw > 0 ? raw : null;
}

/**
 * What one unit of this line costs.
 *
 * The cart writes the price under three different names depending on which
 * flow built the item: `unit_price`, `total_price` (whole line) or plain
 * `price`. Reading only `unit_price` sent 0,00 ₴ to the CRM for every order
 * built by the flow that writes `price` — 54 line items in the last two months,
 * including 13876, whose card shows «Глянцевий журнал» at 0,00 while the
 * customer paid 720 ₴ (Diana, 2026-08-14).
 */
function itemUnitPrice(item: any): number {
    const quantity = Number(item?.quantity) || 1;

    const unit = Number(item?.unit_price);
    if (Number.isFinite(unit) && unit > 0) return money(unit);

    const plain = Number(item?.price);
    if (Number.isFinite(plain) && plain > 0) return money(plain);

    const total = Number(item?.total_price);
    if (Number.isFinite(total) && total > 0) return money(total / quantity);

    return 0;
}

function money(value: any): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

const DELIVERY_LABELS: Record<string, string> = {
    nova_poshta: 'Нова Пошта',
    ukrposhta: 'Укрпошта',
    pickup: 'Самовивіз',
    courier: "Кур'єр",
};

/**
 * Site line item → KeyCRM product line.
 *
 * The editor stores configuration in two places: `options` holds what the
 * customer picked (cover colour, inscription, font) and `price_breakdown` holds
 * what each choice cost. Both matter to whoever fulfils the order, so options
 * become CRM properties and the breakdown becomes the line comment — a manager
 * looking at the CRM should not have to open the website to know what to make.
 */
type ProductMap = Record<string, { offer_id: string | null; sku: string | null; name: string | null }>;

// KeyCRM comment fields are text columns, but a runaway comment makes the order
// card unreadable and risks being rejected outright. Cut with a visible marker
// rather than silently — a spec that ends mid-sentence with no warning is worse
// than one that says it was cut.
const LINE_COMMENT_LIMIT = 1500;
// The CRM renders comments in a narrow list column, so length is a usability
// problem long before it is an API limit (Diana, 2026-08-11).
const ORDER_COMMENT_LIMIT = 450;

/**
 * The one line of the site's notes a CRM manager needs.
 *
 * Diana, 2026-08-11, twice, the second time about a magazine order: «і
 * завеликий, занадто великий коментар». The site's notes field is where the
 * whole content brief accumulates — the package, the cover name, the date, the
 * mood, the style, the inscription, each as its own paragraph — and copying it
 * into a CRM list column buried the row.
 *
 * What survives: the ⚠️ automatic warning if there is one, because that is the
 * only part that stops an order from going to print. Otherwise the first line.
 * The full brief stays on the site card, one click away, where it belongs.
 */
/**
 * The site's automatic warnings are written for the admin panel, where there
 * is room for a full instruction. In the CRM's list column that same sentence
 * is a wall (Diana, 2026-08-11, seeing it a third time: «і знов супервеликий
 * коментар»), and it always ends mid-word against the length cap. Each known
 * warning is replaced by the short version of itself — the CRM card says WHAT
 * is wrong; what to do about it lives on the site card.
 */
const WARNING_SHORTHAND: Array<[RegExp, string]> = [
    [/файли для друку не завантажились|макет з конструктора відсутній/i, '⚠️ Немає макета з конструктора'],
    [/без виконавця|призначте дизайнера/i, '⚠️ Дизайнер не призначений'],
    [/без звірки з номенклатурою/i, '⚠️ Товар не звірено з каталогом'],
];

function summariseNotes(raw: any): string {
    const text = String(raw || '').replace(/\r/g, '').trim();
    if (!text) return '';

    const warning = text.split('\n').find(line => line.includes('⚠️'));
    if (warning) {
        const short = WARNING_SHORTHAND.find(([re]) => re.test(warning));
        if (short) return short[1];
        return truncate(warning.replace(/\s+/g, ' ').trim(), 120);
    }

    const first = text.split('\n').map(l => l.trim()).filter(Boolean)[0] || '';
    return first ? `Нотатки: ${truncate(first, 120)}` : '';
}

function truncate(text: string, limit: number): string {
    if (text.length <= limit) return text;
    return `${text.slice(0, limit - 30).trimEnd()}\n[…обрізано, повна специфікація на сайті]`;
}

/**
 * Everything the customer chose, as readable lines.
 *
 * This is deliberately duplicated with the structured `properties` field: how
 * (and whether) a KeyCRM account renders product properties depends on its
 * settings, whereas the comment is always visible on the card. A production
 * spec that only shows up under the right CRM configuration is not a spec.
 */
function formatSpecification(item: any): string {
    const options = item?.options && typeof item.options === 'object' ? item.options : {};

    const chosen = Object.entries(options)
        .filter(([, value]) => String(value ?? '').trim() !== '')
        .map(([name, value]) => `${name}: ${String(value).trim()}`);

    const breakdown = Array.isArray(item?.price_breakdown)
        ? item.price_breakdown.map((row: any) => `  ${row?.label ?? ''} — ${money(row?.amount)} грн`)
        : [];

    const quantity = Number(item?.quantity) || 1;
    const unitPrice = itemUnitPrice(item);

    // Checked against the data: `total_price` is already the whole line
    // (unit_price × quantity), and `price_breakdown` always sums to the price of
    // ONE unit. Writing the line total and then appending "× 4 шт" turned 180 ₴
    // into something that reads as 720 ₴, and a breakdown of 659 + 180 next to a
    // line total of 1678 cannot be reconciled by anyone reading the card. Both
    // numbers are now labelled for exactly what they are.
    const lineTotal = Number.isFinite(Number(item?.total_price))
        ? money(item?.total_price)
        : money(unitPrice * quantity);

    const lines = [...chosen];

    if (breakdown.length) {
        lines.push(quantity > 1 ? 'Із чого складається ціна за одиницю:' : 'Із чого складається ціна:', ...breakdown);
    }

    lines.push(
        quantity > 1
            ? `Ціна за одиницю: ${unitPrice} грн × ${quantity} шт = ${lineTotal} грн`
            : `Разом за позицію: ${lineTotal} грн`,
    );

    return truncate(lines.join('\n'), LINE_COMMENT_LIMIT);
}

function mapProduct(item: any, productMap: ProductMap = {}) {
    const options = item?.options && typeof item.options === 'object' ? item.options : {};
    const slug = itemSlug(item);

    // One website product is several CRM items when it has sizes: a wish book is
    // sold as 23×23, 20×30 and 30×20, and each is its own entry in the CRM. The
    // size chosen by the customer is therefore part of the lookup key. Falls
    // back to the sizeless key so products without a size choice still resolve.
    const sizeLabel = String(options['Розмір'] || '').trim();

    // Products the CRM splits by COLOUR instead of size («Файликовий велюровий
    // альбом» — seven CRM cards, one per velour colour) key on the chosen
    // colour. The stored option value can carry the workshop code («ВФ-02
    // Молочний»), so the trailing word is what matches the catalogue variant.
    const colourRaw = String(
        Object.entries(options).find(([k]) => /колір/i.test(k))?.[1] ?? ''
    ).trim();
    const colourLabel = colourRaw.replace(/^\s*[А-ЯA-Zа-яa-z]{1,3}\s?-\s?\d+\s*/u, '').trim();

    // Page count is the second half of the key for photobooks — the CRM keeps
    // «20х20, 22 сторінки» as its own item with its own stock and cost.
    const pagesRaw = String(
        Object.entries(options).find(([k]) => /сторін/i.test(k))?.[1] ?? ''
    );
    const pages = (pagesRaw.match(/\d+/) || [])[0] || '';

    const mapped = slug
        ? ((sizeLabel && pages ? productMap[mapKey(slug, `${sizeKey(sizeLabel)}-${pages}`)] : undefined)
            || productMap[mapKey(slug, sizeKey(sizeLabel))]
            || (colourLabel ? productMap[mapKey(slug, sizeKey(colourLabel))] : undefined)
            || (sizeLabel || colourLabel ? undefined : productMap[mapKey(slug, '')]))
        : undefined;

    // The CRM has no 30×20 photobook — it is the same sheet as 20×30, turned
    // (Diana, 2026-08-11: «важливо в коментарі прописати що це 30х20»). The
    // line's own comment carries the orientation so the workshop binds it the
    // right way round.
    const orientationNote = /^30x20$/.test(sizeKey(sizeLabel)) && mapped
        ? 'УВАГА: орієнтація 30×20 (альбомна), у CRM позиція 20х30 — той самий формат, повернутий.'
        : '';

    const properties = Object.entries(options)
        .filter(([, value]) => String(value ?? '').trim() !== '')
        .map(([name, value]) => ({ name: String(name), value: String(value) }));

    const specification = formatSpecification(item);

    // A confirmed mapping attaches the line to the real CRM catalogue item, so
    // stock and product reports there actually move. Without one the line still
    // goes over with its name and price — readable to a human, invisible to CRM
    // analytics — and the slug is sent as the SKU so the gap is traceable.
    return {
        sku: mapped?.sku || slug || String(item?.product_id || ''),
        ...(mapped?.offer_id ? { offer_id: mapped.offer_id } : {}),
        name: String(item?.product_name || 'Товар'),
        price: itemUnitPrice(item),
        quantity: Number(item?.quantity) || 1,
        unit_type: 'шт',
        ...(properties.length ? { properties } : {}),
        ...(specification || orientationNote
            ? { comment: [orientationNote, specification].filter(Boolean).join('\n') }
            : {}),
    };
}

/**
 * Build the exact body that would be POSTed. Kept pure and exported so it can
 * be previewed from the admin panel without touching the CRM.
 */
export function buildKeycrmOrderPayload(order: any, productMap: ProductMap = {}, tagIdByName: Record<string, number | string> = {}): any {
    const address = order?.delivery_address && typeof order.delivery_address === 'object'
        ? order.delivery_address
        : {};

    const items = Array.isArray(order?.items) ? order.items : [];
    const deliveryLabel = DELIVERY_LABELS[String(order?.delivery_method || '')] || String(order?.delivery_method || '');

    // The site order number goes into the manager comment as well as the
    // external reference: managers search by it, and the ops digest matches the
    // two systems on it.
    // The same specification, condensed, at order level. Which of the two a
    // manager actually reads depends on how their CRM view is set up, and the
    // cost of having it in both places is a longer card — the cost of having it
    // in neither is a phone call to ask what colour the cover should be.
    // One line per item, options inline. The specification also rides on each
    // product line in the CRM, so the comment copy exists only for managers
    // whose view shows comments — it must stay scannable (Diana, 2026-08-11:
    // «в CRM прилітають дуже великі коментарі, супер некомфортно» — the orders
    // list renders the comment in a narrow column, and a twenty-line comment
    // turns one row into a wall of text).
    const specBlock = items.slice(0, 4).map((item: any) => {
        const options = item?.options && typeof item.options === 'object' ? item.options : {};
        const chosen = Object.entries(options)
            .filter(([, value]) => String(value ?? '').trim() !== '')
            .map(([name, value]) => `${name}: ${String(value).trim()}`)
            .join(', ');

        const title = String(item?.product_name || 'Товар');
        const qty = Number(item?.quantity) || 1;

        return truncate(`• ${title}${qty > 1 ? ` ×${qty}` : ''}${chosen ? ` — ${chosen}` : ''}`, 120);
    }).join('\n') + (items.length > 4 ? `\n…і ще ${items.length - 4} позицій` : '');

    // Compact by design. Everything a manager needs to ACT is in the first two
    // lines; the rest is one line each. Dropped from the card entirely: the
    // site UUID (nobody searches by it — the order number is the handle) and
    // the standing «підтягніть оплату вручну» sentence, which repeated on
    // every single order and taught everyone to skim past the comment.
    const commentLines = [
        // Spelled out rather than reduced to "оплачено": for an order with cash
        // on delivery that word is actively misleading, since payment_status
        // goes to 'paid' once the prepayment clears while the courier still has
        // the balance to collect.
        `${order?.order_number || 'Сайт'} · ${describeMoney(readOrderMoney(order))}`,
        order?.with_designer ? '🎨 З послугою дизайнера' : '',
        order?.promo_code ? `Промокод: ${order.promo_code}` : '',
        summariseNotes(order?.notes),
        specBlock,
    ].filter(Boolean);

    const payload: any = {
        source_id: sourceId(),
        source_uuid: String(order?.order_number || order?.id),
        manager_comment: truncate(commentLines.join('\n'), ORDER_COMMENT_LIMIT),
        buyer_comment: String(order?.client_comment || ''),
        shipping_price: money(order?.delivery_cost),
        discount_amount: money(order?.discount_amount),
        ...(order?.promo_code ? { promocode: String(order.promo_code) } : {}),
        buyer: {
            full_name: String(order?.customer_name || '').trim() || 'Клієнт з сайту',
            email: String(order?.customer_email || '').trim(),
            phone: String(order?.customer_phone || '').trim(),
        },
        shipping: {
            shipping_service: deliveryLabel,
            shipping_address_city: String(address?.city || ''),
            shipping_receive_point: String(address?.branch || address?.address || ''),
            recipient_full_name: String(order?.customer_name || '').trim(),
            recipient_phone: String(order?.customer_phone || '').trim(),
            ...(optionalNumber('KEYCRM_DELIVERY_SERVICE_ID')
                ? { delivery_service_id: optionalNumber('KEYCRM_DELIVERY_SERVICE_ID') }
                : {}),
        },
        products: items.map((item: any) => mapProduct(item, productMap)),
    };

    // Tags blocked a real order for a whole night: KeyCRM validates each one
    // against its own dictionary and 422s the entire create on the first
    // unknown name. So only dictionary ids are sent as tags, and the full list
    // of names goes into the manager comment regardless — the routing stays
    // visible on the card even when the dictionary has never heard of «фото».
    const tagNames = mergeTags(order?.tags, autoTagsForOrder(order));
    if (tagNames.length) {
        const ids = tagNames
            .map(name => tagIdByName[name.trim().toLowerCase()])
            .filter((id): id is number | string => id !== undefined);
        if (ids.length) payload.tags = ids;
        payload.manager_comment += `\nТеги: ${tagNames.join(', ')}`;
    }

    // Say it on the CRM card itself when a line could not be attached to a
    // catalogue item. Otherwise the order looks perfectly normal and the gap is
    // only discovered later, when the product reports come out empty.
    const unmapped = items
        .map((item: any) => {
            const slug = itemSlug(item);
            if (!slug) return '';
            const size = String(item?.options?.['Розмір'] || '').trim();
            const found = productMap[mapKey(slug, sizeKey(size))]
                || (!size ? productMap[mapKey(slug, '')] : undefined);
            return found ? '' : (size ? `${slug} (${size})` : slug);
        })
        .filter(Boolean);

    if (unmapped.length) {
        payload.manager_comment += `\nБез звірки з номенклатурою CRM: ${unmapped.join(', ')}`;
    }

    // NO payments block — deliberately (Diana, 2026-08-12): «не став статус
    // оплачено, а пиши це в коментарях, а менеджер підтягне оплату». An order
    // arriving in the CRM already marked paid skips the team's own payment
    // routine (checking the account, fiscalisation), so the money story goes
    // into the comment instead and a manager files the payment by hand. The
    // comment's first line already carries the site order number, and the
    // describeMoney line above says exactly what was received and how.
    payload.manager_comment = truncate(payload.manager_comment, ORDER_COMMENT_LIMIT);

    return payload;
}

/** Merge the CRM reference into custom_attributes without dropping what is there. */
async function recordKeycrmId(supabase: any, order: any, keycrmOrderId: number | string) {
    const attrs = (order?.custom_attributes && typeof order.custom_attributes === 'object')
        ? order.custom_attributes
        : {};

    const merged = {
        ...attrs,
        keycrm: {
            ...(attrs.keycrm || {}),
            order_id: keycrmOrderId,
            synced_at: new Date().toISOString(),
        },
    };

    const { error } = await supabase
        .from('orders')
        .update({ custom_attributes: merged })
        .eq('id', order.id);

    if (error) {
        // The order exists in the CRM but we failed to remember it. Say so
        // loudly: the remote source_uuid check is what stops the next run from
        // creating a duplicate, and now everything depends on it.
        console.error(`[keycrm-push] CRM order ${keycrmOrderId} created but write-back failed for ${order.order_number}:`, error.message);
    }
}

/**
 * Push one order. Safe to call repeatedly — an order already in the CRM is
 * reported as already-synced rather than created again.
 */
export async function pushOrderToKeycrm(
    orderId: string,
    opts?: { dryRun?: boolean },
): Promise<PushResult> {
    const supabase = getAdminClient();
    const dryRun = opts?.dryRun === true;

    const { data: order, error } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, customer_email, customer_phone, payment_status, payment_type, prepaid_amount, order_status, delivery_method, delivery_address, delivery_cost, discount_amount, promo_code, items, total, notes, client_comment, with_designer, paid_at, created_at, cod_amount, cod_received_at, tags, custom_attributes')
        .eq('id', orderId)
        .single();

    if (error || !order) {
        return { ok: false, status: 'error', orderId, reason: error?.message || 'Замовлення не знайдено' };
    }

    const base: PushResult = { ok: false, status: 'error', orderId, orderNumber: order.order_number };

    // Test orders never leave the site (Diana, 2026-08-11: «Замовлення киця
    // кицюня не переноси ніколи»). Checked here, not only in the sweep, so the
    // manual push button in the admin panel cannot send one either.
    if (isTestOrder(order)) {
        return {
            ...base,
            ok: true,
            status: 'skipped',
            reason: 'Тестове замовлення (Киця Кицюня) — такі ніколи не переносяться в KeyCRM.',
        };
    }

    if (!getKeycrmToken()) {
        return { ...base, status: 'skipped', reason: 'KEYCRM_API_TOKEN не заданий.' };
    }
    if (!sourceId()) {
        return { ...base, status: 'skipped', reason: 'KEYCRM_SOURCE_ID не заданий — без нього KeyCRM не прийме замовлення.' };
    }

    const existingId = (order.custom_attributes as any)?.keycrm?.order_id;
    if (existingId) {
        return { ...base, ok: true, status: 'already-synced', keycrmOrderId: existingId };
    }

    // Backlog protection. Enforced here rather than only in the sweep query, so
    // the manual "push this order" button in the admin panel cannot bypass it
    // by accident either.
    const cutoff = syncFrom();
    if (!cutoff) {
        return { ...base, status: 'skipped', reason: 'KEYCRM_SYNC_FROM не заданий — без дати старту синхронізація не переносить нічого, щоб не задублювати вже перенесені вручну замовлення.' };
    }
    // Dated by payment when there is one, otherwise by creation. A
    // cash-on-delivery order has no paid_at until the courier settles, and
    // judging it by that column would place every such order before the cutoff
    // and skip it forever.
    const stamp = new Date(order.paid_at || order.created_at);
    if (!Number.isFinite(stamp.getTime()) || stamp.getTime() < cutoff.getTime()) {
        return {
            ...base,
            ok: true,
            status: 'skipped',
            reason: `Замовлення створене до старту синхронізації (${cutoff.toISOString().slice(0, 10)}), тож воно вже в KeyCRM з рук.`,
        };
    }

    const productMap = await fetchConfirmedMap();
    const tagIdByName = await fetchKeycrmTagIdByName();
    const payload = buildKeycrmOrderPayload(order, productMap, tagIdByName);

    if (dryRun) {
        return { ...base, ok: true, status: 'dry-run', payload };
    }

    if (!syncEnabled()) {
        return { ...base, status: 'skipped', reason: 'KEYCRM_SYNC_ENABLED не увімкнено.', payload };
    }

    // Remote duplicate guard. `undefined` means the check itself failed, and in
    // that case not pushing is the safe outcome: the order can be sent on the
    // next run, whereas a duplicate has to be cleaned up by a human.
    const remote = await findKeycrmOrderBySourceUuid(payload.source_uuid);
    if (remote === undefined) {
        return { ...base, status: 'skipped', reason: 'Не вдалося перевірити наявність у KeyCRM, тому нічого не створювали.' };
    }
    if (remote) {
        await recordKeycrmId(supabase, order, remote.id);
        return { ...base, ok: true, status: 'already-synced', keycrmOrderId: remote.id };
    }

    try {
        const created = await keycrmRequest('/order', { method: 'POST', body: payload });
        const keycrmOrderId = created?.id ?? created?.data?.id;

        if (!keycrmOrderId) {
            return { ...base, status: 'error', reason: 'KeyCRM не повернув id створеного замовлення.', payload };
        }

        await recordKeycrmId(supabase, order, keycrmOrderId);

        await supabase.from('order_history').insert({
            order_id: order.id,
            action: 'keycrm_synced',
            notes: `Замовлення автоматично перенесено в KeyCRM (№ ${keycrmOrderId}).`,
            added_by: null,
        });

        return { ...base, ok: true, status: 'created', keycrmOrderId };
    } catch (e: any) {
        return { ...base, status: 'error', reason: e?.message || 'Запит до KeyCRM не вдався', payload };
    }
}

/**
 * Orders that still need to go to the CRM, newest first.
 *
 * Payment is not a condition (Diana, 2026-08-19). Every order goes over — paid,
 * part-paid, or unpaid — because an unpaid order is exactly the one somebody
 * has to follow up on, and the CRM is where the team does that. Holding it back
 * until the money arrives hides it during the hours when a call would still
 * rescue the sale, and cash-on-delivery orders would otherwise reach the CRM
 * only after delivery, the one moment it stops being useful.
 *
 * What is still excluded is what was never a sale: cancelled and refunded
 * orders (the query), mirrored copies the CRM already owns, and test personas.
 * The money story travels in the comment, and no payment is filed until the
 * money is genuinely in — see readOrderMoney.
 *
 * The floor is the later of the sync start date and the sweep window, so the
 * historical backlog — already carried over by hand — is never a candidate.
 * Returns an empty list when no start date is configured.
 */
export async function findUnsyncedOrders(params: { windowDays: number; limit: number }) {
    const cutoff = syncFrom();
    if (!cutoff) return [];

    const windowStart = Date.now() - params.windowDays * 24 * 60 * 60 * 1000;
    const since = new Date(Math.max(cutoff.getTime(), windowStart)).toISOString();

    const supabase = getAdminClient();
    const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, source, customer_name, customer_phone, custom_attributes, paid_at, created_at, order_status, payment_status, payment_type, total, prepaid_amount, cod_amount, cod_received_at')
        // Dated on creation, not on payment: a cash-on-delivery order may never
        // get a paid_at at all, and filtering on it would hide those orders from
        // the sweep entirely.
        .gte('created_at', since)
        .not('order_status', 'in', '("cancelled","refunded")')
        .order('created_at', { ascending: false })
        .limit(params.limit * 4);

    if (error) throw error;

    const rows = data || [];

    // Abandoned retries must not become their own CRM cards.
    //
    // A customer who reaches the payment page, closes it and orders again leaves
    // TWO rows for one sale — the same phone, the same total, minutes apart, one
    // unpaid and one paid. While only paid orders travelled this was invisible;
    // now that unpaid ones do, the abandoned attempt would open a second card
    // beside the real one. The data already holds the pattern: TM-001193 and
    // TM-001194 (Ілля Косов, 720 ₴, 23 seconds apart, second one paid and synced
    // as 13876), TM-001130 and TM-001131 (Марія Дудар, 1025 ₴, same minute).
    //
    // So an unpaid order is skipped when a twin — same phone, same total, within
    // twenty minutes — has either been paid or already reached the CRM. The twin
    // IS the order; this row is the discarded attempt at it.
    const TWIN_WINDOW_MS = 20 * 60 * 1000;
    const twinKey = (o: any) =>
        `${String(o?.customer_phone || '').replace(/\D/g, '').slice(-9)}|${Number(o?.total) || 0}`;
    const crmIdOf = (o: any) => (o?.custom_attributes as any)?.keycrm?.order_id;
    const isSupersededAttempt = (o: any): boolean => {
        const phoneDigits = String(o?.customer_phone || '').replace(/\D/g, '');
        if (phoneDigits.length < 9) return false; // no phone, no reliable twin
        const key = twinKey(o);
        const at = new Date(o?.created_at).getTime();
        const twins = rows.filter(c =>
            c.id !== o.id &&
            twinKey(c) === key &&
            Math.abs(new Date(c.created_at).getTime() - at) <= TWIN_WINDOW_MS,
        );
        if (!twins.length) return false;

        // A twin that already has a CRM card settles it for either kind of row:
        // the sale is in the CRM, and this is the spare attempt. Verified against
        // the live data — TM-001131 is PAID yet its sale already sits on a card
        // from an earlier attempt, so exempting paid rows would have duplicated
        // it. That was the first version of this rule, and it was wrong.
        if (twins.some(crmIdOf)) return true;

        // Otherwise only an unpaid row yields, and only to a paid twin. Two paid
        // twins with no card yet are left alone: dropping one could lose a real
        // sale, and a duplicate card is the cheaper mistake to undo.
        return o?.payment_status !== 'paid' && twins.some(c => c.payment_status === 'paid');
    };

    return rows
        .filter(o => !(o.custom_attributes as any)?.keycrm?.order_id)
        // A mirrored order is a read-only copy of an order that already lives in
        // the CRM. Pushing it would create a second card for the same sale.
        .filter(o => o.source !== MIRROR_SOURCE)
        // Test personas («Киця Кицюня») place orders only to check that the
        // site works. They are never real sales and never go to the CRM.
        .filter(o => !isTestOrder(o))
        // An order of 0 ₴ is not an unpaid order, it is an empty one — a cart
        // that never got a product. Diana asked for unpaid orders in the CRM,
        // not for empty rows (TM-001212, TM-001163 are both 0 ₴).
        .filter(o => (Number(o.total) || 0) > 0)
        .filter(o => !isSupersededAttempt(o))
        .filter(shouldPushToCrm)
        .slice(0, params.limit);
}
