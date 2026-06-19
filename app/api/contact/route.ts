import { NextResponse } from 'next/server';
import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';

export async function POST(request: Request) {
    try {
        const { name, email, message } = await request.json();
        if (!name || !email || !message) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        if (!getBrevoApiKey()) {
            console.warn('[contact] BREVO_API_KEY not set — skipping email');
            return NextResponse.json({ ok: true });
        }

        await sendBrevoEmail({
            to: 'touch.memories3@gmail.com',
            toName: 'Touch.Memories',
            subject: `Нове повідомлення від ${name} через сайт`,
            html: `
                <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
                    <div style="background:#263A99;padding:20px 28px">
                        <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:.08em">TOUCH.MEMORIES</span>
                    </div>
                    <div style="padding:28px;background:#fff;border:1px solid #e2e8f0">
                        <h2 style="color:#1e2d7d;font-size:20px;margin:0 0 20px">Нове повідомлення з сайту</h2>
                        <table style="width:100%;font-size:14px;border-collapse:collapse">
                            <tr><td style="padding:8px 0;color:#6b7280;width:80px">Ім'я:</td><td style="padding:8px 0;font-weight:600;color:#111">${name}</td></tr>
                            <tr><td style="padding:8px 0;color:#6b7280">Email:</td><td style="padding:8px 0"><a href="mailto:${email}" style="color:#1e2d7d">${email}</a></td></tr>
                        </table>
                        <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0"/>
                        <p style="color:#6b7280;font-size:13px;margin:0 0 8px">Повідомлення:</p>
                        <p style="white-space:pre-wrap;color:#111;font-size:15px;line-height:1.6;margin:0">${message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
                    </div>
                    <div style="padding:14px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
                        <span style="font-size:12px;color:#94a3b8">touchmemories.com.ua · контактна форма</span>
                    </div>
                </div>
            `,
            fromName: 'Touch.Memories сайт',
            fromEmail: 'hello@touchmemories.com.ua',
        });

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[contact] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
