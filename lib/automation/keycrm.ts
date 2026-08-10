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
    status_id: number | string | null;
    status_label: string;
    grand_total: number;
    created_at: string;
    updated_at: string;
    buyer_name: string;
    buyer_email: string;
    buyer_phone: string;
    manager_comment: string;
    buyer_comment: string;
    /** Waybill number when the CRM already shipped the parcel. */
    ttn: string;
};

export type KeycrmFetchResult = {
    ok: boolean;
    orders: KeycrmOrder[];
    /** Human-readable reason the pull was skipped or cut short, for the report footer. */
    warning?: string;
};

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
            throw new Error(`KeyCRM повернув ${res.status}. ${detail.slice(0, 300)}`.trim());
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

    return {
        id: raw?.id,
        source_uuid: String(raw?.source_uuid ?? '').trim(),
        status_id: statusId,
        status_label: statusId !== null && statusLabels[String(statusId)]
            ? statusLabels[String(statusId)]
            : (statusId !== null ? `статус ${statusId}` : 'без статусу'),
        grand_total: Number.isFinite(total) ? total : 0,
        created_at: String(raw?.created_at ?? ''),
        updated_at: String(raw?.updated_at ?? raw?.created_at ?? ''),
        buyer_name: String(raw?.buyer?.full_name ?? '').trim(),
        buyer_email: (asStringList(raw?.buyer?.email)[0] || '').toLowerCase(),
        buyer_phone: asStringList(raw?.buyer?.phone)[0] || '',
        manager_comment: String(raw?.manager_comment ?? '').trim(),
        buyer_comment: String(raw?.buyer_comment ?? '').trim(),
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
            const base = `/order?page=${page}&limit=${PAGE_SIZE}&include=buyer`;
            let payload: any;
            try {
                payload = await fetchJson(`${base}&sort=-id`, token);
            } catch (e: any) {
                if (String(e?.message || '').includes('відхилив токен')) throw e;
                payload = await fetchJson(base, token);
            }

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

export type KeycrmOffer = {
    offer_id: string;
    sku: string;
    name: string;
    price: number;
    /** Purchase cost, when the account exposes one. Null when absent. */
    cost: number | null;
    /** Which API field the cost came from, so an unexpected schema is visible. */
    cost_field: string | null;
};

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
export async function fetchKeycrmOffers(maxPages = 8): Promise<KeycrmOffer[]> {
    const offers: KeycrmOffer[] = [];

    for (let page = 1; page <= maxPages; page++) {
        if (page > 1) await sleep(PAGE_GAP_MS);

        // include=product: the offer itself is often named only by its variant
        // properties ("Зелений"), and the buyer-facing name lives on the parent.
        let payload: any;
        try {
            payload = await keycrmRequest(`/offers?page=${page}&limit=${PAGE_SIZE}&include=product`);
        } catch {
            // Older accounts expose the catalogue only as products.
            payload = await keycrmRequest(`/products?page=${page}&limit=${PAGE_SIZE}`);
        }

        const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];
        if (rows.length === 0) break;

        for (const row of rows) {
            const parentName = String(row?.product?.name ?? '').trim();
            const ownName = String(row?.name ?? '').trim();
            const price = Number(row?.price ?? row?.product?.price ?? 0);
            const { cost, field } = readCost(row);

            offers.push({
                cost,
                cost_field: field,
                offer_id: String(row?.id ?? ''),
                sku: String(row?.sku ?? '').trim(),
                // Prefer the parent name and append the variant when both exist,
                // so "Фотоальбом на 200 фото" and "Зелений" become one label a
                // name match can actually work against.
                name: [parentName, ownName && ownName !== parentName ? ownName : '']
                    .filter(Boolean)
                    .join(' ')
                    .trim(),
                price: Number.isFinite(price) ? price : 0,
            });
        }

        const perPage = Number(payload?.per_page) || PAGE_SIZE;
        if (rows.length < perPage || payload?.next_page_url === null) break;
    }

    return offers;
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
