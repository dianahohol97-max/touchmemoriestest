import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/resend';
import WelcomeEmail from '@/emails/WelcomeEmail';
import { render } from '@react-email/components';

import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const supabase = getAdminClient();
    try {
        // Note: birthday_day and birthday_month are deprecated here
        // Birthday is now collected during user registration
        const { email, name, source = 'popup', segment } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // 1. Check if already exists
        const { data: existingSub, error: findErr } = await supabase
            .from('subscribers')
            .select('id, is_active, segments')
            .eq('email', email)
            .single();

        let subscriberId;
        let isNewSubscription = false;

        if (existingSub) {
            subscriberId = existingSub.id;

            // If already active, maybe just append segment and exit early to prevent spam
            if (existingSub.is_active) {
                if (segment && (!existingSub.segments || !existingSub.segments.includes(segment))) {
                    const newSegments = [...(existingSub.segments || []), segment];
                    await supabase.from('subscribers').update({ segments: newSegments }).eq('id', subscriberId);
                }
                return NextResponse.json({ message: 'Вже підписані!', success: true });
            } else {
                // Reactivate
                await supabase
                    .from('subscribers')
                    .update({ is_active: true, source: source })
                    .eq('id', subscriberId);
                isNewSubscription = true;
            }
        } else {
            // New creation (birthday no longer collected here)
            const segmentsList = segment ? [segment] : [];
            const { data: newSub, error: createErr } = await supabase
                .from('subscribers')
                .insert({
                    email,
                    name,
                    source,
                    segments: segmentsList
                    // birthday_day and birthday_month removed - now synced from customer registration
                })
                .select('id')
                .single();

            if (createErr) throw createErr;
            subscriberId = newSub.id;
            isNewSubscription = true;
        }

        // 2. Dispatch Welcome Email if it's a new or reactivated subscription
        if (isNewSubscription) {
            const htmlMessage = await render(
                WelcomeEmail({
                    firstName: name,
                    promoCode: 'WELCOME7',
                    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
                })
            );

            // Fetch unsubscribe token
            const { data: subData } = await supabase
                .from('subscribers')
                .select('unsubscribe_token')
                .eq('id', subscriberId)
                .single();

            // We mock a campaign ID or send independent. Given email_logs requires campaign_id by FK, 
            // we'll bypass full logging for standalone welcome emails unless we setup an "Auto_Welcome" campaign row.
            // For now, standalone send.

            await sendEmail({
                to: email,
                subject: 'Раді вітати вас в TouchMemories! Ваш подарунок всередині ',
                html: htmlMessage,
                unsubscribeToken: subData?.unsubscribe_token
            });
        }

        return NextResponse.json({ success: true, message: 'Дякуємо! Промокод надіслано на вашу пошту ' });

    } catch (err: any) {
        console.error('Subscribe Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
