import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail } from '@/lib/email/brevo';

export const dynamic = 'force-dynamic';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories1.vercel.app';

function buildHtml(body_html: string, unsubEmail: string) {
    const unsubUrl = `${SITE_URL}/unsubscribe?email=${encodeURIComponent(unsubEmail)}`;
    return `${body_html}
<div style="margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;font-family:sans-serif;">
  Touch.Memories &nbsp;·&nbsp;
  <a href="${unsubUrl}" style="color:#9ca3af;text-decoration:underline;">Відписатися від розсилки</a>
</div>`;
}

export async function POST(request: Request) {
    const supabase = getAdminClient();
    try {
        const { subject, body_html, segment = 'all' } = await request.json();
        if (!subject?.trim()) return NextResponse.json({ error: 'Тема листа обов\'язкова' }, { status: 400 });
        if (!body_html?.trim()) return NextResponse.json({ error: 'Текст листа обов\'язковий' }, { status: 400 });
        if (!process.env.BREVO_API_KEY) {
            return NextResponse.json({ error: 'BREVO_API_KEY не налаштований. Додай його у Vercel → Settings → Environment Variables.' }, { status: 500 });
        }

        let query = supabase.from('subscribers').select('id, email, name').eq('is_active', true);
        if (segment === 'instagram') query = query.eq('source', 'instagram');
        if (segment === 'checkout') query = query.eq('source', 'checkout');
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

        let sent = 0, failed = 0;
        for (const sub of subscribers) {
            try {
                await sendBrevoEmail({ to: sub.email, toName: sub.name || undefined, subject, html: buildHtml(body_html, sub.email) });
                sent++;
            } catch (e: any) {
                console.error(`Brevo: failed ${sub.email}:`, e.message);
                failed++;
            }
            await delay(350); // ~3 req/sec, Brevo rate limit
        }

        await supabase.from('email_campaigns').update({
            status: failed === subscribers.length ? 'failed' : 'sent',
            sent_count: sent, failed_count: failed, sent_at: new Date().toISOString(),
        }).eq('id', campaign.id);

        return NextResponse.json({ success: true, sent, failed, total: subscribers.length });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function GET() {
    const supabase = getAdminClient();
    const { data } = await supabase
        .from('email_campaigns')
        .select('id, subject, segment, status, sent_count, failed_count, recipients_count, created_at, sent_at')
        .order('created_at', { ascending: false }).limit(20);
    return NextResponse.json({ campaigns: data || [] });
}
