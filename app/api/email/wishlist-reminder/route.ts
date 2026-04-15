import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
    const supabase = getAdminClient();

    const { data: items } = await supabase
        .from('wishlists')
        .select('user_id, product_name, product_slug, product_price, product_image')
        .not('user_id', 'is', null);

    if (!items || items.length === 0) return NextResponse.json({ sent: 0 });

    const byUser: Record<string, any[]> = {};
    for (const item of items) {
        if (!byUser[item.user_id]) byUser[item.user_id] = [];
        byUser[item.user_id].push(item);
    }

    let sent = 0;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua';

    for (const [userId, userItems] of Object.entries(byUser)) {
        const { data: { user } } = await supabase.auth.admin.getUserById(userId);
        if (!user?.email) continue;

        const { data: cust } = await supabase
            .from('customers').select('email_subscribed, first_name')
            .eq('email', user.email).single();

        if (cust?.email_subscribed === false) continue;

        const firstName = cust?.first_name || 'Друже';
        const itemsHtml = userItems.slice(0, 5).map(i => `
            <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f1f5f9">
                ${i.product_image ? `<img src="${i.product_image}" style="width:60px;height:60px;object-fit:cover;border-radius:4px" />` : ''}
                <div>
                    <div style="font-weight:700;color:#0f172a">${i.product_name}</div>
                    <div style="color:#263a99;font-weight:900">${i.product_price} ₴</div>
                    ${i.product_slug ? `<a href="${siteUrl}/catalog/${i.product_slug}" style="font-size:12px;color:#263a99">Переглянути →</a>` : ''}
                </div>
            </div>`).join('');

        const html = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <div style="background:#263a99;padding:24px;text-align:center"><h1 style="color:white;margin:0">Touch.Memories</h1></div>
            <div style="padding:32px">
                <h2 style="color:#263a99">Привіт, ${firstName}! </h2>
                <p style="color:#64748b">У вашому списку бажань є товари, які чекають на вас:</p>
                ${itemsHtml}
                <div style="margin-top:24px;text-align:center">
                    <a href="${siteUrl}/account" style="display:inline-block;padding:14px 28px;background:#263a99;color:white;text-decoration:none;border-radius:6px;font-weight:700">Переглянути список бажань</a>
                </div>
            </div>
            <div style="padding:16px;text-align:center;color:#94a3b8;font-size:12px">
                © Touch.Memories · <a href="${siteUrl}/account" style="color:#94a3b8">Налаштування розсилки</a>
            </div>
        </div>`;

        try {
            await fetch(`${siteUrl}/api/email/transactional`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'custom', to: user.email, subject: `${firstName}, у вашому списку бажань ${userItems.length} товар${userItems.length > 1 ? 'и' : ''} `, html }),
            });
            sent++;
        } catch (e) { console.error('wishlist reminder failed:', e); }
    }

    return NextResponse.json({ sent, total_users: Object.keys(byUser).length });
}
