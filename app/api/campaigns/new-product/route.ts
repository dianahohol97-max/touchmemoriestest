import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/resend';
import NewProductEmail from '@/emails/NewProductEmail';
import { render } from '@react-email/components';

import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request: Request) {
    const supabase = getAdminClient();
    try {
        const { product_id, segment = 'all' } = await request.json();

        if (!product_id) {
            return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
        }

        // 1. Fetch Product
        const { data: product, error: prodErr } = await supabase
            .from('products')
            .select(`
                *,
                categories (name)
            `)
            .eq('id', product_id)
            .single();

        if (prodErr || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        // 2. Fetch Targeted Subscribers
        let query = supabase.from('subscribers').select('*').eq('is_active', true);

        if (segment !== 'all') {
            query = query.contains('segments', [segment]);
        }

        const { data: subscribers, error: subErr } = await query;

        if (subErr) throw subErr;
        if (!subscribers || subscribers.length === 0) {
            return NextResponse.json({ message: 'No active subscribers found for this segment', sent: 0 });
        }

        // 3. Create Campaign
        const { data: campaign, error: camError } = await supabase
            .from('email_campaigns')
            .insert({
                type: 'new_product',
                subject: `Новинка! ${product.name} вже у нас `,
                product_id: product.id,
                segment: segment,
                status: 'sending'
            })
            .select('id')
            .single();

        if (camError) throw camError;

        // 4. Render Email
        const htmlMessage = await render(
            NewProductEmail({
                productName: product.name,
                productDescription: product.short_description || product.description?.substring(0, 150) + '...',
                productPrice: `${product.price} грн`,
                productImageUrl: product.images?.[0] || 'https://via.placeholder.com/600x400',
                productUrl: `${process.env.NEXT_PUBLIC_APP_URL}/products/${product.slug}`,
                appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
            })
        );

        // 5. Dispatch in batches (Resend free tier has limits, keeping it safe with delays)
        let sentCount = 0;
        let errorCount = 0;

        for (const sub of subscribers) {
            // Log intention
            const { data: emailLog, error: logError } = await supabase
                .from('email_logs')
                .insert({
                    campaign_id: campaign.id,
                    subscriber_id: sub.id,
                    email: sub.email,
                    status: 'sent'
                })
                .select('id, tracking_pixel_id')
                .single();

            if (logError) continue;

            const emailResult = await sendEmail({
                to: sub.email,
                subject: `Новинка! ${product.name} вже у нас `,
                html: htmlMessage,
                campaignId: campaign.id,
                subscriberId: sub.id,
                pixelId: emailLog.tracking_pixel_id,
                unsubscribeToken: sub.unsubscribe_token
            });

            if (emailResult.success) {
                sentCount++;
            } else {
                await supabase.from('email_logs').update({ status: 'bounced' }).eq('id', emailLog.id);
                errorCount++;
            }

            // Sleep to prevent rate limit blows on huge lists.
            await delay(200);
        }

        // 6. Finalize Campaign
        await supabase
            .from('email_campaigns')
            .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                total_sent: sentCount
            })
            .eq('id', campaign.id);

        return NextResponse.json({
            message: 'Campaign dispatched',
            total_targeted: subscribers.length,
            sent: sentCount,
            errors: errorCount
        });

    } catch (err: any) {
        console.error('Trigger Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
