import { getAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail } from '@/lib/email/brevo';
import { reserveEmailQuota } from '@/lib/email/quota';
import { buildUnsubscribeUrl } from '@/lib/email/unsubscribe';

/**
 * Drains queued newsletter recipients within today's marketing budget.
 *
 * The manual newsletter used to send to the whole segment in one request. With
 * a 5364-address base and a 300/day cap that could only ever end one way: a few
 * hundred delivered, thousands failed, and the transactional quota spent on
 * marketing so customers stopped receiving order confirmations. Queueing turns
 * the same send into a drip that finishes over as many days as it needs.
 */

const SEND_GAP_MS = 350; // ~3 req/s, Brevo's per-second limit
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function buildHtml(bodyHtml: string, email: string, token: string | null, campaignId: string) {
    const url = buildUnsubscribeUrl({ email, token, campaignId });
    return `${bodyHtml}
<div style="margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;font-family:sans-serif;">
  Touch.Memories &nbsp;·&nbsp;
  <a href="${url}" style="color:#9ca3af;text-decoration:underline;">Відписатися від розсилки</a>
</div>`;
}

export interface DrainResult {
    sent: number;
    failed: number;
    remaining: number;
    granted: number;
    campaignsTouched: number;
}

/**
 * @param maxToSend optional ceiling on top of the budget (a per-run pace limit).
 */
export async function drainCampaignQueue(maxToSend?: number): Promise<DrainResult> {
    const supabase = getAdminClient();

    const { count: pendingBefore } = await supabase
        .from('email_campaign_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

    if (!pendingBefore) {
        return { sent: 0, failed: 0, remaining: 0, granted: 0, campaignsTouched: 0 };
    }

    const want = Math.min(pendingBefore, maxToSend && maxToSend > 0 ? maxToSend : pendingBefore);
    const granted = await reserveEmailQuota(want, 'marketing');
    if (granted <= 0) {
        return { sent: 0, failed: 0, remaining: pendingBefore, granted: 0, campaignsTouched: 0 };
    }

    // Oldest first, so a campaign queued yesterday finishes before a newer one
    // starts competing for the same budget.
    const { data: rows } = await supabase
        .from('email_campaign_queue')
        .select('id, campaign_id, email, name, attempts')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(granted);

    const items = rows || [];
    if (items.length === 0) {
        return { sent: 0, failed: 0, remaining: pendingBefore, granted, campaignsTouched: 0 };
    }

    // Campaign bodies and subscriber tokens, fetched once per batch.
    const campaignIds = Array.from(new Set(items.map((r: any) => r.campaign_id).filter(Boolean)));
    const { data: campaigns } = await supabase
        .from('email_campaigns')
        .select('id, subject, body_html')
        .in('id', campaignIds);
    const campaignById = new Map((campaigns || []).map((c: any) => [String(c.id), c]));

    const emails = items.map((r: any) => String(r.email).toLowerCase());
    const { data: subs } = await supabase
        .from('subscribers')
        .select('email, unsubscribe_token')
        .in('email', emails);
    const tokenByEmail = new Map<string, string>();
    for (const s of subs || []) {
        const t = (s as any).unsubscribe_token;
        if (t) tokenByEmail.set(String((s as any).email).toLowerCase(), t);
    }

    let sent = 0;
    let failed = 0;

    for (const row of items as any[]) {
        const campaign = campaignById.get(String(row.campaign_id));
        if (!campaign) {
            await supabase.from('email_campaign_queue')
                .update({ status: 'failed', error: 'Кампанію видалено' })
                .eq('id', row.id);
            failed++;
            continue;
        }

        try {
            await sendBrevoEmail({
                to: row.email,
                toName: row.name || undefined,
                subject: campaign.subject,
                html: buildHtml(campaign.body_html, row.email, tokenByEmail.get(String(row.email).toLowerCase()) || null, String(row.campaign_id)),
                kind: 'marketing',
                // The whole batch was reserved above; reserving again per letter
                // would charge the budget twice.
                quotaReserved: true,
            });
            await supabase.from('email_campaign_queue')
                .update({ status: 'sent', sent_at: new Date().toISOString(), attempts: (row.attempts || 0) + 1 })
                .eq('id', row.id);
            sent++;
        } catch (e: any) {
            const attempts = (row.attempts || 0) + 1;
            // Three tries, then leave it alone rather than retry forever — a
            // permanently bad address would otherwise consume budget daily.
            await supabase.from('email_campaign_queue')
                .update({
                    status: attempts >= 3 ? 'failed' : 'pending',
                    attempts,
                    error: String(e?.message || e).slice(0, 300),
                })
                .eq('id', row.id);
            failed++;
        }
        await sleep(SEND_GAP_MS);
    }

    // Close out campaigns whose queue is now empty, and refresh their counters.
    for (const id of campaignIds) {
        const { count: left } = await supabase
            .from('email_campaign_queue')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', id)
            .eq('status', 'pending');
        const { count: sentTotal } = await supabase
            .from('email_campaign_queue')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', id)
            .eq('status', 'sent');
        const { count: failedTotal } = await supabase
            .from('email_campaign_queue')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', id)
            .eq('status', 'failed');

        await supabase.from('email_campaigns').update({
            status: left ? 'sending' : 'sent',
            sent_count: sentTotal || 0,
            failed_count: failedTotal || 0,
            ...(left ? {} : { sent_at: new Date().toISOString() }),
        }).eq('id', id);
    }

    const { count: remaining } = await supabase
        .from('email_campaign_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

    return { sent, failed, remaining: remaining || 0, granted, campaignsTouched: campaignIds.length };
}
