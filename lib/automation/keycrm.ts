/**
 * Read-only KeyCRM client for operational reports.
 *
 * Context: orders exist in two places. The website writes them to Supabase, and
 * a manager then re-types them into KeyCRM by hand. Neither system knows about
 * the other, so nobody can answer "what did we forget" without opening both.
 * This module gives server-side jobs a normalised view of recent KeyCRM orders
 * so a report can be built across both sources.
 *
 * It only ever reads. Nothing here writes to KeyCRM — a reporting job must not
 * be able to mutate the CRM the whole team works in.
 *
 * The paging and retry behaviour deliberately mirrors
 * app/api/admin/crm-import/keycrm/route.ts, which learned it the hard way:
 * `limit` is capped at 50, the per-minute quota is real, and 429 carries a
 * Retry-After worth honouring.
 */

const API_BASE = 'https://openapi.keycrm.app/v1';
const PAGE_SIZE = 50;
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const PAGE_GAP_MS = 350;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export type KeycrmOrder = {
    id: number | string;
    /** Free-form external reference. Managers sometimes paste the site order number here. */
    source_uuid: string;
    /** The CRM's own order source («Сайт», «Інстаграм»), as its numeric id. */
    source_id: string;
    status_id: number | string | null;
    status_label: string;
    /** When the CURRENT stage was set, if the API exposes it. Empty otherwise. */
    status_changed_at: string;
    grand_total: number;
    created_at: string;
    updated_at: string;
    buyer_name: string;
    buyer_email: string;
    buyer_phone: string;
    manager_comment: string;
    buyer_comment: string;
    /** The CRM's manager (full name) — who leads the order. */
    manager_name: string;
    /**
     * «Відповідальні» on the CRM card — the designers doing the layout. A
     * different field and a different role from the manager (Diana,
     * 2026-08-14: «менеджер — це менеджер, а відповідальний — це дизайнер»).
     * The API exposes it under `include=assigned`, which is the one spelling
     * the allowed-include list actually contains.
     */
    assigned_names: string[];
    /** Waybill number when the CRM already shipped the parcel. */
    ttn: string;
    /** Carrier name as the CRM knows it, for the tracking link on the site. */
    shipping_service: string;
    /**
     * Where the parcel goes, as one readable line — country, city, branch,
     * recipient. Diana asked «13500 яка країна?» and Софія had nothing to
     * answer from, because the mirror kept only the delivery METHOD.
     */
    shipping_address: string;
    /** Sum of every payment filed against the order in the CRM. */
    payments_total: number;
    /** Tags as the team set them in the CRM. */
    tags: string[];
    /** Files attached to the order card — the design the workshop prints from. */
    files: Array<{ name: string; url: string }>;
    /** Line items, so the site can report on what was actually sold. */
    products: Array<{
        name: string;
        sku: string;
        quantity: number;
        price: number;
        /** Chosen options, e.g. "Вид оздоблення: Гравіювання". */
        properties: Record<string, string>;
    }>;
};

export type KeycrmFetchResult = {
    ok: boolean;
    orders: KeycrmOrder[];
    /** Human-readable reason the pull was skipped or cut short, for the report footer. */
    warning?: string;
};

/** «Відповідальні» as plain names, whatever shape the account returns. */
function assignedNames(raw: any): string[] {
    const value = raw?.assigned ?? raw?.assigned_users ?? raw?.assignedUsers;
    const list = Array.isArray(value) ? value : (value ? [value] : []);
    return list
        .map((u: any) => {
            if (typeof u === 'string') return u;
            const full = u?.full_name ?? u?.name;
            if (full) return String(full);
            return [u?.first_name, u?.last_name].filter(Boolean).join(' ');
        })
        .map((s: string) => String(s || '').trim())
        .filter(Boolean);
}

function asStringList(value: any): string[] {
    if (value === null || value === undefined) return [];
    const raw = Array.isArray(value) ? value : [value];
    return raw
        .map(item => {
            if (typeof item === 'string') return item;
            if (typeof item === 'number') return String(item);
            if (item && typeof item === 'object') {
                return String(item.value ?? item.email ?? item.phone ?? item.number ?? '');
            }
            return '';
        })
        .map(s => s.trim())
        .filter(Boolean);
}

async function fetchJson(path: string, token: string, init?: { method?: string; body?: any }): Promise<any> {
    let lastError = '';
    const method = init?.method || 'GET';
    const isRead = method === 'GET';

    for (let attempt = 0; attempt < 3; attempt++) {
        let res: Response;
        try {
            res = await fetch(`${API_BASE}${path}`, {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                    ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
                },
                body: init?.body ? JSON.stringify(init.body) : undefined,
                cache: 'no-store',
            });
        } catch (e: any) {
            lastError = e?.message || 'network error';
            // A write may already have been accepted when the connection broke,
            // so retrying it risks a second order in the CRM. Reads are safe.
            if (!isRead) throw new Error(`KeyCRM недоступний (${lastError}).`);
            await sleep(500 * (attempt + 1));
            continue;
        }

        if (res.ok) return res.json();

        if (res.status === 401 || res.status === 403) {
            throw new Error('KeyCRM відхилив токен. Перевір KEYCRM_API_TOKEN у змінних Vercel.');
        }
        if (!RETRY_STATUSES.has(res.status)) {
            // The body of a 422 names the field KeyCRM did not like, which is
            // the only way to debug a payload shape without shell access to the
            // account. Truncated so a hostile response cannot flood the logs.
            const detail = await res.text().catch(() => '');
            // 300 characters used to cut the «allowed include(s)» list of a 400
            // mid-word, which is precisely the part needed to find where this
            // account keeps «Відповідальні».
            throw new Error(`KeyCRM повернув ${res.status}. ${detail.slice(0, 1200)}`.trim());
        }

        // 5xx on a write is ambiguous: KeyCRM may have created the order before
        // failing to answer. Only 429 is safe to repeat, because a throttled
        // request was never processed.
        if (!isRead && res.status !== 429) {
            throw new Error(`KeyCRM повернув ${res.status} на запис, повтор не робимо, щоб не створити дубль.`);
        }

        const retryAfter = Number(res.headers.get('retry-after'));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 8000)
            : 1500 * (attempt + 1);
        lastError = `HTTP ${res.status}`;
        await sleep(waitMs);
    }

    throw new Error(`KeyCRM не відповів після трьох спроб (${lastError}).`);
}

/**
 * Status ids mean nothing in a report, so try to resolve them to names. Every
 * KeyCRM account names its own pipeline stages and the endpoint that lists them
 * has moved between API versions, so this tries the known paths and gives up
 * quietly — a digest with numeric statuses is still useful, a digest that fails
 * to render because of a label lookup is not.
 */
async function fetchStatusLabels(token: string): Promise<Record<string, string>> {
    const candidates = ['/order/status?limit=50', '/pipelines/status?limit=50', '/pipelines?limit=50'];

    for (const path of candidates) {
        try {
            const payload = await fetchJson(path, token);
            const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];
            const map: Record<string, string> = {};

            for (const row of rows) {
                if (row?.id !== undefined && row?.name) map[String(row.id)] = String(row.name);
                // Pipelines nest their stages one level down.
                for (const stage of (Array.isArray(row?.statuses) ? row.statuses : [])) {
                    if (stage?.id !== undefined && stage?.name) map[String(stage.id)] = String(stage.name);
                }
            }

            if (Object.keys(map).length > 0) return map;
        } catch {
            // Try the next shape.
        }
    }

    return {};
}

function normaliseOrder(raw: any, statusLabels: Record<string, string>): KeycrmOrder {
    const total = Number(raw?.grand_total ?? raw?.total_price ?? 0);
    const statusId = raw?.status_id ?? null;

    // Shipping shape differs per delivery integration; the waybill hides under
    // several names depending on which carrier the account uses.
    const shipping = raw?.shipping || {};
    const ttn = String(
        shipping?.tracking_code ?? shipping?.declaration_id ?? shipping?.ttn ?? raw?.ttn ?? ''
    ).trim();

    // The destination, assembled from whichever keys this account's delivery
    // integration uses. Nova Poshta, Ukrposhta and the international couriers
    // each name these differently, so the readable line is built from every
    // spelling seen rather than one guessed, and duplicates are dropped —
    // «Україна, Львів, Відділення №12, Шитікова Олена».
    const shippingAddress = (() => {
        const pick = (...keys: string[]) => {
            for (const key of keys) {
                const value = String((shipping as any)?.[key] ?? '').trim();
                if (value) return value;
            }
            return '';
        };
        const parts = [
            pick('shipping_address_country', 'country', 'country_name'),
            pick('shipping_address_region', 'region', 'shipping_address_area'),
            pick('shipping_address_city', 'city', 'city_name', 'shipping_city'),
            pick('shipping_receive_point', 'warehouse', 'shipping_address_warehouse', 'address', 'shipping_address'),
            pick('recipient_full_name', 'recipient', 'full_name'),
        ].map(s => s.trim()).filter(Boolean);

        const seen = new Set<string>();
        return parts.filter(p => {
            const key = p.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).join(', ');
    })();

    // Payments are an array on the order; only settled ones count towards what
    // the CRM believes has been received, otherwise a pending line would look
    // like money already in and suppress the top-up the site needs to send.
    const payments: any[] = Array.isArray(raw?.payments) ? raw.payments : [];
    const paymentsTotal = payments
        .filter(p => {
            const status = String(p?.status ?? '').toLowerCase();
            return status === '' || status === 'paid' || status === 'success' || status === 'completed';
        })
        .reduce((sum, p) => {
            const amount = Number(p?.amount ?? 0);
            return sum + (Number.isFinite(amount) ? amount : 0);
        }, 0);

    // Tags come back either as plain strings or as objects with a name,
    // depending on the endpoint and the account's API version.
    const tags: string[] = (Array.isArray(raw?.tags) ? raw.tags : [])
        .map((t: any) => (typeof t === 'string' ? t : String(t?.name ?? '')).trim())
        .filter(Boolean);

    // The attached artwork. Field names differ per account, so several shapes
    // are accepted rather than one guessed.
    const files = (Array.isArray(raw?.files) ? raw.files : [])
        .map((f: any) => ({
            name: String(f?.name ?? f?.file_name ?? 'файл').trim(),
            url: String(f?.url ?? f?.path ?? f?.link ?? '').trim(),
        }))
        .filter((f: any) => f.url);

    // Line items. Their properties matter as much as their names: the decoration
    // type ("Вид оздоблення: Гравіювання") decides who makes the order, and it
    // lives only here.
    const products = (Array.isArray(raw?.products) ? raw.products : []).map((p: any) => {
        const properties: Record<string, string> = {};
        for (const prop of (Array.isArray(p?.properties) ? p.properties : [])) {
            const name = String(prop?.name ?? '').trim();
            const value = String(prop?.value ?? '').trim();
            if (name && value) properties[name] = value;
        }

        const price = Number(p?.price ?? 0);
        const quantity = Number(p?.quantity ?? 1);

        return {
            name: String(p?.name ?? p?.product_name ?? '').trim(),
            sku: String(p?.sku ?? '').trim(),
            quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
            price: Number.isFinite(price) ? price : 0,
            properties,
        };
    });

    return {
        id: raw?.id,
        tags,
        files,
        products,
        source_id: String(raw?.source_id ?? '').trim(),
        source_uuid: String(raw?.source_uuid ?? '').trim(),
        shipping_service: String(shipping?.shipping_service ?? shipping?.delivery_service?.name ?? '').trim(),
        shipping_address: shippingAddress,
        payments_total: Math.round(paymentsTotal * 100) / 100,
        status_id: statusId,
        status_label: statusId !== null && statusLabels[String(statusId)]
            ? statusLabels[String(statusId)]
            : (statusId !== null ? `статус ${statusId}` : 'без статусу'),
        // Different accounts/API versions expose this under different names, if
        // at all. Read defensively — the print-start stamp prefers this exact
        // moment over "when the sync first noticed".
        status_changed_at: String(raw?.status_changed_at ?? raw?.status_updated_at ?? '').trim(),
        grand_total: Number.isFinite(total) ? total : 0,
        created_at: String(raw?.created_at ?? ''),
        updated_at: String(raw?.updated_at ?? raw?.created_at ?? ''),
        buyer_name: String(raw?.buyer?.full_name ?? '').trim(),
        buyer_email: (asStringList(raw?.buyer?.email)[0] || '').toLowerCase(),
        buyer_phone: asStringList(raw?.buyer?.phone)[0] || '',
        manager_comment: String(raw?.manager_comment ?? '').trim(),
        buyer_comment: String(raw?.buyer_comment ?? '').trim(),
        // Who is responsible in the CRM. Diana's team assigns every order a
        // manager there, and «хто відповідальний?» must be answerable from
        // the site/bot without opening the CRM.
        manager_name: String(raw?.manager?.full_name ?? raw?.manager?.name ?? '').trim(),
        assigned_names: assignedNames(raw),
        ttn,
    };
}

/**
 * Pull recent orders, newest first, stopping once the page walk reaches orders
 * older than `sinceIso` or runs out of its page budget.
 *
 * Never throws. A CRM outage must degrade the report to "website data only"
 * rather than kill the job that was supposed to warn everyone about problems.
 */
export async function fetchRecentKeycrmOrders(params: {
    sinceIso: string;
    maxPages?: number;
}): Promise<KeycrmFetchResult> {
    const token = String(process.env.KEYCRM_API_TOKEN || '').trim();
    if (!token) {
        return { ok: false, orders: [], warning: 'KEYCRM_API_TOKEN не заданий, дані CRM у звіт не потрапили.' };
    }

    const maxPages = Math.min(10, Math.max(1, params.maxPages ?? 4));
    const sinceMs = new Date(params.sinceIso).getTime();
    const orders: KeycrmOrder[] = [];

    try {
        const statusLabels = await fetchStatusLabels(token);

        for (let page = 1; page <= maxPages; page++) {
            if (page > 1) await sleep(PAGE_GAP_MS);

            // include=buyer: without the association there is no email on the
            // order, and email is the only field both systems reliably share.
            //
            // `sort` is retried away on failure: it is documented, but which
            // sort keys an account accepts has changed between API versions and
            // one rejected parameter must not cost us the entire CRM section.
            // Ask for everything the mirror maps. KeyCRM's list endpoint
            // returns tags, line items and payments ONLY when each is named in
            // `include` — the first live run proved it: with include=buyer
            // alone every mirrored order arrived with no items, no tags and a
            // zero payment total, so the admin list showed «Без товарів» and
            // «Очікує оплати» on paid orders. The include list degrades
            // per-attempt because unknown include names are rejected by some
            // API versions, and a partial mirror beats none.
            const attempts = [
                `/order?page=${page}&limit=${PAGE_SIZE}&include=buyer,products,payments,shipping,tags,manager,assigned&sort=-id`,
                `/order?page=${page}&limit=${PAGE_SIZE}&include=buyer,products,payments,shipping,tags,manager&sort=-id`,
                `/order?page=${page}&limit=${PAGE_SIZE}&include=buyer,products,payments,shipping,tags,manager`,
                `/order?page=${page}&limit=${PAGE_SIZE}&include=buyer,products,payments,shipping,tags&sort=-id`,
                `/order?page=${page}&limit=${PAGE_SIZE}&include=buyer,products,payments,shipping,tags`,
                `/order?page=${page}&limit=${PAGE_SIZE}&include=buyer&sort=-id`,
                `/order?page=${page}&limit=${PAGE_SIZE}&include=buyer`,
            ];

            let payload: any = null;
            let lastError: any = null;
            for (const attempt of attempts) {
                try {
                    payload = await fetchJson(attempt, token);
                    break;
                } catch (e: any) {
                    if (String(e?.message || '').includes('відхилив токен')) throw e;
                    lastError = e;
                }
            }
            if (payload === null) throw lastError;

            const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];
            if (rows.length === 0) break;

            let reachedOlder = false;
            for (const raw of rows) {
                const order = normaliseOrder(raw, statusLabels);
                const createdMs = new Date(order.created_at).getTime();
                if (Number.isFinite(createdMs) && createdMs < sinceMs) {
                    reachedOlder = true;
                    continue;
                }
                orders.push(order);
            }

            const perPage = Number(payload?.per_page) || PAGE_SIZE;
            if (reachedOlder || rows.length < perPage || payload?.next_page_url === null) break;
        }

        return { ok: true, orders };
    } catch (e: any) {
        return {
            ok: orders.length > 0,
            orders,
            warning: `Дані KeyCRM неповні: ${e?.message || 'запит не вдався'}`,
        };
    }
}

export function getKeycrmToken(): string {
    return String(process.env.KEYCRM_API_TOKEN || '').trim();
}

/**
 * Raw request against the KeyCRM API. Used by the order push, which needs POST;
 * everything else in this file goes through the typed helpers above.
 */
export async function keycrmRequest(
    path: string,
    init?: { method?: string; body?: any },
): Promise<any> {
    const token = getKeycrmToken();
    if (!token) throw new Error('KEYCRM_API_TOKEN не заданий.');
    return fetchJson(path, token, init);
}

/**
 * Order sources as configured in the account ("Сайт", "Instagram", …).
 * Creating an order requires a source_id, and the ids are account-specific, so
 * this exists to let an admin look up the right number once during setup.
 */
export async function fetchKeycrmSources(): Promise<Array<{ id: number | string; name: string }>> {
    const payload = await keycrmRequest('/order/source?limit=50');
    const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];
    return rows
        .filter(r => r?.id !== undefined)
        .map(r => ({ id: r.id, name: String(r?.name ?? '') }));
}

/**
 * Payment methods as configured in the account ("Монобанк", "Готівка", …).
 *
 * Without one of these ids the order push deliberately omits the payment block
 * entirely, so every transferred order lands in the CRM looking unpaid. This is
 * how the right id gets found instead of guessed — booking real money against
 * the wrong method is far harder to untangle than entering it by hand once.
 *
 * Best-effort: the endpoint has moved between API versions, so the known paths
 * are tried in turn and an empty list is returned rather than an exception.
 */
export async function fetchKeycrmPaymentMethods(): Promise<Array<{ id: number | string; name: string }>> {
    for (const path of ['/order/payment-method?limit=50', '/payment-methods?limit=50', '/order/payment_method?limit=50']) {
        try {
            const payload = await keycrmRequest(path);
            const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];
            const mapped = rows
                .filter(r => r?.id !== undefined)
                .map(r => ({ id: r.id, name: String(r?.name ?? '') }));
            if (mapped.length) return mapped;
        } catch {
            // Try the next shape.
        }
    }
    return [];
}

/**
 * One order, fresh from the CRM, with everything the two-way sync needs:
 * payments to compare against the site, and shipping to copy back to it.
 *
 * Returns null when the order is gone — deleted in the CRM, or an id we stored
 * that never existed — so the caller can stop chasing it instead of retrying
 * every half hour forever.
 */
export async function fetchKeycrmOrderById(id: string | number): Promise<KeycrmOrder | null> {
    const payload = await keycrmRequest(`/order/${encodeURIComponent(String(id))}?include=buyer,payments,shipping,products,tags,manager,assigned`);
    const raw = payload?.data ?? payload;
    if (!raw?.id) return null;

    const labels = await fetchStatusLabelsCached();
    return normaliseOrder(raw, labels);
}

/** Status id → name, resolved once per invocation. */
let statusLabelCache: Record<string, string> | null = null;

async function fetchStatusLabelsCached(): Promise<Record<string, string>> {
    if (statusLabelCache) return statusLabelCache;
    const token = getKeycrmToken();
    statusLabelCache = token ? await fetchStatusLabels(token) : {};
    return statusLabelCache;
}

/** The account's order statuses, for building the status mapping once. */
export async function fetchKeycrmStatuses(): Promise<Array<{ id: string; name: string }>> {
    const labels = await fetchStatusLabelsCached();
    return Object.entries(labels).map(([id, name]) => ({ id, name }));
}

export type KeycrmOffer = {
    offer_id: string;
    sku: string;
    name: string;
    price: number;
    /** Purchase cost, when the account exposes one. Null when absent. */
    cost: number | null;
    /** Which API field the cost came from, so an unexpected schema is visible. */
    cost_field: string | null;
    /** Units on hand in the CRM. Null when the account exposes no stock at all. */
    quantity: number | null;
    /** The parent product's id in KeyCRM — what a catalogue URL points at. */
    product_id: string;
    /** The variant's own properties («розмір: 30х40см»), for size matching. */
    variant_label: string;
};

// Stock, like cost, has been named differently across API versions and account
// types, and on some accounts it only appears inside a per-warehouse array.
const STOCK_FIELDS = ['quantity', 'in_stock', 'stock_quantity', 'available', 'balance'];

function readStock(row: any): number | null {
    for (const field of STOCK_FIELDS) {
        const raw = row?.[field];
        if (raw === null || raw === undefined || raw === '') continue;
        const value = Number(raw);
        if (Number.isFinite(value)) return value;
    }

    // Per-warehouse breakdown: the total across warehouses is what the site's
    // single stock figure means.
    const warehouses = Array.isArray(row?.warehouse) ? row.warehouse
        : Array.isArray(row?.warehouses) ? row.warehouses
        : Array.isArray(row?.stocks) ? row.stocks
        : null;

    if (warehouses) {
        let sum = 0;
        let found = false;
        for (const w of warehouses) {
            for (const field of STOCK_FIELDS) {
                const value = Number(w?.[field]);
                if (Number.isFinite(value)) { sum += value; found = true; break; }
            }
        }
        if (found) return sum;
    }

    return null;
}

// KeyCRM has named the purchase price differently across API versions and
// account types. Probing several names beats hard-coding one and silently
// importing nothing.
const COST_FIELDS = ['purchased_price', 'purchase_price', 'cost_price', 'cost', 'price_purchase'];

function readCost(row: any): { cost: number | null; field: string | null } {
    for (const field of COST_FIELDS) {
        const raw = row?.[field] ?? row?.product?.[field];
        if (raw === null || raw === undefined || raw === '') continue;

        const value = Number(raw);
        // Zero is a legitimate "not filled in" in KeyCRM, and importing it would
        // wipe a cost somebody entered on the site by hand.
        if (Number.isFinite(value) && value > 0) return { cost: value, field };
    }
    return { cost: null, field: null };
}

/**
 * The CRM's own catalogue, flattened to one row per sellable item.
 *
 * KeyCRM splits a catalogue into products and their offers (variants), and only
 * the offer carries an SKU. An order line attaches to the offer, so that is the
 * level this returns. Walks pages until the catalogue is exhausted or the page
 * budget runs out — a shop with tens of thousands of offers is not the shape
 * this is for.
 */
/**
 * The page budget covers the WHOLE catalogue, deliberately.
 *
 * It was eight pages (400 offers) and the account holds twice that: every
 * offer past the cut-off was invisible to the cost and stock syncs, which is
 * why photobooks and photomagnets showed «немає закупівельної» while KeyCRM
 * had it all along (Diana, 2026-08-11: «KeyCRM має закупівельну вартість для
 * фотокниг, фотомагнітів»). A truncated catalogue read fails silently — it
 * looks exactly like a CRM with missing data — so the budget is now generous
 * and the walk stops on its own at the last page.
 */
/**
 * One catalogue read per run, shared.
 *
 * The upkeep pass calls this three times in a row (resolve links → write SKUs
 * → pull costs) and the stock sync a fourth. At 40 pages with a courtesy gap
 * between them that is four full catalogue walks in one 60-second function —
 * which is exactly how the sync started timing out (504) the moment the page
 * budget grew. A short-lived cache makes the extra calls free without holding
 * stale data across runs.
 */
let offersCache: { at: number; offers: KeycrmOffer[] } | null = null;
const OFFERS_CACHE_MS = 5 * 60 * 1000;

export async function fetchKeycrmOffers(maxPages = 40): Promise<KeycrmOffer[]> {
    if (offersCache && Date.now() - offersCache.at < OFFERS_CACHE_MS) {
        return offersCache.offers;
    }

    const offers: KeycrmOffer[] = [];

    for (let page = 1; page <= maxPages; page++) {
        if (page > 1) await sleep(PAGE_GAP_MS);

        // include=product: the offer itself is often named only by its variant
        // properties ("Зелений"), and the buyer-facing name lives on the parent.
        // include=properties as well, degrading when the account rejects it:
        // the listing omits the variant's own properties («розмір: 30х40см»)
        // unless asked, and without them the per-size offers of one product
        // are indistinguishable — the canvas-print linking matched only the
        // sizes whose offer NAME happened to carry the dimensions.
        let payload: any;
        try {
            payload = await keycrmRequest(`/offers?page=${page}&limit=${PAGE_SIZE}&include=product,properties`);
        } catch {
            try {
                payload = await keycrmRequest(`/offers?page=${page}&limit=${PAGE_SIZE}&include=product`);
            } catch {
                // Older accounts expose the catalogue only as products.
                payload = await keycrmRequest(`/products?page=${page}&limit=${PAGE_SIZE}`);
            }
        }

        const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];
        if (rows.length === 0) break;

        for (const row of rows) offers.push(parseOfferRow(row));

        const perPage = Number(payload?.per_page) || PAGE_SIZE;
        if (rows.length < perPage || payload?.next_page_url === null) break;
    }

    offersCache = { at: Date.now(), offers };
    return offers;
}

function parseOfferRow(row: any): KeycrmOffer {
    const parentName = String(row?.product?.name ?? '').trim();
    const ownName = String(row?.name ?? '').trim();
    const price = Number(row?.price ?? row?.product?.price ?? 0);
    const { cost, field } = readCost(row);

    // The variant's own properties, joined («розмір: 30х40см»). This is where
    // per-size products carry their size, and pasting the PARENT product's URL
    // relies on it to route each site size to the right variant.
    const propsLabel = Array.isArray(row?.properties)
        ? row.properties
            .map((p: any) => `${String(p?.name ?? '').trim()}: ${String(p?.value ?? '').trim()}`)
            .filter((s: string) => s !== ': ')
            .join(' ')
        : '';

    return {
        cost,
        cost_field: field,
        quantity: readStock(row),
        offer_id: String(row?.id ?? ''),
        product_id: String(row?.product_id ?? row?.product?.id ?? ''),
        variant_label: propsLabel || ownName,
        sku: String(row?.sku ?? '').trim(),
        // Prefer the parent name and append the variant when both exist, so
        // "Фотоальбом на 200 фото" and "Зелений" become one label a name match
        // can actually work against.
        name: [parentName, ownName && ownName !== parentName ? ownName : '']
            .filter(Boolean)
            .join(' ')
            .trim(),
        price: Number.isFinite(price) ? price : 0,
    };
}

/**
 * The offers of ONE product, asked for directly.
 *
 * The paged catalogue read has a page budget, and a pasted link can point at
 * any product — including one the budget never reaches (live case: «Набір для
 * відбитків», product 10, answered «не знайдено» while existing perfectly
 * well). filter[product_id] asks the CRM for exactly that product's variants.
 */
export async function fetchKeycrmOffersByProduct(productId: string | number): Promise<KeycrmOffer[]> {
    const id = encodeURIComponent(String(productId));

    for (const path of [
        `/offers?filter[product_id]=${id}&limit=50&include=product,properties`,
        `/offers?filter[product_id]=${id}&limit=50&include=product`,
        `/offers?product_id=${id}&limit=50&include=product`,
    ]) {
        try {
            const payload = await keycrmRequest(path);
            const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];
            if (rows.length) {
                // Defensive: some API versions ignore unknown filters and
                // return the first page of EVERYTHING — keep only rows that
                // really belong to the requested product.
                const parsed = rows.map(parseOfferRow);
                const own = parsed.filter(o => o.product_id === String(productId));
                if (own.length) return own;
                continue;
            }
        } catch {
            // Try the next filter spelling.
        }
    }

    return [];
}

/**
 * Everything the CRM card knows beyond the mirrored fields — the comment feed
 * and custom fields (Diana, 2026-08-11: «який велюр … чи може бот глянути це
 * в коментарях до замовлення»; the velour colour lives on the card, not in
 * the line items). Endpoint spellings are probed defensively, same as every
 * other read here, and failure means an empty result, never an exception —
 * these are garnish on an answer, not the answer.
 */
export async function fetchOrderCardExtras(orderId: string | number): Promise<{
    comments: string[];
    custom_fields: string[];
    /** Who leads the order in the CRM, read live. */
    manager: string;
    /** «Відповідальні» — the designers, read live. */
    assigned: string[];
}> {
    const id = encodeURIComponent(String(orderId));
    const result = { comments: [] as string[], custom_fields: [] as string[], manager: '', assigned: [] as string[] };

    try {
        // manager and assigned ride along on the call the answer already
        // makes. The mirror only refreshes orders from the last fourteen days,
        // so an older card — 13534, asked about live — would otherwise never
        // gain its designers (Diana, 2026-08-14: «вона так і не дає
        // відповідального»).
        const payload = await keycrmRequest(`/order/${id}?include=products,custom_fields,manager,assigned`);
        result.manager = String(payload?.manager?.full_name ?? payload?.manager?.name ?? '').trim();
        result.assigned = assignedNames(payload);
        const fields: any[] = Array.isArray(payload?.custom_fields) ? payload.custom_fields : [];
        result.custom_fields = fields
            .map(f => {
                const name = String(f?.name ?? f?.uuid ?? '').trim();
                const value = Array.isArray(f?.value) ? f.value.join(', ') : String(f?.value ?? '').trim();
                return name && value ? `${name}: ${value}` : '';
            })
            .filter(Boolean)
            .slice(0, 10);

        // The specification the team actually writes lives in the PRODUCT
        // LINE's «Коментар» column (Diana's screenshot of 13790: «23х23, білі
        // сторінки / В-01, гравіювання / A&N / …») — not in the card's
        // activity feed, which the API refuses to serve. These line comments
        // are the primary harvest of this whole function.
        const productRows: any[] = Array.isArray(payload?.products) ? payload.products : [];
        for (const p of productRows) {
            const line = String(p?.comment ?? p?.note ?? '').trim();
            if (line) {
                const name = String(p?.name ?? '').trim();
                result.comments.push(name ? `${name}: ${line}` : line);
            }
        }
    } catch { /* the account may not expose custom fields — fine */ }

    for (const path of [
        `/order/${id}/comments?limit=50`,
        `/order/${id}/comment?limit=50`,
        `/comments?filter[order_id]=${id}&limit=50`,
        `/order/comments?filter[order_id]=${id}&limit=50`,
    ]) {
        try {
            const payload = await keycrmRequest(path);
            const rows: any[] = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
            const texts = rows
                .map(r => String(r?.text ?? r?.comment ?? r?.message ?? '').trim())
                .filter(Boolean)
                .slice(-15);
            if (texts.length) {
                result.comments = texts;
                break;
            }
        } catch { /* try the next spelling */ }
    }

    // Some API versions expose the feed only as an include on the order read.
    if (!result.comments.length) {
        try {
            const payload = await keycrmRequest(`/order/${id}?include=comments`);
            const rows: any[] = Array.isArray(payload?.comments) ? payload.comments : [];
            result.comments = rows
                .map(r => String(r?.text ?? r?.comment ?? r?.message ?? '').trim())
                .filter(Boolean)
                .slice(-15);
        } catch { /* the account simply does not expose the feed */ }
    }

    // Visible in runtime logs on purpose: whether THIS account's API exposes
    // the card comment feed is unknowable from the code alone, and the answer
    // decides where the velour code can come from.
    console.log(`[keycrm] card extras for ${orderId}: ${result.comments.length} comments, ${result.custom_fields.length} custom fields`);

    return result;
}

/**
 * Specific offers, asked for by id.
 *
 * Confirmed catalogue mappings store an offer id, but the bulk listing stops at
 * its page budget — a mapping made months ago can point at an offer the walk no
 * longer reaches (live case: the four markers, offers 21–24, reported as «не
 * знайдено в каталозі» by both the SKU and the cost sync while existing
 * perfectly well). This asks for exactly the missing ids, chunked, degrading
 * across filter spellings like every other read here. Rows are defensively
 * filtered to the requested ids in case an API version ignores the filter and
 * returns the first page of everything.
 */
export async function fetchKeycrmOffersByIds(ids: Array<string | number>): Promise<KeycrmOffer[]> {
    const wanted = [...new Set(ids.map(String).filter(Boolean))];
    if (!wanted.length) return [];

    const found: KeycrmOffer[] = [];

    for (let i = 0; i < wanted.length; i += 50) {
        if (i > 0) await sleep(PAGE_GAP_MS);
        const chunk = wanted.slice(i, i + 50);
        const list = encodeURIComponent(chunk.join(','));

        for (const path of [
            `/offers?filter[id]=${list}&limit=50&include=product,properties`,
            `/offers?filter[id]=${list}&limit=50&include=product`,
            `/offers?filter[ids]=${list}&limit=50&include=product`,
        ]) {
            try {
                const payload = await keycrmRequest(path);
                const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];
                if (!rows.length) continue;

                const asked = new Set(chunk);
                const own = rows.map(parseOfferRow).filter(o => asked.has(o.offer_id));
                if (own.length) {
                    found.push(...own);
                    break;
                }
            } catch {
                // Try the next filter spelling.
            }
        }
    }

    return found;
}

/**
 * The account's tag dictionary, name → id, cached per invocation.
 *
 * Learned from a live 422 ("The selected tags.0 is invalid"): KeyCRM does not
 * accept tags as text on an order — only ids from its own dictionary. TM-001175
 * sat unpushed all night because its auto tags («фото») had no dictionary
 * entry. Names are matched case-insensitively; an empty map just means every
 * tag travels via the comment instead.
 */
let tagDictionaryPromise: Promise<Record<string, number | string>> | null = null;

export async function fetchKeycrmTagIdByName(): Promise<Record<string, number | string>> {
    if (!tagDictionaryPromise) {
        tagDictionaryPromise = (async () => {
            for (const path of ['/tags?limit=100', '/order/tags?limit=100', '/tag?limit=100']) {
                try {
                    const payload = await keycrmRequest(path);
                    const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];
                    const map: Record<string, number | string> = {};
                    for (const row of rows) {
                        if (row?.id !== undefined && row?.name) map[String(row.name).trim().toLowerCase()] = row.id;
                    }
                    if (Object.keys(map).length) return map;
                } catch {
                    // Try the next shape.
                }
            }
            return {};
        })();
    }
    return tagDictionaryPromise;
}

/**
 * Find an order already carrying this external reference.
 *
 * This is the remote half of the duplicate guard. The local half — the CRM id
 * written back onto the site order — is authoritative; this one covers the case
 * where the push succeeded but the write-back did not, which would otherwise
 * create a second CRM order on the next run.
 *
 * Returns undefined (not null) when the lookup itself could not be performed,
 * so the caller can tell "definitely absent" apart from "unable to check".
 */
export async function findKeycrmOrderBySourceUuid(sourceUuid: string): Promise<KeycrmOrder | null | undefined> {
    if (!sourceUuid) return null;

    try {
        const payload = await keycrmRequest(
            `/order?limit=5&include=buyer&filter[source_uuid]=${encodeURIComponent(sourceUuid)}`,
        );
        const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];

        // A filter KeyCRM does not understand is ignored rather than rejected,
        // which would come back as "the newest five orders" and read as a false
        // match. Only trust a row that actually carries the reference.
        const hit = rows.find(r => String(r?.source_uuid ?? '').trim() === sourceUuid);
        return hit ? normaliseOrder(hit, {}) : null;
    } catch (e: any) {
        console.error('[keycrm] source_uuid lookup failed:', e?.message);
        return undefined;
    }
}

/** Digits only, last 9 — enough to match +380671234567 against 0671234567. */
export function phoneKey(phone: string): string {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits.length >= 9 ? digits.slice(-9) : '';
}
