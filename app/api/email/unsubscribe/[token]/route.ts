import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

function escapeHtml(s: string): string {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;
    const supabase = getAdminClient();

    if (!token || !TOKEN_RE.test(token)) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    // 1. Fetch Subscriber
    const { data: subscriber, error: fetchErr } = await supabase
        .from('subscribers')
        .select('id, email')
        .eq('unsubscribe_token', token)
        .single();

    if (fetchErr || !subscriber) {
        return new NextResponse(
            `<html>
                <body style="font-family: sans-serif; text-align: center; padding: 40px; color: #263A99; background: #f8fafc;">
                    <h2>Помилка</h2>
                    <p>Посилання недійсне або користувача не знайдено.</p>
                </body>
             </html>`,
            { headers: { 'Content-Type': 'text/html' } }
        );
    }

    // 2. Deactivate
    await supabase
        .from('subscribers')
        .update({ is_active: false })
        .eq('id', subscriber.id);

    // 3. Log unsubscribe to the most recent email_logs entry for this user.
    const { data: lastLog } = await supabase
        .from('email_logs')
        .select('id')
        .eq('subscriber_id', subscriber.id)
        .order('sent_at', { ascending: false })
        .limit(1)
        .single();

    if (lastLog) {
        await supabase
            .from('email_logs')
            .update({ status: 'unsubscribed' })
            .eq('id', lastLog.id);
    }

    // Escape email and app URL before embedding in HTML — defense-in-depth
    // against any value that slipped past form validation (XSS).
    const safeEmail = escapeHtml(subscriber.email);
    const safeAppUrl = escapeHtml(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');

    return new NextResponse(
        `<html>
            <body style="font-family: sans-serif; text-align: center; padding: 60px 20px; color: #263A99; background: #f8fafc; margin: 0;">
                <div style="background: white; max-width: 500px; margin: 0 auto; padding: 40px; border-radius: 20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                    <h2 style="color: #263A99; margin-top: 0;">Ви успішно відписалися </h2>
                    <p style="color: #64748b; line-height: 1.6; margin-bottom: 30px;">
                        Адресу <strong>${safeEmail}</strong> було видалено з нашого списку розсилки.
                        Ви більше не отримуватимете акцій та запрошень.
                    </p>
                    <p style="font-size: 14px; color: #94a3b8;">
                        Випадково натиснули? Щоб знову підписатися, скористайтеся формою на нашому сайті.
                    </p>
                    <a href="${safeAppUrl}" style="display: inline-block; background: #f1f5f9; color: #475569; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin-top: 20px;">
                        Повернутися на сайт
                    </a>
                </div>
            </body>
         </html>`,
        { headers: { 'Content-Type': 'text/html' } }
    );
}
