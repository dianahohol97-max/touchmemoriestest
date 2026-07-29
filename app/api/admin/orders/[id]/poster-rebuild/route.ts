import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/guards';

/**
 * Rebuild a lost poster print composite from the saved design.
 *
 * The poster constructor saves the FULL design (layout id, per-slot crop/zoom,
 * frame, background, text) into projects.pages_data[0], and the slot photos are
 * uploaded to order-files as NNN.jpeg. So even when the composed 300-DPI file
 * is lost (e.g. the old Railway-replace bug that blanked TM-001090), the poster
 * can be reproduced pixel-identically.
 *
 * GET  → returns the saved poster config + signed URLs for the slot photos, in
 *        slot order. The admin page then re-renders the composite IN THE
 *        BROWSER with the exact same code the customer's constructor used
 *        (renderPosterPrintBlob), so there is no second geometry to drift.
 * POST → registers the freshly uploaded composite in order_files (service
 *        role), replacing any previous poster-print rows for this order so
 *        re-clicks don't stack duplicates.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const admin = getAdminClient();
    const { id } = await params;

    const { data: project } = await admin
        .from('projects')
        .select('id, pages_data, format, uploaded_photos')
        .eq('order_id', id)
        .eq('product_type', 'poster')
        .maybeSingle();

    const config = (project as any)?.pages_data?.[0];
    if (!project || !config) {
        return NextResponse.json({ error: 'Для цього замовлення немає збереженого дизайну постера' }, { status: 404 });
    }

    // Slot photos live in order-files as .../NNN.jpeg — NNN is the 1-based slot
    // index (uploaded in config.photos order at add-to-cart).
    const slotEntries = ((project as any).uploaded_photos || [])
        .map((u: any) => {
            const m = /\/(\d{3})\.(jpe?g|png|webp)$/i.exec(u?.path || '');
            return m ? { path: u.path as string, bucket: (u.bucket as string) || 'order-files', n: parseInt(m[1], 10) } : null;
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.n - b.n);

    const slotUrls: (string | null)[] = [];
    for (const e of slotEntries as any[]) {
        const { data: signed } = await admin.storage.from(e.bucket).createSignedUrl(e.path, 60 * 60);
        slotUrls.push(signed?.signedUrl || null);
    }

    return NextResponse.json({ config, format: (project as any).format, slotUrls });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const admin = getAdminClient();
    const { id } = await params;
    const { path, size } = await req.json().catch(() => ({}));

    if (!path || typeof path !== 'string' || !path.startsWith('rebuilt/')) {
        return NextResponse.json({ error: 'invalid path' }, { status: 400 });
    }

    // Replace, don't stack: drop previous poster-print exports (rows + storage)
    // so a re-click leaves exactly one current composite.
    const { data: old } = await admin
        .from('order_files')
        .select('id, file_path, bucket_name')
        .eq('order_id', id)
        .eq('file_category', 'poster-print');
    const stale = (old || []).filter((f: any) => f.file_path !== path);
    if (stale.length) {
        const paths = stale.filter((f: any) => (f.bucket_name || 'poster-exports') === 'poster-exports').map((f: any) => f.file_path);
        if (paths.length) { try { await admin.storage.from('poster-exports').remove(paths); } catch { /* non-critical */ } }
        await admin.from('order_files').delete().in('id', stale.map((f: any) => f.id));
    }

    const { error } = await admin.from('order_files').insert({
        order_id: id,
        file_path: path,
        file_name: 'poster_300dpi.jpg',
        file_type: 'export',
        file_category: 'poster-print',
        product_type: 'poster',
        bucket_name: 'poster-exports',
        mime_type: 'image/jpeg',
        file_size: typeof size === 'number' ? size : null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
}
