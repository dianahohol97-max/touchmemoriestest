import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getResendClient } from '@/lib/email/resend';

export const dynamic = 'force-dynamic';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function POST(request: Request) {
    const supabase = getAdminClient();
    const resend = getResendClient();

    try {
        const { subject, body_html, body_text, segment = 'all' } = await request.json();

        if (!subject?.trim()) return NextResponse.json({ error: 'Тема листа обов\'язкова' }, { status: 400 });
        if (!body_html?.trim()) return NextResponse.json({ error: 'Текст листа обов\'язковий' }, { status: 400 });

        // 1. Fetch recipients
        let query = supabase.from('subscribers').select('id, email').eq('is_active', true);
        if (segment !== 'all') query = query.eq('source', segment);
        const { data: subscribers, error: subErr } = await query;

        if (subErr) return NextResponse.json({ error: 'Помилка завантаження підписників' }, { status: 500 });
        if (!subscribers || subscribers.length === 0) {
            return NextResponse.json({ error: 'Немає активних підписників для відправки' }, { status: 400 });
        }

        // 2. Save campaign record
        const { data: campaign, error: campErr } = await supabase
            .from('email_campaigns')
            .insert({
                subject,
                body_html,
                body_text: body_text || subject,
                segment,
                status: 'sending',
                total_recipients: subscribers.length,
            })
            .select('id')
            .single();

        if (campErr || !campaign) {
            return NextResponse.json({ error: 'Помилка створення кампанії' }, { status: 500 });
        }

        const FROM = `Touch.Memories <${process.env.RESEND_FROM_EMAIL || 'hello@touchmemories.ua'}>`;
        let sent = 0, failed = 0;

        // 3. Send in batches of 10 (Resend free tier rate limit)
        const BATCH = 10;
        for (let i = 0; i < subscribers.length; i += BATCH) {
            const batch = subscribers.slice(i, i + BATCH);
            await Promise.all(batch.map(async (sub) => {
                try {
                    // Add unsubscribe footer to HTML
                    const unsubUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories1.vercel.app'}/unsubscribe?email=${encodeURIComponent(sub.email)}`;
                    const htmlWithFooter = `${body_html}
                        <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;">
                            Touch.Memories · <a href="${unsubUrl}" style="color:#9ca3af;">Відписатися від розсилки</a>
                        </div>`;

                    await resend.emails.send({
                        from: FROM,
                        to: sub.email,
                        subject,
                        html: htmlWithFooter,
                    });
                    sent++;
                } catch (e) {
                    console.error(`Failed to send to ${sub.email}:`, e);
                    failed++;
                }
            }));
            // Rate limit pause between batches
            if (i + BATCH < subscribers.length) await delay(1200);
        }

        // 4. Update campaign status
        await supabase.from('email_campaigns').update({
            status: failed === subscribers.length ? 'failed' : 'sent',
            sent_count: sent,
            failed_count: failed,
            sent_at: new Date().toISOString(),
        }).eq('id', campaign.id);

        return NextResponse.json({ success: true, sent, failed, total: subscribers.length });

    } catch (err: any) {
        console.error('Newsletter error:', err);
        return NextResponse.json({ error: err.message || 'Невідома помилка' }, { status: 500 });
    }
}

// GET — return last campaigns
export async function GET() {
    const supabase = getAdminClient();
    const { data } = await supabase
        .from('email_campaigns')
        .select('id, subject, segment, status, sent_count, failed_count, total_recipients, created_at, sent_at')
        .order('created_at', { ascending: false })
        .limit(10);
    return NextResponse.json({ campaigns: data || [] });
}
