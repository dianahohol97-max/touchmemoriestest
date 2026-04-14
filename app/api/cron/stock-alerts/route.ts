import { NextResponse } from 'next/server';
import { getResendClient } from '@/lib/email/resend';

import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const supabase = getAdminClient();
    const resend = getResendClient();
    // 1. Verify cron secret (if vercel cron)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('[Cron] Starting Stock Alert Verification...');

        // 1. Find all active products evaluating inventory that are low or out of stock
        const { data: products, error } = await supabase
            .from('products')
            .select('id, name, stock_available, low_stock_threshold, is_active')
            .eq('track_inventory', true)
            .eq('is_active', true);

        if (error) throw error;

        let lowStockCount = 0;
        let outOfStockCount = 0;

        for (const product of products) {
            if (product.stock_available <= 0) {
                // Out of stock fully
                outOfStockCount++;

                // Disable it
                await supabase.from('products').update({ is_active: false }).eq('id', product.id);

                // Add to alerts
                await supabase.from('stock_alerts').insert({
                    product_id: product.id,
                    alert_type: 'out_of_stock'
                });

                // Send Email to Admin
                await resend.emails.send({
                    from: 'TouchMemories Alerts <hello@touchmemories.ua>',
                    to: ['admin@touchmemories.ua'], // Replace with actual admin email
                    subject: `🚨 Товар закінчився: ${product.name}`,
                    html: `
                        <h2>🔴 Увага: Товар повністю закінчився</h2>
                        <p><strong>${product.name}</strong> більше немає на складі (Залишок: ${product.stock_available}).</p>
                        <p>Товар був автоматично знятий з публікації, щоб уникнути замовлень, які неможливо виконати.</p>
                        <br/>
                        <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/inventory">Перейти до складу</a>
                    `
                });

            } else if (product.stock_available <= product.low_stock_threshold) {
                // Low stock
                lowStockCount++;

                // Check if alert already exists and is unresolved so we don't spam
                const { data: existingAlert } = await supabase
                    .from('stock_alerts')
                    .select('id')
                    .eq('product_id', product.id)
                    .eq('alert_type', 'low_stock')
                    .eq('is_resolved', false)
                    .maybeSingle();

                if (!existingAlert) {
                    await supabase.from('stock_alerts').insert({
                        product_id: product.id,
                        alert_type: 'low_stock'
                    });

                    // Send Email to Admin
                    await resend.emails.send({
                        from: 'TouchMemories Alerts <hello@touchmemories.ua>',
                        to: ['admin@touchmemories.ua'], // Replace with actual admin email
                        subject: `⚠️ Низький залишок: ${product.name}`,
                        html: `
                            <h2>⚠️ Мало товару на складі</h2>
                            <p><strong>${product.name}</strong> закінчується.</p>
                            <p>Залишилось: <strong>${product.stock_available} шт.</strong> (Очікуваний поріг: ${product.low_stock_threshold} шт.)</p>
                            <br/>
                            <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/inventory">Перейти до складу</a>
                        `
                    });
                }
            }
        }

        return NextResponse.json({
            status: 'ok',
            message: `Processed ${products.length} catalog items. Generated ${lowStockCount} low alerts, ${outOfStockCount} critical alerts.`,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('Stock Alert Cron Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
