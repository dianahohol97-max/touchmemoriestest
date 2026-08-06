import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Server-side pull of customers straight out of KeyCRM, so the CRM import no
 * longer needs a hand-exported CSV.
 *
 * Why a server route and not a browser fetch: the KeyCRM token must never
 * reach client-side code of a public site, and openapi.keycrm.app sends no
 * CORS headers, so a direct fetch from the admin page would be blocked anyway.
 *
 * Paging protocol: KeyCRM caps `limit` at 50, so a shop with a few thousand
 * buyers needs dozens of requests — far more than one serverless invocation
 * should hold open. Each call therefore walks at most `maxPages` pages and
 * returns `nextPage`; the caller loops until `nextPage` comes back null. This
 * keeps every invocation well inside the function timeout regardless of how
 * big the CRM is.
 *
 * The route only READS from KeyCRM and returns normalised rows. Writing to the
 * database stays in /api/admin/crm-import, which already dedups via the
 * crm_import_upsert() SQL function.
 */

const API_BASE = 'https://openapi.keycrm.app/v1';
const PAGE_SIZE = 50;         // KeyCRM hard-caps `limit` at 50
const DEFAULT_MAX_PAGES = 10; // 500 records per HTTP call
const HARD_MAX_PAGES = 30;
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);

type Resource = 'buyer' | 'order';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * KeyCRM returns `email` and `phone` as arrays of strings, but individual
 * accounts (and older records imported from marketplaces) sometimes carry a
 * bare string or an object wrapper. Normalise all three shapes.
 */
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

function isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function fetchPage(resource: Resource, token: string, page: number): Promise<any> {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    // Orders carry the buyer only as an association — without it there is no
    // email to attach the order date to.
    if (resource === 'order') params.set('include', 'buyer');

    let lastError = '';
    for (let attempt = 0; attempt < 3; attempt++) {
        let res: Response;
        try {
            res = await fetch(`${API_BASE}/${resource}?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
                cache: 'no-store',
            });
        } catch (e: any) {
            lastError = e?.message || 'network error';
            await sleep(500 * (attempt + 1));
            continue;
        }

        if (res.ok) return res.json();

        if (res.status === 401 || res.status === 403) {
            throw new Error('KeyCRM відхилив токен (401/403). Перевір ключ у налаштуваннях KeyCRM.');
        }
        if (!RETRY_STATUSES.has(res.status)) {
            const body = await res.text().catch(() => '');
            throw new Error(`KeyCRM повернув ${res.status}. ${body.slice(0, 200)}`);
        }
        // 429 = rate limit; back off progressively before retrying.
        lastError = `HTTP ${res.status}`;
        await sleep(1000 * (attempt + 1));
    }
    throw new Error(`KeyCRM недоступний після 3 спроб (${lastError}).`);
}

/** One row per email — a buyer with two addresses becomes two contacts. */
function rowsFromBuyer(buyer: any): any[] {
    const emails = asStringList(buyer?.email).filter(isEmail);
    if (emails.length === 0) return [];
    const phone = asStringList(buyer?.phone)[0] || '';
    const name = String(buyer?.full_name || '').trim();
    return emails.map(email => ({ email: email.toLowerCase(), name, phone, buyer_id: buyer?.id ?? null }));
}

function rowsFromOrder(order: any): any[] {
    const emails = asStringList(order?.buyer?.email).filter(isEmail);
    if (emails.length === 0) return [];
    const total = Number(order?.grand_total ?? order?.total_price ?? 0);
    return emails.map(email => ({
        email: email.toLowerCase(),
        name: String(order?.buyer?.full_name || '').trim(),
        created_at: order?.created_at || '',
        grand_total: Number.isFinite(total) ? total : 0,
    }));
}

export async function POST(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Prefer the server-side env var; the pasted token is the fallback so the
    // import works before KEYCRM_API_TOKEN is configured on Vercel.
    const token = String(process.env.KEYCRM_API_TOKEN || body?.token || '').trim();
    if (!token) {
        return NextResponse.json(
            { error: 'Немає токена KeyCRM. Встав ключ у поле або задай KEYCRM_API_TOKEN у Vercel.' },
            { status: 400 },
        );
    }

    const resource: Resource = body?.resource === 'order' ? 'order' : 'buyer';
    const startPage = Math.max(1, Number(body?.page) || 1);
    const maxPages = Math.min(HARD_MAX_PAGES, Math.max(1, Number(body?.maxPages) || DEFAULT_MAX_PAGES));

    const rows: any[] = [];
    let page = startPage;
    let total = 0;
    let pagesFetched = 0;
    let nextPage: number | null = null;
    let sample: any = null;

    try {
        while (pagesFetched < maxPages) {
            const payload = await fetchPage(resource, token, page);
            const data: any[] = Array.isArray(payload?.data) ? payload.data : [];
            if (body?.debug && !sample && data.length > 0) sample = data[0];

            total = Number(payload?.total) || total;
            for (const item of data) {
                rows.push(...(resource === 'buyer' ? rowsFromBuyer(item) : rowsFromOrder(item)));
            }
            pagesFetched++;

            // Stop on a short page, on an explicit "no next page", or once the
            // reported total is covered — whichever the account's API reports.
            const perPage = Number(payload?.per_page) || PAGE_SIZE;
            const exhausted =
                data.length === 0 ||
                data.length < perPage ||
                (payload?.next_page_url === null) ||
                (total > 0 && page * perPage >= total);
            if (exhausted) { nextPage = null; break; }

            page++;
            nextPage = page;
        }
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'KeyCRM request failed' }, { status: 502 });
    }

    return NextResponse.json({
        resource,
        rows,
        fetched: rows.length,
        total,
        pagesFetched,
        nextPage,
        ...(sample ? { sample } : {}),
    });
}
