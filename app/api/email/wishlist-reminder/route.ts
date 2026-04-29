import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/**
 * Sends a reminder email to every customer who has items in their wishlist.
 *
 * Was previously: open POST + queried `wishlists.user_id, product_name,
 * product_slug, product_price, product_image` — none of which exist in the
 * actual schema. Same root cause as the wishlist route bug. Rewrote to:
 *   - Require admin auth (this is a mass email).
 *   - Use the real schema: wishlists.customer_id + wishlists.product_id with
 *     a JOIN to products for name/slug/price/images.
 *   - Look up the customer once per group and use their stored email +
 *     email_subscribed flag (no need to call auth.admin.getUserById).
 */
export async function POST() {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();

    const { data: items, error } = await supabase
        .from('wishlists')
        .select('customer_id, product_id, products(name, slug, price, images)')
        .not('customer_id', 'is', null);

    if (error) {
        console.error('[wishlist-reminder] query failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!items || items.length === 0) return NextResponse.json({ sent: 0 });

    // Group items by customer_id.
    const byCustomer: Record<string, any[]> = {};
    for (const item of items as any[]) {
        if (!byCustomer[item.customer_id]) byCustomer[item.customer_id] = [];
        byCustomer[item.customer_id].push(item);
    }

    let sent = 0;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua';

    for (const [customerId, customerItems] of Object.entries(byCustomer)) {
        const { data: cust } = await supabase
            .from('customers')
            .select('email, email_subscribed, first_name')
            .eq('id', customerId)
            .maybeSingle();
        if (!cust?.email) continue;
        if ((cust as any).email_subscribed === false) continue;

        const firstName = (cust as any).first_name || 'Друже';
        const itemsHtml = customerItems.slice(0, 5).map((i: any) => {
            const p = i.products || {};
            const imageUrl = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;
            return `
            <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f1f5f9">
                ${imageUrl ? `<img src="${imageUrl}" style="width:60px;height:60px;object-fit:cover;border-radius:4px" />` : ''}
                <div>
                    <div style="font-weight:700;color:#0f172a">${p.name || ''}</div>
                    <div style="color:#263a99;font-weight:900">${p.price ?? ''} ₴</div>
                    ${p.slug ? `<a href="${siteUrl}/catalog/${p.slug}" style="font-size:12px;color:#263a99">Переглянути →</a>` : ''}
                </div>
            </div>`;
        }).join('');

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
                headers: {
                    'Content-Type': 'application/json',
                    'x-cron-secret': process.env.CRON_SECRET || '',
                },
                body: JSON.stringify({
                    action: 'custom',
                    to: (cust as any).email,
                    subject: `${firstName}, у вашому списку бажань ${customerItems.length} товар${customerItems.length > 1 ? 'и' : ''} `,
                    html,
                }),
            });
            sent++;
        } catch (e) {
            console.error('wishlist reminder failed:', e);
        }
    }

    return NextResponse.json({ sent, total_customers: Object.keys(byCustomer).length });
}
