import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// POST /api/admin/wishlist-reminder
// Sends reminder emails to customers who have items in their wishlist for X days
// Body: { days?: number (default 7) } or triggered by cron
export async function POST(req: Request) {
    const supabase = getAdminClient();
    const { days = 7 } = await req.json().catch(() => ({}));

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // Get wishlists older than `days` days, grouped by customer
    const { data: entries, error } = await supabase
        .from('wishlists')
        .select(`
            id, product_name, product_price, product_slug, product_image,
            user_id, created_at,
            customers!wishlists_user_id_fkey(id, email, first_name, last_name)
        `)
        .lte('created_at', cutoff.toISOString())
        .not('user_id', 'is', null);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!entries?.length) return NextResponse.json({ sent: 0, message: 'No wishlists to remind' });

    // Group by customer
    const byCustomer: Record<string, { customer: any; items: any[] }> = {};
    for (const e of entries) {
        const cust = (e as any).customers;
        if (!cust?.email) continue;
        if (!byCustomer[cust.email]) byCustomer[cust.email] = { customer: cust, items: [] };
        byCustomer[cust.email].items.push(e);
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://touch.memories.com.ua';
    let sent = 0;

    for (const { customer, items } of Object.values(byCustomer)) {
        try {
            const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Покупцю';
            const itemsHtml = items.map(item => `
                <tr>
                    <td style="padding:12px;border-bottom:1px solid #f1f5f9;">
                        ${item.product_image ? `<img src="${item.product_image}" width="60" height="60" style="border-radius:6px;object-fit:cover;" />` : ''}
                    </td>
                    <td style="padding:12px;border-bottom:1px solid #f1f5f9;">
                        <div style="font-weight:700;color:#0f172a;">${item.product_name}</div>
                        <div style="color:#263A99;font-weight:900;">${item.product_price} ₴</div>
                    </td>
                    <td style="padding:12px;border-bottom:1px solid #f1f5f9;text-align:right;">
                        <a href="${siteUrl}/catalog/${item.product_slug}" style="background:#263A99;color:white;padding:8px 16px;border-radius:4px;text-decoration:none;font-size:13px;font-weight:700;">
                            Замовити
                        </a>
                    </td>
                </tr>
            `).join('');

            const html = `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
                    <img src="${siteUrl}/logo.png" alt="Touch.Memories" style="height:40px;margin-bottom:24px;" />
                    <h2 style="color:#263A99;margin-bottom:8px;">Привіт, ${name}! </h2>
                    <p style="color:#64748b;margin-bottom:24px;">
                        У вашому списку бажань є товари, які чекають на вас.
                        Не забудьте оформити замовлення — ми вже готові до роботи! 
                    </p>
                    <table style="width:100%;border-collapse:collapse;">
                        ${itemsHtml}
                    </table>
                    <div style="text-align:center;margin-top:32px;">
                        <a href="${siteUrl}/account" style="background:#263A99;color:white;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:16px;">
                            Перейти до мого кабінету
                        </a>
                    </div>
                    <p style="color:#94a3b8;font-size:12px;margin-top:32px;text-align:center;">
                        Touch.Memories · Тернопіль · <a href="${siteUrl}/catalog" style="color:#263A99;">Каталог</a>
                    </p>
                </div>
            `;

            await fetch(`${siteUrl}/api/email/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: customer.email,
                    subject: `${name}, у вашому вішлісті є незавершені бажання `,
                    html,
                }),
            });

            sent++;
        } catch (err) {
            console.error(`Failed to send reminder to ${customer.email}:`, err);
        }
    }

    return NextResponse.json({ sent, total: Object.keys(byCustomer).length });
}

// GET — preview how many customers would receive reminders
export async function GET(req: Request) {
    const supabase = getAdminClient();
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '7');

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const { count } = await supabase
        .from('wishlists')
        .select('*', { count: 'exact', head: true })
        .lte('created_at', cutoff.toISOString())
        .not('user_id', 'is', null);

    return NextResponse.json({ wouldSend: count || 0, days });
}
