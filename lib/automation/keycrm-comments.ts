import { getAdminClient } from '@/lib/supabase/admin';
import { keycrmRequest, fetchKeycrmOrderById, getKeycrmToken } from '@/lib/automation/keycrm';

/**
 * Chat instructions travel INTO the KeyCRM card comment (Diana, 2026-08-11:
 * «додай це в коментарі до замовлення що в срм що на сайт»).
 *
 * Why this is the right channel and not a site-only note: mirrored orders are
 * refreshed from the CRM every hour, and the CRM manager comment is what the
 * deadline resolver reads. Once «обов'язково 12.08 відправити» sits in the
 * CRM comment, the deadline holds by itself on every future refresh, the CRM
 * managers see the instruction where they work, and the site's notes get it
 * back automatically with the next mirror pass. One write, both systems.
 *
 * Mechanics: work_chat_note rows on mirrored orders are appended to the CRM
 * manager_comment under a «[З чату]» marker, each exactly once — the history
 * row is stamped (details.crm_comment_pushed) and the comment is checked for
 * the text before writing, so re-runs and races cannot duplicate it. Only the
 * comment is touched; the CRM's own data stays its own.
 */

const MARKER = '[З чату]';
const COMMENT_LIMIT = 4000;

function syncEnabled(): boolean {
    return String(process.env.KEYCRM_SYNC_ENABLED || '').trim().toLowerCase() === 'true';
}

export async function pushInstructionCommentsToCrm(): Promise<{ pushed: number; problems: string[] }> {
    const result = { pushed: 0, problems: [] as string[] };
    if (!getKeycrmToken() || !syncEnabled()) return result;

    const supabase = getAdminClient();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabase
        .from('order_history')
        .select('id, order_id, notes, details, created_at')
        .eq('action', 'work_chat_note')
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(100);

    if (error) {
        result.problems.push(`Читання доручень не вдалося: ${error.message}`);
        return result;
    }

    const pending = (rows || []).filter(r => !(r.details as any)?.crm_comment_pushed);
    if (!pending.length) return result;

    const orderIds = [...new Set(pending.map(r => r.order_id).filter(Boolean))];
    const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, source, custom_attributes')
        .in('id', orderIds);

    const orderById = new Map((orders || []).map((o: any) => [o.id, o]));

    for (const row of pending) {
        const order = orderById.get(row.order_id);
        const crmId = (order?.custom_attributes as any)?.keycrm?.order_id;

        // Site-only orders (no CRM counterpart yet) just wait — the stamp is
        // not set, so they are retried once the order reaches the CRM.
        if (!order || !crmId) continue;

        const text = String(row.notes || '').trim();
        if (!text) {
            await stampPushed(supabase, row);
            continue;
        }

        try {
            const crm = await fetchKeycrmOrderById(crmId);
            if (!crm) {
                result.problems.push(`${order.order_number}: картку ${crmId} не знайдено в KeyCRM.`);
                continue;
            }

            const current = String(crm.manager_comment || '');

            // Already there — from a previous run that failed before stamping,
            // or typed by a manager. Either way, writing again would duplicate.
            if (current.includes(text)) {
                await stampPushed(supabase, row);
                continue;
            }

            // Only the LATEST chat instruction lives on the card (Diana,
            // 2026-08-11, after six test questions piled up on 13790:
            // «забагато, залишай тільки останній коментар»). Every earlier
            // «[З чату]» line is stripped; whatever a human typed themselves
            // stays untouched above it. The full thread remains in
            // order_history and the важливо tab — the CRM comment is a
            // pointer, not the archive.
            const humanPart = current
                .split('\n')
                .filter(line => !line.trimStart().startsWith(MARKER))
                .join('\n')
                .trim();

            const appended = `${humanPart}\n${MARKER} ${text}`.trim().slice(0, COMMENT_LIMIT);
            await keycrmRequest(`/order/${encodeURIComponent(String(crmId))}`, {
                method: 'PUT',
                body: { manager_comment: appended },
            });

            await stampPushed(supabase, row);
            result.pushed++;
        } catch (e: any) {
            result.problems.push(`${order.order_number}: ${e?.message || 'запит до KeyCRM не вдався'}`);
        }
    }

    return result;
}

async function stampPushed(supabase: any, row: any): Promise<void> {
    const details = (row.details && typeof row.details === 'object') ? row.details : {};
    await supabase
        .from('order_history')
        .update({ details: { ...details, crm_comment_pushed: new Date().toISOString() } })
        .eq('id', row.id);
}
