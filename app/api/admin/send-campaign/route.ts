import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

async function sendBrevoEmail(to: string, subject: string, htmlContent: string, fromName: string, fromEmail: string) {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) throw new Error('BREVO_API_KEY не налаштований');

    const res = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sender: { name: fromName, email: fromEmail },
            to: [{ email: to }],
            subject,
            htmlContent,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || `Brevo error ${res.status}`);
    }
    return true;
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await req.json();
        const { campaign_id } = body;

        if (!campaign_id) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 });

        const { data: campaign, error: campErr } = await supabase
            .from('email_campaigns')
            .select('*')
            .eq('id', campaign_id)
            .single();

        if (campErr || !campaign) return NextResponse.json({ error: 'Кампанію не знайдено' }, { status: 404 });
        if (campaign.status === 'sent') return NextResponse.json({ error: 'Кампанія вже надіслана' }, { status: 400 });

        let query = supabase.from('subscribers').select('id, email');
        if (campaign.segment === 'active') query = query.eq('is_active', true);
        else if (campaign.segment === 'inactive') query = query.eq('is_active', false);
        else if (campaign.segment === 'source_popup') (query as any) = (query as any).eq('is_active', true).eq('source', 'popup');
        else if (campaign.segment === 'source_checkout') (query as any) = (query as any).eq('is_active', true).eq('source', 'checkout');
        else if (campaign.segment === 'source_manual') (query as any) = (query as any).eq('is_active', true).eq('source', 'manual');
        else query = query.eq('is_active', true); // 'all' — active only

        const { data: subscribers, error: subErr } = await query;
        if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });
        if (!subscribers || subscribers.length === 0) {
            return NextResponse.json({ error: 'Немає підписників для цього сегменту' }, { status: 400 });
        }

        await supabase.from('email_campaigns').update({
            status: 'sending',
            total_recipients: subscribers.length,
            updated_at: new Date().toISOString(),
        }).eq('id', campaign_id);

        await supabase.from('email_campaign_logs').insert(
            subscribers.map((s: any) => ({ campaign_id, subscriber_id: s.id, email: s.email, status: 'pending' }))
        );

        let sentCount = 0, failedCount = 0;

        for (const subscriber of subscribers as any[]) {
            try {
                const html = campaign.body_html
                    .replace(/\{\{email\}\}/g, subscriber.email)
                    .replace(/\{\{unsubscribe_url\}\}/g, `https://touchmemories1.vercel.app/unsubscribe?email=${encodeURIComponent(subscriber.email)}`);

                await sendBrevoEmail(subscriber.email, campaign.subject, html, campaign.from_name, campaign.from_email);
                await supabase.from('email_campaign_logs')
                    .update({ status: 'sent', sent_at: new Date().toISOString() })
                    .eq('campaign_id', campaign_id).eq('email', subscriber.email);
                sentCount++;
            } catch (err: any) {
                await supabase.from('email_campaign_logs')
                    .update({ status: 'failed', error_message: err.message })
                    .eq('campaign_id', campaign_id).eq('email', subscriber.email);
                failedCount++;
            }
            await new Promise(r => setTimeout(r, 80));
        }

        await supabase.from('email_campaigns').update({
            status: failedCount === subscribers.length ? 'failed' : 'sent',
            sent_count: sentCount,
            failed_count: failedCount,
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }).eq('id', campaign_id);

        return NextResponse.json({ success: true, sent: sentCount, failed: failedCount, total: subscribers.length });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
