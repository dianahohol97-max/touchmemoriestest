import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// One-off storage cleanup of pre-launch test junk. Deletes objects in
// photobook-uploads / order-files that are (a) created BEFORE 2026-06-29
// (pre-launch test era; test orders <= TM-001030 were deleted from the DB but
// their files stayed), (b) not referenced by any order_files row, (c) not
// referenced by any remaining project's uploaded_photos, and (d) not under
// drafts/ (live draft photos are all newer anyway — belt and braces).
// Resumable: processes up to LIMIT files per call and reports what's left.
const KEY = 'tm-storage-cleanup-2026-07-03-p7q4';
const CUTOFF = '2026-06-29T00:00:00+03:00';
const LIMIT = 400;

export async function GET(req: Request) {
    const url = new URL(req.url);
    if (url.searchParams.get('key') !== KEY) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const dryRun = url.searchParams.get('dry') === '1';
    const admin = getAdminClient();

    // Referenced paths: every order file + every live draft photo path.
    const keep = new Set<string>();
    const { data: ofRows } = await admin.from('order_files').select('file_path, bucket_name');
    for (const r of ofRows || []) keep.add(`${r.bucket_name || 'order-files'}:${r.file_path}`);
    const { data: projs } = await admin.from('projects').select('uploaded_photos');
    for (const p of projs || []) {
        const arr = Array.isArray(p.uploaded_photos) ? p.uploaded_photos : [];
        for (const ph of arr) {
            const path = typeof ph === 'string' ? ph : ph?.path;
            if (path && !String(path).startsWith('blob:')) {
                keep.add(`${(ph?.bucket) || 'photobook-uploads'}:${path}`);
            }
        }
    }
    // Text-brief cover photos live in order-files under designer-order-*.
    const { data: briefs } = await admin.from('orders').select('text_brief').not('text_brief', 'is', null);
    for (const o of briefs || []) {
        const p = (o.text_brief as any)?.cover?.photo_path;
        if (p) keep.add(`order-files:${p}`);
    }

    // Candidate objects: old, in customer buckets, not drafts/.
    // storage schema isn't exposed over REST — use a security-definer RPC.
    const { data: candidates } = await admin.rpc('list_old_storage_candidates', { cutoff: CUTOFF, max_rows: LIMIT * 3 });

    const toDelete: Record<string, string[]> = { 'photobook-uploads': [], 'order-files': [] };
    let bytes = 0; let kept = 0;
    for (const o of candidates || []) {
        if (keep.has(`${o.bucket_id}:${o.name}`)) { kept++; continue; }
        if (toDelete[o.bucket_id].length + (o.bucket_id === 'photobook-uploads' ? 0 : 0) >= LIMIT) continue;
        if (toDelete['photobook-uploads'].length + toDelete['order-files'].length >= LIMIT) continue;
        toDelete[o.bucket_id].push(o.name);
        bytes += Number((o as any).size_bytes || 0);
    }
    const total = toDelete['photobook-uploads'].length + toDelete['order-files'].length;

    if (dryRun) {
        return NextResponse.json({
            dryRun: true,
            wouldDelete: total,
            mb: Math.round(bytes / 1048576),
            referencedKept: kept,
            sample: [...toDelete['photobook-uploads'].slice(0, 5), ...toDelete['order-files'].slice(0, 5)],
        });
    }

    let deleted = 0; const errors: string[] = [];
    for (const bucket of ['photobook-uploads', 'order-files'] as const) {
        const names = toDelete[bucket];
        for (let i = 0; i < names.length; i += 100) {
            const chunk = names.slice(i, i + 100);
            const { error } = await admin.storage.from(bucket).remove(chunk);
            if (error) errors.push(`${bucket}: ${error.message}`);
            else deleted += chunk.length;
        }
    }
    return NextResponse.json({ deleted, mb: Math.round(bytes / 1048576), errors, note: total >= LIMIT ? 'run again — more remains' : 'done' });
}
