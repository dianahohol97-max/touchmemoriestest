import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;
    const supabase = getAdminClient();

    if (!token) {
        return NextResponse.json({ error: 'Token is missing' }, { status: 400 });
    }

    // 1. Fetch Subscriber
    const { data: subscriber, error: fetchErr } = await supabase
        .from('subscribers')
        .select('*')
        .eq('unsubscribe_token', token)
        .single();

    if (fetchErr || !subscriber) {
        return new NextResponse(
            `<html>
                <body style="font-family: sans-serif; text-align: center; padding: 40px; color: #334155; background: #f8fafc;">
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

    // 3. Log Unsubscribe (we log a raw status directly into email_logs if we can match the latest email sent, or create a generic log)
    // To be precise we attempt to find the last email sent to this user
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

    // Return HTML Success Message
    return new NextResponse(
        `<html>
            <body style="font-family: sans-serif; text-align: center; padding: 60px 20px; color: #334155; background: #f8fafc; margin: 0;">
                <div style="background: white; max-width: 500px; margin: 0 auto; padding: 40px; border-radius: 20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                    <h2 style="color: #0f172a; margin-top: 0;">Ви успішно відписалися ✅</h2>
                    <p style="color: #64748b; line-height: 1.6; margin-bottom: 30px;">
                        Адресу <strong>${subscriber.email}</strong> було видалено з нашого спиsku розсилки. 
                        Ви більше не отримуватимете акцій та запрошень.
                    </p>
                    <p style="font-size: 14px; color: #94a3b8;">
                        Випадково натиснули? Щоб знову підписатися, скористайтеся формою на нашому сайті.
                    </p>
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}" style="display: inline-block; background: #f1f5f9; color: #475569; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin-top: 20px;">
                        Повернутися на сайт
                    </a>
                </div>
            </body>
         </html>`,
        { headers: { 'Content-Type': 'text/html' } }
    );
}
