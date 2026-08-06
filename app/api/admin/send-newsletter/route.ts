import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';
import { drainCampaignQueue } from '@/lib/email/campaign-queue';
import { getEmailQuotaStatus } from '@/lib/email/quota';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua';

// The letter body and its unsubscribe footer are built in
// lib/email/campaign-queue.ts, because the queue drainer sends every letter —
// both the ones that fit in today's budget and the ones the cron picks up later.

export async function POST(request: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    try {
        const { subject, body_html, segment = 'all' } = await request.json();
        if (!subject?.trim()) return NextResponse.json({ error: 'Тема листа обов\'язкова' }, { status: 400 });
        if (!body_html?.trim()) return NextResponse.json({ error: 'Текст листа обов\'язковий' }, { status: 400 });
        if (!process.env.BREVO_API_KEY) {
            return NextResponse.json({ error: 'BREVO_API_KEY не налаштований. Додай його у Vercel → Settings → Environment Variables.' }, { status: 500 });
        }

        let query = supabase.from('subscribers').select('id, email, name, unsubscribe_token').eq('is_active', true);
        // Any non-'all' segment is a subscriber `source` value (the UI lists the
        // distinct sources and previews the count as source === segment). Filter
        // by it directly — otherwise unknown sources (popup, manual, …) fell
        // through and the newsletter went to EVERY active subscriber.
        if (segment && segment !== 'all') query = query.eq('source', segment);
        const { data: subscribers, error: subErr } = await query;

        if (subErr) return NextResponse.json({ error: 'Помилка завантаження підписників' }, { status: 500 });
        if (!subscribers || subscribers.length === 0)
            return NextResponse.json({ error: 'Немає активних підписників' }, { status: 400 });

        const { data: campaign, error: campErr } = await supabase
            .from('email_campaigns')
            .insert({ subject, body_html, segment, status: 'sending', recipients_count: subscribers.length })
            .select('id').single();
        if (campErr || !campaign)
            return NextResponse.json({ error: 'Помилка збереження кампанії' }, { status: 500 });

        // Queue the whole segment instead of sending it in this request. On the
        // free Brevo plan (300/day, shared with order confirmations) a 5364-name
        // send could only ever deliver a few hundred and fail the rest — while
        // starving the transactional reserve. The queue turns it into a drip.
        const QUEUE_CHUNK = 1000;
        for (let i = 0; i < subscribers.length; i += QUEUE_CHUNK) {
            const slice = subscribers.slice(i, i + QUEUE_CHUNK).map((s: any) => ({
                campaign_id: campaign.id,
                email: String(s.email).toLowerCase(),
                name: s.name || null,
            }));
            const { error: qErr } = await supabase
                .from('email_campaign_queue')
                .upsert(slice, { onConflict: 'campaign_id,email', ignoreDuplicates: true });
            if (qErr) return NextResponse.json({ error: `Не вдалося поставити в чергу: ${qErr.message}` }, { status: 500 });
        }

        // Send what today's budget allows right now; the cron picks up the rest.
        const result = await drainCampaignQueue();

        const status = await getEmailQuotaStatus();
        return NextResponse.json({
            success: true,
            queued: subscribers.length,
            sent: result.sent,
            failed: result.failed,
            remaining: result.remaining,
            total: subscribers.length,
            quota: status,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function GET() {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    const { data } = await supabase
        .from('email_campaigns')
        .select('id, subject, segment, status, sent_count, failed_count, recipients_count, created_at, sent_at')
        .order('created_at', { ascending: false }).limit(20);

    const campaigns = data || [];

    // Attach how many people left after each letter. Counting in one query over
    // the listed campaigns keeps this to a single extra round trip.
    if (campaigns.length > 0) {
        const ids = campaigns.map((c: any) => c.id);
        const { data: unsubs } = await supabase
            .from('email_unsubscribes')
            .select('campaign_id')
            .in('campaign_id', ids);

        const counts = new Map<string, number>();
        for (const row of unsubs || []) {
            const key = String((row as any).campaign_id);
            counts.set(key, (counts.get(key) || 0) + 1);
        }
        for (const c of campaigns as any[]) c.unsubscribed_count = counts.get(String(c.id)) || 0;
    }

    return NextResponse.json({ campaigns });
}
