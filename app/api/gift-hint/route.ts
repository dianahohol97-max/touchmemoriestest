import { NextResponse } from 'next/server';
import { getResendClient } from '@/lib/email/resend';


import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const supabase = getAdminClient();
    const resend = getResendClient();
    try {
        const body = await req.json();
        const { product_id, recipient_email, recipient_name, sender_name, message } = body;
        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';

        // 1. Rate Limiting (Max 3 per hour per IP)
        const hourAgo = new Date(Date.now() - 3600000).toISOString();
        const { count, error: countError } = await supabase
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
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.ua';
        const productUrl = `${siteUrl}/catalog/all/${product.slug}`;

        const senderDisplay = sender_name || 'Твій близький або друг';

        const { data: emailData, error: emailError } = await resend.emails.send({
            from: 'TouchMemories <hints@mail.touchmemories.ua>', // Needs domain verification in Resend
            to: [recipient_email],
            subject: `${senderDisplay} натякає тобі на чудовий подарунок 🎁`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #f0f0f0; border-radius: 24px;">
                    <div style="text-align: center; margin-bottom: 32px;">
                        <h2 style="color: #1e293b; margin-bottom: 8px;">Хтось про тебе думає...</h2>
                        <p style="color: #64748b;">${sender_name ? `${sender_name} хоче, щоб ти знав/знала про цей товар` : 'Привіт! Ми отримали натяк, що цей подарунок може тебе зацікавити.'}</p>
                    </div>

                    <div style="background: #f8fafc; border-radius: 20px; padding: 24px; display: flex; align-items: center; gap: 20px; margin-bottom: 32px;">
                        <img src="${product.images?.[0]}" style="width: 120px; height: 120px; border-radius: 12px; object-fit: cover;" />
                        <div>
                            <h3 style="margin: 0 0 8px 0; color: #1e293b;">${product.name}</h3>
                            <div style="font-size: 20px; font-weight: 800; color: #ef4444;">${product.price} ₴</div>
                        </div>
                    </div>

                    ${message ? `
                        <div style="border-left: 4px solid #ef4444; padding: 16px 24px; background: #fff5f5; margin-bottom: 32px; border-radius: 0 16px 16px 0;">
                            <p style="margin: 0; font-style: italic; color: #1e293b;">"${message}"</p>
                        </div>
                    ` : ''}

                    <div style="text-align: center; margin-bottom: 40px;">
                        <a href="${productUrl}" style="display: inline-block; padding: 16px 32px; background: #1e293b; color: white; text-decoration: none; border-radius: 12px; font-weight: 800;">
                            Подивитись товар →
                        </a>
                    </div>

                    <div style="text-align: center; border-top: 1px solid #f0f0f0; paddingTop: 32px; color: #94a3b8; font-size: 13px;">
                        Це лише натяк — без жодних зобов'язань 😊
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
            recipient_email,
            recipient_name,
            sender_name,
            message,
            ip_address: ip
        });

        return NextResponse.json({ success: true, id: emailData?.id });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
