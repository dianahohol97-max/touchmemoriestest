import { NextResponse } from 'next/server';
import { keycrmRequest } from '@/lib/automation/keycrm';
import { consumeRunToken } from '@/lib/automation/run-token';

export const dynamic = 'force-dynamic';

/**
 * What a KeyCRM order actually looks like on THIS account.
 *
 * The reason this exists: the CRM order list has two different people columns —
 * «Менеджер» (Вероніка) and «Відповідальні» (Юля, Тамара) — and Diana pointed
 * out that Софія confuses them. Only the manager is mirrored, because only the
 * manager was known to be in the payload. Which key carries the responsible
 * people is not documented anywhere we control, so it has to be read from a
 * live order once.
 *
 * Values are NOT dumped wholesale: the response is the SHAPE (keys, and the
 * people-ish fields), so a customer's data does not travel through a debug
 * endpoint. Access is a one-time token issued from the database.
 */
export async function GET(req: Request) {
    if (!(await consumeRunToken(req, 'keycrm_debug_run_token'))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const out: any = {};

    // «Відповідальні» — the CRM list has this column filled (Юля Валах, Тамара
    // Коблик) while the order payload with include=manager,custom_fields shows
    // nothing of the sort, so the assignment must hang off another endpoint or
    // include. Every plausible spelling is probed once; the answer decides
    // where Софія reads «хто відповідальний» from.
    out.responsible_probe = {};
    for (const path of [
        `/order/${encodeURIComponent(id)}?include=responsible`,
        `/order/${encodeURIComponent(id)}?include=responsibles`,
        `/order/${encodeURIComponent(id)}?include=performers`,
        `/order/${encodeURIComponent(id)}?include=users`,
        `/order/${encodeURIComponent(id)}?include=custom_fields,manager,responsible,performers`,
        `/order/${encodeURIComponent(id)}/responsible`,
        `/order/${encodeURIComponent(id)}/responsibles`,
        `/order/${encodeURIComponent(id)}/performers`,
        `/order/${encodeURIComponent(id)}/custom-fields`,
        `/custom-fields?entity=order&limit=50`,
        `/order/custom-fields?limit=50`,
    ]) {
        try {
            const payload = await keycrmRequest(path);
            const keys = payload && typeof payload === 'object' ? Object.keys(payload) : [];
            const interesting = Object.fromEntries(
                Object.entries(payload || {}).filter(([k]) => /responsib|performer|executor|assign|custom|user|data/i.test(k)),
            );
            out.responsible_probe[path] = { keys: keys.slice(0, 40), interesting };
        } catch (e: any) {
            // The 400 body lists every include this account allows — that list
            // is the whole point of the probe, so it is not truncated short.
            out.responsible_probe[path] = { error: String(e?.message || e).slice(0, 900) };
        }
    }

    // The CRM's tag dictionary, so the site's tag list can be made identical
    // (Diana: «створи в адмінці на сайті ідентичні теги до тих що в срм»).
    // Only what orders happen to carry is visible from the mirror; the full
    // list lives behind whichever of these spellings this account answers.
    for (const path of ['/order/tags?limit=100', '/tags?limit=100', '/order/tag?limit=100', '/settings/tags?limit=100']) {
        try {
            const payload = await keycrmRequest(path);
            const rows: any[] = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
            if (rows.length) {
                out.tag_dictionary = { path, names: rows.map((t: any) => t?.name ?? t?.title ?? t).slice(0, 100) };
                break;
            }
        } catch (e: any) {
            out.tag_dictionary = { lastError: `${path}: ${String(e?.message || e)}` };
        }
    }
    for (const include of [
        'buyer,products,payments,shipping,tags,manager,custom_fields',
        'manager,custom_fields',
        '',
    ]) {
        try {
            const payload = await keycrmRequest(`/order/${encodeURIComponent(id)}${include ? `?include=${include}` : ''}`);
            out[include || 'bare'] = {
                keys: Object.keys(payload || {}),
                manager: payload?.manager ?? null,
                // Anything that smells like an assignment: the key names differ
                // between KeyCRM versions, so report every plausible spelling.
                people: Object.fromEntries(
                    Object.entries(payload || {}).filter(([k]) => /manager|responsib|performer|executor|assign|user|staff|worker/i.test(k)),
                ),
                custom_fields: (Array.isArray(payload?.custom_fields) ? payload.custom_fields : [])
                    .map((f: any) => ({
                        name: f?.name ?? f?.uuid ?? null,
                        type: f?.type ?? null,
                        value: f?.value ?? null,
                    })),
                tags: payload?.tags ?? null,
            };
            break;
        } catch (e: any) {
            out[include || 'bare'] = { error: String(e?.message || e) };
        }
    }

    return NextResponse.json(out);
}
