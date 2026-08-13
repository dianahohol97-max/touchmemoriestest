import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { keycrmRequest, fetchKeycrmOrderById } from '@/lib/automation/keycrm';
import { consumeRunToken } from '@/lib/automation/run-token';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Remove the chat notes that should never have been filed.
 *
 * Diana, 2026-08-13: «тоді можеш попідчищати замовлення від тих зайвих
 * коментарів, які Софія пододавала». Two generations of noise:
 *
 *  · «❓ Відкрите питання…» — filed before the rule that only a question
 *    somebody OUTSIDE is waiting on reaches the card;
 *  · «Доручення з чату…» whose text is a plain question («13790. Який
 *    велюр?», «Що з 13795 ?») — filed before questions stopped becoming tasks.
 *
 * Both are deleted from the order history AND stripped from the KeyCRM card
 * comment, where they were pushed under the «[З чату]» marker. A manager's own
 * text in that comment is never touched: only lines carrying the marker, and
 * only those whose content matches a note being deleted.
 *
 * `?dry=1` reports what it would do. One-time token, same as the diagnostics.
 */

const MARKER = '[З чату]';
const INSTRUCTION_WORDS = /(треба|потрібно|обовʼязково|обов'язково|терміново|зроб|переробити|відправ|надішл|додай|постав|помін|заміни|виправ|уточни|перевір|звʼяж|зателефон|напиши|не забуд|швидше|прискор|скасу|притрима)/i;

function isNoise(notes: string): boolean {
    const text = String(notes || '');
    if (/Відкрите питання/i.test(text)) return true;
    // A «Доручення з чату» whose quoted message is a question and carries no
    // instruction — curiosity, not work.
    return text.includes('Доручення з чату') && text.includes('?') && !INSTRUCTION_WORDS.test(text);
}

/** The quoted chat message inside a note, which is what the CRM line carries. */
function quotedText(notes: string): string {
    const m = String(notes || '').match(/«([^»]{4,})»/);
    return m ? m[1].trim() : '';
}

export async function GET(req: Request) {
    if (!(await consumeRunToken(req, 'cleanup_chat_notes_token'))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const dry = new URL(req.url).searchParams.get('dry') === '1';
    const supabase = getAdminClient();

    // Two sources: notes still in the history, and the ones already removed
    // from the site (kept in order_history_removed_chat_notes as the backup of
    // that clean-up). The CRM card still carries both, and the removed ones
    // are exactly the list of what has to disappear from it.
    const [{ data: live }, { data: removed }] = await Promise.all([
        supabase.from('order_history').select('id, order_id, notes').eq('action', 'work_chat_note').limit(500),
        supabase.from('order_history_removed_chat_notes').select('id, order_id, notes').limit(500),
    ]);

    const noise = [
        ...(live || []).filter(r => isNoise(String(r.notes || ''))).map(r => ({ ...r, live: true })),
        ...(removed || []).map(r => ({ ...r, live: false })),
    ];
    if (!noise.length) return NextResponse.json({ ok: true, removed: 0, crmCleaned: 0 });

    const orderIds = [...new Set(noise.map(r => r.order_id).filter(Boolean))];
    const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, custom_attributes')
        .in('id', orderIds);

    const byOrder = new Map((orders || []).map((o: any) => [o.id, o]));
    const report: any[] = [];
    let crmCleaned = 0;

    for (const orderId of orderIds) {
        const order: any = byOrder.get(orderId);
        const crmId = order?.custom_attributes?.keycrm?.order_id;
        if (!crmId) continue;

        const quotes = noise
            .filter(r => r.order_id === orderId)
            .map(r => quotedText(String(r.notes || '')))
            .filter(Boolean);

        try {
            const crm = await fetchKeycrmOrderById(crmId);
            const current = String(crm?.manager_comment || '');
            if (!current) continue;

            const kept = current.split('\n').filter(line => {
                if (!line.trimStart().startsWith(MARKER)) return true;      // a person's own text
                if (/Відкрите питання/i.test(line)) return false;
                return !quotes.some(q => q && line.includes(q.slice(0, 40)));
            });

            const cleaned = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
            if (cleaned === current.trim()) continue;

            report.push({ order: order.order_number, crmId, before: current.length, after: cleaned.length });
            if (!dry) {
                await keycrmRequest(`/order/${encodeURIComponent(String(crmId))}`, {
                    method: 'PUT',
                    body: { manager_comment: cleaned },
                });
            }
            crmCleaned++;
        } catch (e: any) {
            report.push({ order: order?.order_number, error: String(e?.message || e).slice(0, 120) });
        }
    }

    // Only rows still in the history are deleted; the backup stays untouched.
    const liveIds = noise.filter(r => r.live).map(r => r.id);
    if (!dry && liveIds.length) {
        await supabase.from('order_history').delete().in('id', liveIds);
    }

    return NextResponse.json({
        ok: true,
        dry,
        removed: liveIds.length,
        crmCandidates: noise.length,
        crmCleaned,
        sample: noise.slice(0, 10).map(r => String(r.notes || '').slice(0, 90)),
        report: report.slice(0, 30),
    });
}
