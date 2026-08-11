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
