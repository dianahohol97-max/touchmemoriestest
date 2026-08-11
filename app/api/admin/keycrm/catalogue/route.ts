import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { reconcileCatalogues, saveMappings, fetchSiteProducts, sizeKey } from '@/lib/automation/keycrm-catalogue';
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
            const byId = new Map(offers.map(o => [String(o.offer_id), o]));

            for (const row of manualRows) {
                const pasted = String(row.keycrm_offer_id);
                const offer = byId.get(pasted);
                if (offer) {
                    row.keycrm_name = offer.name || row.keycrm_name;
                    row.keycrm_sku = offer.sku || null;
                    continue;
                }

                // Not an offer id — a catalogue URL (…/app/catalog/83/edit)
                // carries the PARENT product's id, and for a per-size product
                // that is the natural thing to paste. Resolve it to the
                // product's variants and link EVERY site size to its CRM
                // counterpart by the size itself (Diana, 2026-08-12: «всі
                // розміри друку на полотні… щоб синхронізувалось вірно»).
                const family = offers.filter(o => o.product_id && o.product_id === pasted);
                if (!family.length) {
                    row.confirmed = false;
                    warnings.push(`${row.site_product_name || row.site_slug}: номер ${pasted} не знайдено серед позицій KeyCRM. Пояснення збережено, звʼязку немає — перевір, що посилання веде на товар, а не на замовлення.`);
                    continue;
                }

                const siteVariants = (await fetchSiteProducts()).filter(p => p.slug === row.site_slug);
                const familyBySize = new Map(family.map(o => [sizeKey(o.variant_label || o.name), o]));

                const unmatchedSizes: string[] = [];
                for (const variant of siteVariants) {
                    // Size-to-size normally; when both sides have exactly one
                    // entry there is nothing to disambiguate, so a sizeless
                    // product pasted against a single-variant CRM item links
                    // directly.
                    const match = familyBySize.get(variant.variant || sizeKey(variant.name))
                        ?? (family.length === 1 && siteVariants.length === 1 ? family[0] : undefined);
                    if (!match) {
                        unmatchedSizes.push(variant.variantLabel || variant.variant || variant.name);
                        continue;
                    }
                    extraRows.push({
                        site_slug: variant.slug,
                        site_variant: variant.variant,
                        site_variant_label: variant.variantLabel,
                        site_product_name: variant.name,
                        keycrm_offer_id: match.offer_id,
                        keycrm_sku: match.sku || null,
                        keycrm_name: match.name,
                        match_type: 'manual',
                        match_score: null,
                        note: row.note ?? null,
                        confirmed: true,
                    });
                }

                // The pasted row itself is superseded by the per-size rows.
                row.confirmed = false;
                row.keycrm_offer_id = null;

                if (unmatchedSizes.length) {
                    warnings.push(`${row.site_product_name || row.site_slug}: у KeyCRM не знайшлося варіанта для розмірів: ${unmatchedSizes.join(', ')} — ці розміри лишилися незвʼязаними.`);
                }
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
