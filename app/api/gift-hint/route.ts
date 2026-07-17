import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/resend';
import { escapeHtml } from '@/lib/email/escape';


import { getAdminClient } from '@/lib/supabase/admin';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const supabase = getAdminClient();
    try {
        const body = await req.json();
        const { product_id, recipient_email, recipient_name, sender_name, message } = body;
        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';

        const recipient = String(recipient_email || '').trim().toLowerCase();
        if (!EMAIL_RE.test(recipient)) {
            return NextResponse.json({ error: 'Невірний email отримувача' }, { status: 400 });
        }

        const hourAgo = new Date(Date.now() - 3600000).toISOString();

        // 1a. Per-recipient rate limit (max 3 hints per address per hour).
        //     This is the primary defence: the hint email is delivered to the
        //     client-supplied recipient, so this cap is what actually stops a
        //     victim from being mail-bombed. It is keyed on the recipient address,
        //     which the attacker cannot spoof away (unlike the IP below).
        const { count: recipientCount } = await supabase
            .from('gift_hints')
            .select('*', { count: 'exact', head: true })
            .eq('recipient_email', recipient)
            .gt('created_at', hourAgo);
        if (recipientCount && recipientCount >= 3) {
            return NextResponse.json({ error: 'Забагато запитів. Спробуйте пізніше.' }, { status: 429 });
        }

        // 1b. Per-IP rate limit (max 3 per hour). Secondary — X-Forwarded-For is
        //     client-controlled and can be rotated, so it only slows naive abuse.
        const { count } = await supabase
            .from('gift_hints')
            .select('*', { count: 'exact', head: true })
            .eq('ip_address', ip)
            .gt('created_at', hourAgo);

        if (count && count >= 3) {
            return NextResponse.json({ error: 'Забагато запитів. Спробуйте пізніше.' }, { status: 429 });
        }

        // 2. Fetch Product Details
        const { data: product, error: prodError } = await supabase
            .from('products')
            .select('name, price, images, slug')
            .eq('id', product_id)
            .single();

        if (!product) throw new Error('Товар не знайдено');

        // 3. Send Email via Resend
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua';
        const productUrl = `${siteUrl}/catalog/all/${product.slug}`;

        const senderDisplay = escapeHtml(sender_name || 'Ваш близький або друг');

        const { data: emailData, error: emailError } = await sendEmail({
            to: recipient,
            subject: `${sender_name || 'Ваш близький або друг'} мріє про цей подарунок 🎁`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #f0f0f0; border-radius: 24px;">
                    <div style="text-align: center; margin-bottom: 32px;">
                        <h2 style="color: #263A99; margin-bottom: 8px;">Делікатний натяк 🎁</h2>
                        <p style="color: #64748b;">${sender_name ? `${escapeHtml(sender_name)} мріє про цей подарунок` : 'Хтось мріє про цей подарунок'}</p>
                    </div>

                    <div style="background: #f8fafc; border-radius: 20px; padding: 24px; display: flex; align-items: center; gap: 20px; margin-bottom: 32px;">
                        <img src="${product.images?.[0]}" style="width: 120px; height: 120px; border-radius: 12px; object-fit: cover;" />
                        <div>
                            <h3 style="margin: 0 0 8px 0; color: #263A99;">${escapeHtml(product.name)}</h3>
                            <div style="font-size: 20px; font-weight: 800; color: #ef4444;">${product.price} ₴</div>
                        </div>
                    </div>

                    ${message ? `
                        <div style="border-left: 4px solid #ef4444; padding: 16px 24px; background: #fff5f5; margin-bottom: 32px; border-radius: 0 16px 16px 0;">
                            <p style="margin: 0; font-style: italic; color: #263A99;">"${escapeHtml(message)}"</p>
                        </div>
                    ` : ''}

                    <div style="text-align: center; margin-bottom: 40px;">
                        <a href="${productUrl}" style="display: inline-block; padding: 16px 32px; background: #263A99; color: white; text-decoration: none; border-radius: 12px; font-weight: 800;">
                            Подивитись товар →
                        </a>
                    </div>

                    <div style="text-align: center; border-top: 1px solid #f0f0f0; paddingTop: 32px; color: #94a3b8; font-size: 13px;">
                        Це лише натяк — без жодних зобов'язань 
                    </div>
                </div>
            `
        });

        if (emailError) {
            // If domain not verified, it might fail. For now we log and proceed to save in DB.
            console.error('Resend Error:', emailError);
            return NextResponse.json({ error: 'Помилка відправки email. Перевірте налаштування.' }, { status: 500 });
        }

        // 4. Log to Supabase
        await supabase.from('gift_hints').insert({
            product_id,
            recipient_email: recipient,
            recipient_name,
            sender_name,
            message,
            ip_address: ip
        });

        return NextResponse.json({ success: true, id: emailData?.id });

    } catch (e: any) {
        console.error('[gift-hint] error:', e);
        return NextResponse.json({ error: 'Не вдалося надіслати натяк' }, { status: 500 });
    }
}
