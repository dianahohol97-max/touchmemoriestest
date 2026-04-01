import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const supabase = getAdminClient();

    try {
        const { subject, body_html, body_text, target, campaign_id } = await req.json();

        if (!subject?.trim() || !body_html?.trim()) {
            return NextResponse.json({ error: 'Тема і текст листа обов\'язкові' }, { status: 400 });
        }

        // Fetch subscribers
        let query = supabase.from('subscribers').select('email, id').eq('is_active', true);
        const { data: subscribers, error: subErr } = await query;

        if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });
        if (!subscribers || subscribers.length === 0) {
            return NextResponse.json({ error: 'Немає активних підписників' }, { status: 400 });
        }

        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        const FROM_EMAIL = process.env.EMAIL_FROM || 'hello@touchmemories.ua';

        // Save campaign record first
        const { data: campaign, error: campErr } = await supabase
            .from('email_campaigns')
            .upsert({
                id: campaign_id || undefined,
                subject,
                body_html,
                body_text: body_text || subject,
                status: 'sending',
                recipients_count: subscribers.length,
                target: target || 'active',
                sent_at: new Date().toISOString(),
            })
            .select('id')
            .single();

        if (campErr) return NextResponse.json({ error: campErr.message }, { status: 500 });

        let sentCount = 0;
        let failedCount = 0;

        if (!RESEND_API_KEY) {
            // Demo mode — simulate without actually sending
            await new Promise(r => setTimeout(r, 500));
            sentCount = subscribers.length;
        } else {
            // Send via Resend API — batch in groups of 50
            const batchSize = 50;
            for (let i = 0; i < subscribers.length; i += batchSize) {
                const batch = subscribers.slice(i, i + batchSize);
                try {
                    const res = await fetch('https://api.resend.com/emails/batch', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${RESEND_API_KEY}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(batch.map(s => ({
                            from: `Touch.Memories <${FROM_EMAIL}>`,
                            to: s.email,
                            subject,
                            html: body_html,
                            text: body_text || undefined,
                        }))),
                    });

                    if (res.ok) {
                        sentCount += batch.length;
                    } else {
                        const errData = await res.json();
                        console.error('Resend batch error:', errData);
                        failedCount += batch.length;
                    }
                } catch (e) {
                    failedCount += batch.length;
                }
            }
        }

        // Update campaign status
        await supabase
            .from('email_campaigns')
            .update({
                status: failedCount === subscribers.length ? 'failed' : 'sent',
                sent_count: sentCount,
                failed_count: failedCount,
            })
            .eq('id', campaign.id);

        return NextResponse.json({
            success: true,
            campaign_id: campaign.id,
            sent: sentCount,
            failed: failedCount,
            total: subscribers.length,
            demo: !RESEND_API_KEY,
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// GET — fetch campaign history
export async function GET() {
    const supabase = getAdminClient();
    const { data } = await supabase
        .from('email_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
    return NextResponse.json({ campaigns: data || [] });
}
