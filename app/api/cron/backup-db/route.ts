import { NextResponse } from 'next/server';

import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
// Paging four tables sequentially takes longer than the default budget.
export const maxDuration = 300;

const TABLES = ['orders', 'customers', 'products', 'categories'] as const;
const PAGE_SIZE = 1000;

/**
 * Read an entire table, one page at a time.
 *
 * `.select('*')` with no range is capped by PostgREST's max-rows setting
 * (1000 by default on Supabase). The cap is silent: you get 1000 rows and no
 * error, so the backup shrinks below the real table without anything looking
 * wrong. `customers` passed 1000 rows and the nightly backup had been dropping
 * the overflow ever since; `orders` was on the same path.
 *
 * Paged by `created_at, id` rather than `id` alone: several of these tables use
 * uuid primary keys, so ordering by id is arbitrary — correct for paging, but
 * it makes the resulting file's order meaningless. The composite keeps the
 * dump chronological AND total (id breaks ties), which is what a human reading
 * a restore file wants. Throws rather than returning partial data: a truncated
 * backup that looks complete is worse than no backup at all.
 */
async function dumpTable(
    supabase: ReturnType<typeof getAdminClient>,
    table: string,
): Promise<any[]> {
    const rows: any[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

        if (error) throw new Error(`backup: reading '${table}' failed — ${error.message}`);
        if (!data || data.length === 0) return rows;

        rows.push(...data);
        if (data.length < PAGE_SIZE) return rows;

        // Guard against an unbounded loop if a page ever comes back full but
        // the range stops advancing.
        if (rows.length > 500_000) {
            throw new Error(`backup: '${table}' exceeded 500k rows — refusing to continue`);
        }
    }
}

export async function GET(req: Request) {
    const supabase = getAdminClient();
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || req.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('[CRON] Starting database backup...');

        // 1. Fetch every row of each critical table.
        // Sequential, not Promise.all: four concurrent full-table scans is a
        // needless spike on a job with no deadline, and a failure in one
        // should stop the run rather than race the others to completion.
        const tables: Record<string, any[]> = {};
        for (const table of TABLES) {
            tables[table] = await dumpTable(supabase, table);
            console.log(`[CRON] ${table}: ${tables[table].length} rows`);
        }

        const counts = Object.fromEntries(
            Object.entries(tables).map(([t, rows]) => [t, rows.length]),
        );

        // An empty critical table means something went wrong upstream — this
        // shop always has orders, customers and products. Refuse to overwrite
        // a good backup with an empty one.
        const empty = TABLES.filter(t => tables[t].length === 0);
        if (empty.length > 0) {
            throw new Error(`backup: refusing to write, these tables came back empty: ${empty.join(', ')}`);
        }

        const backupData = {
            timestamp: new Date().toISOString(),
            // Row counts travel WITH the data so a restore can verify the file
            // is whole without having to trust that it is.
            counts,
            ...tables,
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

        return NextResponse.json({ success: true, file: fileName, counts });
    } catch (e: any) {
        // A 500 is the signal: the cron runner records the failed run, and the
        // previous good backup is left in place. Silently succeeding with a
        // partial file — which is what recording the errors INTO the artefact
        // used to do — is the one outcome a backup job must never produce.
        console.error('[CRON] Backup failed:', e);
        return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
    }
}
