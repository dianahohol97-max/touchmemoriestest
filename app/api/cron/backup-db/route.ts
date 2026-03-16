import { NextResponse } from 'next/server';

import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const supabase = getAdminClient();
    if (
        req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}` &&
        process.env.NODE_ENV === 'production'
    ) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('[CRON] Starting database backup...');

        // 1. Fetch data from critical tables
        const [ordersRes, customersRes, productsRes, categoriesRes] = await Promise.all([
            supabase.from('orders').select('*'),
            supabase.from('customers').select('*'),
            supabase.from('products').select('*'),
            supabase.from('categories').select('*'),
        ]);

        const backupData = {
            timestamp: new Date().toISOString(),
            orders: ordersRes.data || [],
            customers: customersRes.data || [],
            products: productsRes.data || [],
            categories: categoriesRes.data || [],
            errors: {
                orders: ordersRes.error,
                customers: customersRes.error,
                products: productsRes.error,
                categories: categoriesRes.error
            }
        };

        const jsonString = JSON.stringify(backupData, null, 2);
        const fileName = `backup_${new Date().toISOString().split('T')[0]}.json`;

        // 2. Ensure bucket exists or create it
        const { data: buckets } = await supabase.storage.listBuckets();
        if (!buckets?.find((b: any) => b.name === 'db_backups')) {
            await supabase.storage.createBucket('db_backups', { public: false });
        }

        // 3. Upload to storage
        const { error: uploadError } = await supabase.storage
            .from('db_backups')
            .upload(fileName, jsonString, {
                contentType: 'application/json',
                upsert: true
            });

        if (uploadError) throw uploadError;

        // 4. Cleanup old backups (> 30 days)
        const { data: files } = await supabase.storage.from('db_backups').list();
        if (files) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const oldFiles = files
                .filter((file: any) => new Date(file.created_at) < thirtyDaysAgo)
                .map((file: any) => file.name);

            if (oldFiles.length > 0) {
                await supabase.storage.from('db_backups').remove(oldFiles);
                console.log(`[CRON] Cleaned up ${oldFiles.length} old backups.`);
            }
        }

        return NextResponse.json({ success: true, file: fileName });
    } catch (e: any) {
        console.error('[CRON] Backup failed:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
