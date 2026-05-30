import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/designer/order-photos?order_id=<uuid>
 *
 * Returns the customer's uploaded photos for a designer order as signed URLs,
 * so the layout constructor (BookLayoutEditor in designer_mode) and the admin
 * order page can actually show / load them.
 *
 * Background: the designer-order flow uploads the customer's photos to the
 * `order-files` Storage bucket and links them in `order_files`
 * (file_type='upload', category 'designer-order' / 'designer-cover'). Nothing
 * on the consumption side ever read them back — the constructor opened with an
 * empty photo pool and the admin "Файли" card only showed a manual Drive link.
 * This endpoint is that missing read path.
 *
 * Staff-only (admin_users OR staff), mirroring /api/designer/free-orders.
 */
export async function GET(req: NextRequest) {
    const cookieClient = await createClient();
    const { data: { user } } = await cookieClient.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getAdminClient();

    // Allow admin or any staff member (same gate as the free-order queue).
    let allowed = false;
    if (user.email) {
        const { data: adminRow } = await admin
            .from('admin_users')
            .select('id')
            .eq('email', user.email)
            .maybeSingle();
        if (adminRow) allowed = true;

        if (!allowed) {
            const { data: staffRow } = await admin
                .from('staff')
                .select('id')
                .eq('email', user.email)
                .maybeSingle();
            if (staffRow) allowed = true;
        }
    }

    if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orderId = req.nextUrl.searchParams.get('order_id');
    if (!orderId) {
        return NextResponse.json({ error: 'order_id required' }, { status: 400 });
    }

    const { data: files, error } = await admin
        .from('order_files')
        .select('id, file_path, file_name, file_category, bucket_name, page_number, mime_type')
        .eq('order_id', orderId)
        .eq('file_type', 'upload')
        .order('page_number', { ascending: true, nullsFirst: true })
        .order('file_name', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!files || files.length === 0) {
        return NextResponse.json({ photos: [] });
    }

    // Sign in batches per bucket (createSignedUrls returns results aligned to
    // the input path order).
    const byBucket: Record<string, typeof files> = {};
    for (const f of files) {
        const bucket = f.bucket_name || 'order-files';
        (byBucket[bucket] ||= []).push(f);
    }

    const photos: Array<{
        id: string;
        name: string;
        url: string | null;
        category: string | null;
        isCover: boolean;
        page_number: number | null;
        mime_type: string | null;
    }> = [];

    const ONE_DAY = 60 * 60 * 24;
    for (const [bucket, list] of Object.entries(byBucket)) {
        const paths = list.map(f => f.file_path);
        const { data: signed } = await admin.storage.from(bucket).createSignedUrls(paths, ONE_DAY);
        (signed || []).forEach((s, i) => {
            const f = list[i];
            photos.push({
                id: f.id,
                name: f.file_name,
                url: s?.signedUrl || null,
                category: f.file_category,
                isCover: (f.file_category || '').toLowerCase().includes('cover'),
                page_number: f.page_number,
                mime_type: f.mime_type,
            });
        });
    }

    // Covers first so they're easy to spot in the admin grid; the constructor
    // ignores ordering (it builds its own pool).
    photos.sort((a, b) => Number(b.isCover) - Number(a.isCover));

    return NextResponse.json({ photos });
}
