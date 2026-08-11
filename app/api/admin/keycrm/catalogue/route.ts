import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { reconcileCatalogues, saveMappings, fetchSiteProducts, linkPastedId } from '@/lib/automation/keycrm-catalogue';
import { fetchKeycrmOffers } from '@/lib/automation/keycrm';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Reconcile the website catalogue against KeyCRM's.
 *
 * GET  — returns every website product with its proposed CRM counterpart, the
 *        score behind the proposal, the runners-up it beat, and the CRM offers
 *        nothing pointed at. Read-only: it proposes, it never decides.
 *
 * POST — stores decisions: `{ rows: [{ site_slug, keycrm_offer_id, keycrm_sku,
 *        keycrm_name, confirmed: true }] }`. Only confirmed rows are used when
 *        an order is pushed, so nothing is attached to a CRM product until a
 *        person has agreed it is the same thing.
 */

export async function GET() {
    // Any active staff member, not admin-only: Diana handed the reconciliation
    // to the project manager (Аліна), and matching names is exactly the kind of
    // judgement a person who handles orders daily is best placed to make.
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    if (!process.env.KEYCRM_API_TOKEN) {
        return NextResponse.json({ error: 'KEYCRM_API_TOKEN не заданий.' }, { status: 400 });
    }

    try {
        const report = await reconcileCatalogues();
        return NextResponse.json(report);
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Звірка не вдалася' }, { status: 502 });
    }
}

export async function POST(request: Request) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const rows = Array.isArray(body?.rows) ? body.rows : [];
    const clean = rows.filter((r: any) => typeof r?.site_slug === 'string' && r.site_slug.trim());

    if (!clean.length) {
        return NextResponse.json({ error: 'Немає рядків для збереження.' }, { status: 400 });
    }

    // A hand-pasted number is validated against the CRM's real catalogue before
    // it becomes a confirmed link. A KeyCRM product URL can end in an id that is
    // NOT the offer id the stock and cost lookups use, and a confirmed pair
    // pointing at the wrong kind of id would silently attach order lines to the
    // wrong item. A number the catalogue does not recognise is kept as an
    // explanation only, with a warning back to the person who typed it.
    const warnings: string[] = [];
    // Rows added on top of what the screen sent — the pasted-PRODUCT-URL flow
    // below links every size of a product at once.
    const extraRows: any[] = [];
    const manualRows = clean.filter((r: any) => r.match_type === 'manual' && r.keycrm_offer_id && r.confirmed);
    if (manualRows.length) {
        try {
            const offers = await fetchKeycrmOffers();
            const siteProducts = await fetchSiteProducts();

            for (const row of manualRows) {
                // A pasted number may be a variant (offer) id or, from a
                // catalogue URL like …/app/catalog/83/edit, the PARENT
                // product's id — in which case every size of the site product
                // links to its CRM counterpart at once (Diana, 2026-08-12:
                // «всі розміри друку на полотні… щоб синхронізувалось вірно»).
                const { rows: linked, warnings: linkWarnings } = linkPastedId({
                    pasted: String(row.keycrm_offer_id),
                    siteSlug: row.site_slug,
                    note: row.note ?? null,
                    offers,
                    siteProducts,
                });

                warnings.push(...linkWarnings);
                extraRows.push(...linked);

                // The pasted row itself is superseded by the resolved rows; a
                // number that resolved to nothing keeps its explanation but no
                // link.
                row.confirmed = false;
                if (!linked.length) row.keycrm_offer_id = null;
            }
        } catch (e: any) {
            return NextResponse.json({ error: `Не вдалося перевірити номер у KeyCRM: ${e?.message || 'запит не вдався'}` }, { status: 502 });
        }
    }

    // A per-size row built from the pasted product URL supersedes whatever the
    // screen sent for the same product+size — two rows with one key in a single
    // upsert would fail.
    const superseded = new Set(extraRows.map(r => `${r.site_slug}::${r.site_variant || ''}`));
    const finalRows = [
        ...clean.filter((r: any) => !superseded.has(`${r.site_slug}::${r.site_variant || ''}`)),
        ...extraRows,
    ];

    try {
        const result = await saveMappings(finalRows);
        return NextResponse.json({
            ok: true,
            ...result,
            linked_variants: extraRows.length,
            warnings,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Не вдалося зберегти відповідності' }, { status: 500 });
    }
}
