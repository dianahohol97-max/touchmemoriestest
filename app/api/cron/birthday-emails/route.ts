import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email/resend';
import BirthdayEmail from '@/emails/BirthdayEmail';
import { render } from '@react-email/components';

import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const supabase = getAdminClient();
    // 1. Verify Vercel Cron Secret (or local testing secret)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentDay = today.getDate(); // 1-31
    const currentYear = today.getFullYear();

    try {
        // 2. Fetch active subscribers whose birthday is today
        const { data: subscribers, error: subError } = await supabase
            .from('subscribers')
            .select('*')
            .eq('is_active', true)
            .eq('birthday_month', currentMonth)
            .eq('birthday_day', currentDay);

        if (subError) throw subError;
        if (!subscribers || subscribers.length === 0) {
            return NextResponse.json({ message: 'No birthdays today', processed: 0 });
        }

        let sentCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        // 3. Create a parent campaign for logging
        const { data: campaign, error: camError } = await supabase
            .from('email_campaigns')
            .insert({
                type: 'birthday',
                subject: 'З Днем Народження! Ваш подарунок всередині 🎂',
                segment: 'birthday_auto',
                status: 'sending'
            })
            .select('id')
            .single();

        if (camError) throw camError;

        // 4. Process each subscriber
        for (const sub of subscribers) {
            // Check if already got one this year to avoid duplicates.
            const { data: logs } = await supabase
                .from('email_logs')
                .select('id')
                .eq('subscriber_id', sub.id)
                .gte('sent_at', `${currentYear}-01-01T00:00:00Z`); // Crude check for this year

            // Because campaigns could be any type, let's refine to just the ones linked to 'birthday' campaigns
            const { data: bdayLogs } = await supabase
                .from('email_logs')
                .select('id, email_campaigns!inner(type)')
                .eq('subscriber_id', sub.id)
                .eq('email_campaigns.type', 'birthday')
                .gte('sent_at', `${currentYear}-01-01T00:00:00Z`);

            if (bdayLogs && bdayLogs.length > 0) {
                skipCount++;
                continue;
            }

            // Generate unique promo code
            const firstName = sub.name ? sub.name.split(' ')[0] : 'Клієнт';
            const cleanName = firstName.replace(/[^a-zA-Zа-яА-ЯіІїЇєЄ]/g, '').toUpperCase() || 'CLIENT';
            const randomDigits = Math.floor(1000 + Math.random() * 9000);
            const promoCodeString = `HAPPY-${cleanName}-${randomDigits}`;

            // Valid for 7 days
            const validUntil = new Date();
            validUntil.setDate(validUntil.getDate() + 7);

            // Insert Promo Code
            const { data: promoData, error: promoError } = await supabase
                .from('promo_codes')
                .insert({
                    code: promoCodeString,
                    type: 'percent',
                    value: 20,
                    min_order_amount: 500,
                    is_single_use_per_customer: true,
                    valid_until: validUntil.toISOString(),
                    created_by: 'birthday_auto'
                })
                .select('id')
                .single();

            if (promoError) {
                console.error('Promo generation error:', promoError);
                errorCount++;
                continue;
            }

            // Render Email HTML
            const htmlMessage = await render(
                BirthdayEmail({
                    firstName: firstName,
                    promoCode: promoCodeString,
                    validUntil: '7 днів',
                    discountValue: '-20%',
                    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
                })
            );

            // Log intention to get pixel tracking ID
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

            if (logError) {
                errorCount++;
                continue;
            }

            // Dispatch Email
            const emailResult = await sendEmail({
                to: sub.email,
                subject: 'З Днем Народження! Ваш подарунок всередині 🎂',
                html: htmlMessage,
                campaignId: campaign.id,
                subscriberId: sub.id,
                pixelId: emailLog.tracking_pixel_id,
                unsubscribeToken: sub.unsubscribe_token
            });

            if (emailResult.success) {
                sentCount++;
            } else {
                // Mark bounce or fail
                await supabase.from('email_logs').update({ status: 'bounced' }).eq('id', emailLog.id);
                errorCount++;
            }
        }

        // Finalize Campaign
        await supabase
            .from('email_campaigns')
            .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                total_sent: sentCount
            })
            .eq('id', campaign.id);

        return NextResponse.json({
            message: 'Birthday Cron executed',
            processed: subscribers.length,
            sent: sentCount,
            skipped: skipCount,
            errors: errorCount
        });

    } catch (err: any) {
        console.error('Cron Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
