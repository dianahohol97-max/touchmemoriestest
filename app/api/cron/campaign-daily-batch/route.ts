import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { drainCampaignQueue } from '@/lib/email/campaign-queue';
import { sendBrevoEmail } from '@/lib/email/brevo';
import { consumeRunToken, isCronRequest } from '@/lib/automation/run-token';
import { buildLaunchEmail, launchEmailSubject } from '@/lib/email/campaign-launch';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * The daily batch of the CRM-base mailing — armed one day at a time.
 *
 * Diana picks the hour and the day; neither is baked in. The first batch went
 * at 16:45, the second was moved to 16:00 («налаштуй розсилку завтра на 4
 * вечора»), and «тільки завтра, далі вирішимо» rules out a plain daily cron —
 * one left running unattended would keep mailing customers on days nobody
 * asked for.
 *
 * So the cron fires every day at the configured hour and does NOTHING unless the date it
 * wakes up on is the date armed in settings('campaign_send_date'). Sending
 * disarms it. Continuing the campaign is then one deliberate act — write
 * tomorrow's date into that row — rather than something that happens because a
 * schedule was never turned off.
 *
 * BATCH_SIZE is Diana's fifty. It is a ceiling on this run, not a target: the
 * shared marketing budget still applies, and order confirmations always come
 * first.
 */

const BATCH_SIZE = 50;
const ARMED_KEY = 'campaign_send_date';
const REPORT_TO = 'gogolka16@gmail.com';

/** Today's date in Kyiv, as YYYY-MM-DD. */
function kyivDate(): string {
    return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function GET(request: Request) {
    const viaToken = await consumeRunToken(request, 'campaign_batch_token');
    if (!viaToken && !isCronRequest(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getAdminClient();
    const today = kyivDate();

    const { data: armedRow } = await admin
        .from('settings').select('value').eq('key', ARMED_KEY).maybeSingle();
    const armedFor = typeof armedRow?.value === 'string'
        ? armedRow.value
        : (armedRow?.value as any)?.date;

    // A token run is a deliberate «send it now» and skips the date gate; the
    // scheduled run never does.
    if (!viaToken && armedFor !== today) {
        return NextResponse.json({
            ok: true,
            skipped: true,
            reason: armedFor
                ? `Розсилку заряджено на ${armedFor}, сьогодні ${today} — нічого не надсилаю.`
                : 'Розсилку не заряджено на жоден день — нічого не надсилаю.',
        });
    }

    // Rows wait as 'scheduled', not 'pending', and that is what keeps them from
    // leaving early. The general queue drain at 19:00 Kyiv takes everything
    // marked pending, so a batch prepared the evening before would have gone
    // out that same night at the wrong hour. Releasing exactly BATCH_SIZE rows
    // here is what makes the send time mean something.
    const { data: waiting } = await admin
        .from('email_campaign_queue')
        .select('id, campaign_id')
        .eq('status', 'scheduled')
        .order('created_at', { ascending: true })
        .limit(BATCH_SIZE);

    const releaseIds = (waiting || []).map(r => r.id);
    if (releaseIds.length) {
        await admin.from('email_campaign_queue').update({ status: 'pending' }).in('id', releaseIds);
    }

    // The letter must carry TODAY's code. The body is rebuilt from the shared
    // template right before sending rather than typed in when the batch was
    // prepared — a batch queued yesterday would otherwise ship yesterday's code,
    // and the customer would tap a promo that expired a day early.
    const campaignIds = Array.from(new Set((waiting || []).map(r => r.campaign_id).filter(Boolean)));
    if (campaignIds.length) {
        const { data: liveCode } = await admin
            .from('promo_codes')
            .select('code')
            .like('code', 'SITE%')
            .eq('is_active', true)
            .gt('valid_until', new Date().toISOString())
            .order('valid_from', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (liveCode?.code) {
            await admin
                .from('email_campaigns')
                .update({ body_html: buildLaunchEmail({ code: liveCode.code }), subject: launchEmailSubject() })
                .in('id', campaignIds);
        } else {
            console.error('[campaign-daily-batch] no live SITE code — sending with the stored body');
        }
    }

    const result = await drainCampaignQueue(BATCH_SIZE);

    // Everything still waiting for a future batch — the honest "how much base
    // is left" number, which `remaining` alone does not give since it counts
    // only rows already released into the queue.
    const { count: scheduledLeft } = await admin
        .from('email_campaign_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'scheduled');

    // Disarm: one batch means one batch. The next one has to be asked for.
    await admin.from('settings').delete().eq('key', ARMED_KEY);

    const text = [
        `Партію розіслано: ${result.sent} листів.`,
        result.failed ? `Не пройшло: ${result.failed}.` : '',
        `У черзі лишилося: ${result.remaining}.`,
        `Заготовлено на наступні партії: ${scheduledLeft}.`,
        '',
        'Наступної партії не буде, доки ви не скажете — розсилка знову роззброєна.',
    ].filter(Boolean).join('\n');

    try {
        await sendBrevoEmail({
            to: REPORT_TO,
            subject: `Розсилка: надіслано ${result.sent}, лишилося ${result.remaining}`,
            html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#1f2937">
                     ${text.split('\n').map(l => `<p style="margin:0 0 10px">${l}</p>`).join('')}
                   </div>`,
            kind: 'marketing',
        });
    } catch (e) {
        console.error('[campaign-daily-batch] report email failed:', e);
    }

    return NextResponse.json({ ok: true, armedFor, ...result });
}
