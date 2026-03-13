import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const supabase = getAdminClient();
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
        const { productId, newPrice, oldPrice } = await req.json();

        // 1. Get all customers who have this product in their wishlist
        const { data: wishlistEntries, error: wishlistError } = await supabase
            .from('wishlists')
            .select(`
                customer_id,
                customers (
                    email,
                    name
                ),
                product_id,
                products (
                    name,
                    slug,
                    images
                )
            `)
            .eq('product_id', productId);

        if (wishlistError) throw wishlistError;
        if (!wishlistEntries || wishlistEntries.length === 0) {
            return NextResponse.json({ message: 'No users to notify' });
        }

        const firstEntry = wishlistEntries[0] as any;
        const productName = firstEntry.products.name;
        const productSlug = firstEntry.products.slug;
        const productImage = firstEntry.products.images?.[0];
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua';

        // 2. Filter unique emails and send notifications
        const notifiedEmails = new Set<string>();
        const emailPromises = wishlistEntries
            .filter((entry: any) => entry.customers?.email)
            .map(async (entry: any) => {
                const email = entry.customers.email;
                const name = entry.customers.name || 'Клієнте';

                if (notifiedEmails.has(email)) return;
                notifiedEmails.add(email);

                return resend.emails.send({
                    from: 'TouchMemories <shop@mail.touchmemories.com.ua>',
                    to: email,
                    subject: `Ціна знижена на ${productName}! 🎉`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #f1f5f9; border-radius: 24px; padding: 40px;">
                            <h1 style="color: #ef4444; margin-bottom: 24px;">Гарні новини, ${name}!</h1>
                            <p style="font-size: 16px; line-height: 1.6; color: #64748b;">
                                Товар з вашого списку бажань подешевшав. Тепер це ідеальний момент, щоб його замовити!
                            </p>
                            
                            <div style="background: #f8fafc; border-radius: 24px; padding: 24px; margin: 32px 0; display: flex; align-items: center; gap: 20px;">
                                <img src="${productImage}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 16px;" />
                                <div>
                                    <h3 style="margin: 0; font-size: 18px; color: #1e293b;">${productName}</h3>
                                    <div style="margin-top: 8px;">
                                        <span style="text-decoration: line-through; color: #94a3b8; font-size: 14px;">${oldPrice} ₴</span>
                                        <span style="font-size: 24px; font-weight: 900; color: #ef4444; margin-left: 10px;">${newPrice} ₴</span>
                                    </div>
                                </div>
                            </div>

                            <div style="text-align: center;">
                                <a href="${siteUrl}/catalog/all/${productSlug}" 
                                   style="display: inline-block; background: #1e293b; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 800; margin-bottom: 32px;">
                                     Замовити зараз
                                </a>
                            </div>

                            <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 32px 0;" />
                            <p style="font-size: 12px; color: #94a3b8; text-align: center;">
                                Ви отримали цей лист, оскільки додали цей товар у свій список бажань на сайті TouchMemories.
                            </p>
                        </div>
                    `
                });
            });

        await Promise.all(emailPromises);

        return NextResponse.json({
            success: true,
            notifiedCount: notifiedEmails.size
        });

    } catch (error: any) {
        console.error('Price drop notification error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
