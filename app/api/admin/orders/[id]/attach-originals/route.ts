import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/admin/orders/[id]/attach-originals
 *
 * Finds the customer's ORIGINAL photos for an order and registers them as
 * order_files (category 'original'), so the existing "Завантажити всі (ZIP)"
 * button includes them. Sources, in order:
 *   A. Linked constructor projects (projects.order_id = order) — their
 *      uploaded_photos[].path entries in photobook-uploads (draft-persisted
 *      originals; this is how TM-001036 was recovered).
 *   B. "originals/" sibling folders next to the order's existing render
 *      files (the editor uploads full-size originals to
 *      {prefix}/{cartOrderId}/originals/{photoId}.jpg before rendering).
 * Idempotent: already-registered paths are skipped.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const admin = getAdminClient();

    const { data: existing } = await admin
        .from('order_files')
        .select('file_path, bucket_name')
        .eq('order_id', id);
    const have = new Set((existing || []).map(f => `${f.bucket_name || 'order-files'}:${f.file_path}`));

    type NewFile = { path: string; name: string; size: number | null; bucket: string };
    const found: NewFile[] = [];
    const seen = new Set<string>();
    const push = (bucket: string, path: string, name: string, size: number | null) => {
        const key = `${bucket}:${path}`;
        if (seen.has(key) || have.has(key)) return;
        seen.add(key);
        found.push({ bucket, path, name, size });
    };

    // Source A: linked projects' draft-persisted originals.
    const { data: projects } = await admin
        .from('projects')
        .select('uploaded_photos')
        .eq('order_id', id);
    const draftFolders = new Set<string>();
    for (const p of projects || []) {
        const arr = Array.isArray(p.uploaded_photos) ? p.uploaded_photos : [];
        for (const ph of arr) {
            const path = typeof ph === 'string' ? ph : ph?.path;
            if (path && !String(path).startsWith('blob:')) {
                draftFolders.add(String(path).split('/').slice(0, -1).join('/'));
            }
        }
    }
    for (const folder of draftFolders) {
        const { data: files } = await admin.storage.from('photobook-uploads').list(folder, { limit: 1000 });
        for (const f of files || []) {
            if (f.name && !f.id?.startsWith('folder')) {
                push('photobook-uploads', `${folder}/${f.name}`, f.name, (f.metadata as any)?.size ?? null);
            }
        }
    }

    // Source B: originals/ folders next to the order's existing files.
    const orderFolders = new Set<string>();
    for (const f of existing || []) {
        const parts = String(f.file_path).split('/');
        if (parts.length >= 2) orderFolders.add(parts.slice(0, -1).join('/'));
    }
    for (const folder of orderFolders) {
        if (folder.endsWith('/originals')) continue;
        for (const bucket of ['photobook-uploads', 'order-files']) {
            const { data: files } = await admin.storage.from(bucket).list(`${folder}/originals`, { limit: 1000 });
            for (const f of files || []) {
                if (f.name) push(bucket, `${folder}/originals/${f.name}`, f.name, (f.metadata as any)?.size ?? null);
            }
        }
    }

    if (found.length === 0) {
        return NextResponse.json({ attached: 0, message: 'Оригінали не знайдено (немає привʼязаної чернетки або папки originals).' });
    }

    const rows = found.map(f => ({
        order_id: id,
        file_path: f.path,
        file_name: f.name,
        file_type: 'upload',
        file_category: 'original',
        bucket_name: f.bucket,
        file_size: f.size,
        mime_type: 'image/jpeg',
    }));
    const { error } = await admin.from('order_files').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ attached: rows.length });
}
