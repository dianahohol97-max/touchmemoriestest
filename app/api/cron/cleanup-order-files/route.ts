import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Lossless storage cost control. Customer photos only need to exist while an
 * order is being produced and delivered. This cron deletes the photos of
 * orders delivered more than ORDER_FILES_RETENTION_DAYS (default 90) ago, so
 * Supabase storage stays bounded instead of growing forever.
 *
 * The order row is kept untouched — only the files are removed (via the
 * storage API so no orphaned blobs remain). orders.files_purged_at records it
 * so an order is never processed twice. Quality is not affected: by then the
 * product is printed and shipped.
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getAdminClient();
    if (!supabase) return NextResponse.json({ error: 'No admin client' }, { status: 500 });

    const retentionDays = Number(process.env.ORDER_FILES_RETENTION_DAYS || 90);
    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
    const BATCH = 100;

    // Delivered, past the retention window, not yet purged.
    // Prefer delivered_at; fall back to updated_at for legacy orders that
    // were marked delivered before delivered_at was recorded.
    const { data: orders, error: ordErr } = await supabase
        .from('orders')
        .select('id, order_number, delivered_at, updated_at')
        .eq('order_status', 'delivered')
        .is('files_purged_at', null)
        .or(`delivered_at.lt.${cutoff},and(delivered_at.is.null,updated_at.lt.${cutoff})`)
        .limit(BATCH);

    if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 500 });
    if (!orders || orders.length === 0) {
        return NextResponse.json({ ok: true, retentionDays, purgedOrders: 0, deletedFiles: 0 });
    }

    const orderIds = orders.map(o => o.id);
    const { data: files, error: filesErr } = await supabase
        .from('order_files')
        .select('id, order_id, bucket_name, file_path')
        .in('order_id', orderIds);
    if (filesErr) return NextResponse.json({ error: filesErr.message }, { status: 500 });

    // Group file paths by order, then by bucket.
    const byOrder = new Map<string, Map<string, string[]>>();
    for (const f of files || []) {
        if (!f.file_path) continue;
        const bucket = f.bucket_name || 'order-files';
        if (!byOrder.has(f.order_id)) byOrder.set(f.order_id, new Map());
        const buckets = byOrder.get(f.order_id)!;
        if (!buckets.has(bucket)) buckets.set(bucket, []);
        buckets.get(bucket)!.push(f.file_path);
    }

    let purgedOrders = 0;
    let deletedFiles = 0;
    const errors: string[] = [];

    for (const order of orders) {
        const buckets = byOrder.get(order.id);
        let ok = true;

        if (buckets) {
            for (const [bucket, paths] of buckets) {
                const { error } = await supabase.storage.from(bucket).remove(paths);
                if (error) {
                    ok = false;
                    errors.push(`${order.order_number}/${bucket}: ${error.message}`);
                } else {
                    deletedFiles += paths.length;
                }
            }
        }

        // Only finalise if every bucket removal succeeded (retry next run otherwise).
        if (!ok) continue;

        if (buckets) {
            await supabase.from('order_files').delete().eq('order_id', order.id);
            await supabase.from('order_history').insert({
                order_id: order.id,
                action: 'files_purged',
                notes: `Фото замовлення автоматично видалені зі сховища (строк зберігання ${retentionDays} днів після доставки)`,
                added_by: null,
            }).then(() => {}, () => {}); // history is best-effort
        }
        await supabase.from('orders').update({ files_purged_at: new Date().toISOString() }).eq('id', order.id);
        purgedOrders++;
    }

    return NextResponse.json({
        ok: true,
        retentionDays,
        candidates: orders.length,
        purgedOrders,
        deletedFiles,
        ...(errors.length ? { errors: errors.slice(0, 20) } : {}),
    });
}
